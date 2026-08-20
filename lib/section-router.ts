/**
 * Decide what each spec section is and which sheets it belongs on.
 *
 * This replaces the hardcoded `tier1` lists. Those assumed a fixed numbering —
 * and one real job broke them three ways: domestic water piping was 22 11 16 and
 * not 22 11 19, the fuel system was oil rather than gas, and two sections carried
 * `.13` suffixes. Offices number differently, so the numbering has to be read
 * from the book rather than assumed.
 *
 * The outline stays fixed — that is what makes two sheets comparable and lets a
 * fitter learn where things live. Only the mapping from spec section to outline
 * section is discovered per job.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { getRouterClient, withRetry, ROUTER_MODEL } from './anthropic';
import { DIVISIONS, type DivisionId } from './upload-lists';

export type Role = 'primary' | 'supporting' | 'none';

export interface RoutedSection {
  sectionNumber: string;
  title: string | null;
  charCount: number;
  /** What this section is, in one line — from the model, for the review screen. */
  summary: string;
  roles: Record<DivisionId, Role>;
  /** Outline section titles this feeds, per division it is primary for. */
  targets: Partial<Record<DivisionId, string[]>>;
}

export interface TradePresence {
  id: DivisionId;
  name: string;
  primaryCount: number;
  supportingCount: number;
  /** False when too few trade-specific sections are present to build a real sheet. */
  present: boolean;
  /**
   * Sections of this trade own division went unclassified, so `present: false`
   * means "could not tell", not "not in the book". The two read identically
   * otherwise and call for opposite responses.
   */
  uncertain: boolean;
  note: string;
}

export interface Manifest {
  sections: RoutedSection[];
  trades: TradePresence[];
  warnings: string[];
}

/**
 * A section that relates to a trade but sits outside the divisions this tool
 * reads — fire suppression sharing hangers and ceiling space, a fire alarm
 * section that interlocks with smoke dampers. It is named on the checklist with
 * its page range so someone can go and read it, rather than read in full at the
 * cost of the whole division again.
 */
export interface ReferredSection {
  sectionNumber: string;
  title: string | null;
  summary: string;
  startPage: number | null;
  endPage: number | null;
  role: Role;
}

/**
 * Divisions read in full. A whole project manual runs to thousands of pages
 * across twenty divisions, and reading all of it that a classifier called
 * "possibly relevant" cost roughly $30 a sheet against $4.70 for the mechanical
 * divisions alone — for carpet and lighting sections that earn no place on a
 * fitter's sheet.
 *
 * Sections outside these divisions are not discarded: any the router made
 * PRIMARY for a sheet is still read, and the rest are carried onto the checklist
 * as pointers.
 */
const READ_DIVISIONS = new Set(['22', '23']);

/**
 * Divisions that never produce a useful pointer. 00 is procurement and
 * contracting, 01 is general requirements — payment applications, warranties,
 * record documents, photographic documentation. A classifier told to prefer
 * "supporting" when unsure marks most of them relevant to everything, and on one
 * project manual that alone contributed 28 of 68 pointers. A list nobody will
 * read is worse than no list, because it buries the two entries that matter.
 */
const ADMINISTRATIVE_DIVISIONS = new Set(['00', '01']);

const divisionOf = (sectionNumber: string) => sectionNumber.replace(/\D/g, '').slice(0, 2);

/**
 * One sentence naming what the upload turned out to contain.
 *
 * The review screen says which trades were found; the PDFs do not, and once they
 * are downloaded that record is gone. Someone handed two sheets cannot tell
 * whether the third trade was absent from the specification or forgotten by
 * whoever ran the tool, and those call for different responses. So each
 * checklist carries it.
 */
export function describeCoverage(trades: TradePresence[], built: DivisionId[]): string {
  const name = (id: DivisionId) => trades.find((t) => t.id === id)?.name ?? id;
  const absent = trades.filter((t) => !t.present && !built.includes(t.id));

  const builtNames = built.map(name).join(' and ');
  if (absent.length === 0) {
    return `This upload covered all three trades; sheets were built for ${builtNames}.`;
  }

  // A trade nobody could classify is not a trade the book lacks. Saying "no
  // plumbing sections were found" on a checklist that goes out with the sheets
  // would be stating as fact something the tool failed to determine.
  const unsure = absent.filter((t) => t.uncertain);
  const missing = absent.filter((t) => !t.uncertain);

  if (missing.length === 0) {
    return (
      `This upload contained ${builtNames} specifications. Whether it also covers ` +
      `${unsure.map((t) => t.name).join(' or ')} could not be determined from it — those ` +
      `sections were present but could not be classified, so no sheet was built. Check the ` +
      `specification directly before assuming that scope is absent.`
    );
  }

  const absentClause =
    `This upload contained ${builtNames} specifications. No ${missing
      .map((t) => t.name)
      .join(' or ')} sections were found in it, so no sheet was built for ` +
    `${missing.length === 1 ? 'that trade' : 'those trades'}. If that scope exists on this ` +
    'job, its specification was not part of what was uploaded.';

  if (unsure.length === 0) return absentClause;

  return (
    `${absentClause} Separately, ${unsure.map((t) => t.name).join(' or ')} could not be ` +
    'judged from this upload: sections of that division were present but could not be ' +
    'classified. Check the specification directly before assuming that scope is absent too.'
  );
}

export interface ReadingPlan<T> {
  /** Sections to read in full during Phase 1. */
  toRead: T[];
  /** Related, but outside the read divisions — named on the checklist instead. */
  referred: Record<DivisionId, ReferredSection[]>;
}

/**
 * Split the manifest into what gets read and what merely gets pointed at.
 *
 * `sources` must be index-aligned with `manifest.sections` — `buildManifest`
 * returns one entry per section it was given, in order, and everything here
 * relies on that. It cannot key off the section number: a book that names the
 * same number twice would otherwise have both copies read on one copy's roles,
 * and both charged for on one copy's page count.
 *
 * `locate` supplies page numbers, which are the whole value of a pointer: an
 * entry saying "28 46 00, pages 1590-1607" can be acted on; one saying
 * "28 46 00" cannot, in a book this size.
 */
export function planReading<T extends { sectionNumber: string }>(
  manifest: Manifest,
  trades: DivisionId[],
  sources: T[],
  locate: (n: string, index: number) => { startPage: number | null; endPage: number | null },
  /** Sections the user asked to have read in full despite the division filter. */
  alsoRead: ReadonlySet<string> = new Set(),
): ReadingPlan<T> {
  const referred = { plumbing: [], sheetmetal: [], hydronic: [] } as ReadingPlan<T>['referred'];
  const readIndices = new Set<number>();

  manifest.sections.forEach((section, index) => {
    const roles = trades.map((t) => [t, section.roles[t]] as const).filter(([, r]) => r !== 'none');
    if (roles.length === 0) return;

    const inReadDivision = READ_DIVISIONS.has(divisionOf(section.sectionNumber));
    const primaryForSomething = roles.some(([, r]) => r === 'primary');

    if (inReadDivision || primaryForSomething || alsoRead.has(section.sectionNumber)) {
      readIndices.add(index);
      return;
    }

    if (ADMINISTRATIVE_DIVISIONS.has(divisionOf(section.sectionNumber))) return;

    const where = locate(section.sectionNumber, index);
    for (const [trade, role] of roles) {
      // A section detected twice — which a weakly-split book does produce —
      // must not be pointed at twice.
      if (referred[trade].some((r) => r.sectionNumber === section.sectionNumber)) continue;
      referred[trade].push({
        sectionNumber: section.sectionNumber,
        title: section.title,
        summary: section.summary,
        role,
        ...where,
      });
    }
  });

  for (const trade of Object.keys(referred) as DivisionId[]) {
    referred[trade].sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
  }

  return { toRead: sources.filter((_, i) => readIndices.has(i)), referred };
}

export interface RouterInput {
  sectionNumber: string;
  title: string | null;
  text: string;
}

/** Enough of a section to tell what it is without paying for the whole thing. */
const EXCERPT_CHARS = 900;

/**
 * Sections classified per call.
 *
 * A whole project manual can hold 123 sections, and asking for all of them in
 * one response produced 7.5 minutes of work and a reply with no JSON in it at
 * all — one bad response losing the entire manifest. Thirty is the size that was
 * tested working, and batching also means a failure costs one batch rather than
 * the book.
 */
const BATCH_SIZE = 30;

/**
 * How a section is named to the classifier and matched back again.
 *
 * Not by its number. A book can carry the same number twice — a divider page, a
 * cross-reference caught mid-page, a section genuinely split across two places —
 * and keying the replies by number let one of those stand in for the other. On a
 * 216-page manual the contents entry numbered `22 05 00` answered for the real
 * Common Work Results for Plumbing, and the whole plumbing trade was reported
 * absent from a book that specifies nine plumbing sections. Position is unique
 * where the number is not.
 */
function buildPrompt(sections: RouterInput[], offset: number): string {
  const outlines = DIVISIONS.map(
    (d) =>
      `${d.id} — ${d.name}\n` +
      d.outline.map((s, i) => `  ${String(i + 1).padStart(2, '0')} ${s.title}`).join('\n'),
  ).join('\n\n');

  const list = sections
    .map(
      (s, i) =>
        `--- [ref ${offset + i}] ${s.sectionNumber} — ${s.title ?? '(no title)'} ---\n` +
        excerptOf(s).replace(/\s+/g, ' ').trim(),
    )
    .join('\n\n');

  return `You are sorting the sections of a construction specification book so that three
field cheat sheets can be built from it. Each sheet has a FIXED outline:

${outlines}

For every spec section below, decide its role for each of the three sheets:

- "primary"    — this section is that trade's own scope and should drive content
                 on that sheet. Assign the outline sections it feeds.
- "supporting" — not that trade's own scope, but it governs, restricts or
                 qualifies that trade's work. Shared hangers, vibration control,
                 division-wide test pressures, identification, testing and
                 balancing, equipment the trade has to connect to.
- "none"       — genuinely no bearing on that trade at all.

Rules:
- A section may be primary for more than one sheet. Duct insulation is sheet
  metal; pipe insulation is piping; equipment insulation and anything a trade
  both installs and connects to may be primary for both.
- "none" is a strong claim and the default must not be to reach for it. Nothing
  in an uploaded division gets discarded on the grounds of looking
  administrative: a general-requirements section still carries division-wide test
  pressures, coordination and access rules that govern real work. Mark such
  sections "supporting". Reserve "none" for sections belonging to a different
  trade entirely — a plumbing fixture schedule has no bearing on the duct sheet.
- When you are unsure whether a section touches a trade, choose "supporting".
  Reading a section that turns out to be irrelevant costs a little; missing a
  requirement buried in one costs a great deal.
- Equipment sections — chillers, cooling towers, pumps, fans, terminal units —
  are primary for the trade that installs and connects them, supporting for
  a trade that only has to work around them.
- Judge by what the section CONTAINS, not by its number. Offices number
  differently and numbers carry suffixes.
- An excerpt may open partway through the previous section, because some books
  start a new section halfway down a page. Judge the section by the part that
  belongs to it — the text from its own "SECTION ..." heading onward.
- Every "primary" needs at least one target outline section, named exactly as
  written above.

Return ONE entry for every section listed, and copy its "ref" number back
exactly as given. The same section number may appear under two different refs;
they are different pieces of the book and each needs its own entry.

Return ONLY JSON between the markers, no commentary:

<<<MANIFEST_JSON>>>
[
  {
    "ref": ${offset},
    "sectionNumber": "22 11 16",
    "summary": "one line on what this section actually covers",
    "roles": { "plumbing": "primary", "sheetmetal": "none", "hydronic": "none" },
    "targets": { "plumbing": ["PIPE MATERIAL — BY SYSTEM & LOCATION", "JOINTS & CONNECTIONS"] }
  }
]
<<<END_MANIFEST_JSON>>>

THE SPEC SECTIONS:

${list}`;
}

/**
 * The part of a section worth showing the classifier.
 *
 * A book with no running header starts sections wherever the last one ended, so
 * the first page attributed to a section usually opens with the tail of its
 * predecessor. Taking the first 900 characters then describes the wrong section:
 * the excerpt for DOMESTIC WATER PIPING was pipe insulation, and the one for
 * COMMERCIAL WATER CLOSETS was water heater flue venting. Where the section
 * states its own heading, start there instead.
 */
function excerptOf(section: RouterInput): string {
  // A suffixed number carries a dot — '22 05 00.13' — so the number is escaped
  // before it goes into a pattern, and its spaces are made optional because
  // books write the same number spaced or tight.
  const pattern = section.sectionNumber
    .replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/ /g, String.raw`[^\S\n]?`);
  const heading = new RegExp(String.raw`^[^\S\n]*SECTION[^\S\n]+${pattern}\b`, 'm');
  const at = section.text.search(heading);
  const from = at === -1 ? 0 : at;
  return section.text.slice(from, from + EXCERPT_CHARS);
}

function parseManifest(raw: string): unknown[] {
  let body = raw
    .replace(/^[\s\S]*?<<<MANIFEST_JSON>>>/, '')
    .replace(/<<<END_MANIFEST_JSON>>>[\s\S]*$/, '')
    .trim()
    .replace(/^```(?:json)?/, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed)) throw new Error('Manifest was not a JSON array.');
    return parsed;
  } catch {
    // A response cut off mid-array still holds every section it managed to
    // classify. Trim back to the last complete object and close the array, so a
    // long book degrades to "some sections need review" instead of failing whole.
    const lastComplete = body.lastIndexOf('}');
    if (lastComplete === -1) throw new Error('No usable JSON in the response.');
    const repaired = body.slice(0, lastComplete + 1).replace(/,\s*$/, '') + ']';
    const parsed = JSON.parse(repaired);
    if (!Array.isArray(parsed)) throw new Error('Manifest was not a JSON array.');
    return parsed;
  }
}

const ROLES: Role[] = ['primary', 'supporting', 'none'];
const isRole = (v: unknown): v is Role => ROLES.includes(v as Role);

/**
 * Rebuild a manifest the caller already paid for, instead of classifying again.
 *
 * Both stages post to the same route with the same files, so the build used to
 * repeat the classification the review screen had just shown — a second charge
 * and several more minutes for an answer already on the user's screen. The
 * client posts the manifest back and this reconstitutes it.
 *
 * The split is still redone, because the section text has to come from
 * somewhere and splitting costs nothing. That also gives the check that makes
 * reuse safe: the manifest is positional, so it is only valid against a split
 * that produced the same sections in the same order. Same files and same code
 * do, but a deploy mid-session might not, and silently reading section 40's
 * classification against section 41's text would be far worse than paying
 * twice. Anything that does not line up exactly returns null and the caller
 * classifies again.
 */
export function reuseManifest(raw: string, sections: RouterInput[]): Manifest | null {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const priorSections = parsed?.sections;
  const priorTrades = parsed?.trades;
  if (!Array.isArray(priorSections) || !Array.isArray(priorTrades)) return null;
  if (priorSections.length !== sections.length) return null;
  if (priorTrades.length !== DIVISIONS.length) return null;

  const routed: RoutedSection[] = [];

  for (const [i, source] of sections.entries()) {
    const prior = priorSections[i];
    // Position is the identity, so a number out of place means the split moved
    // under the manifest and none of it can be trusted.
    if (prior?.sectionNumber !== source.sectionNumber) return null;

    const roles: Record<DivisionId, Role> = {
      plumbing: 'none',
      sheetmetal: 'none',
      hydronic: 'none',
    };
    const targets: RoutedSection['targets'] = {};

    for (const id of Object.keys(roles) as DivisionId[]) {
      const value = prior?.roles?.[id];
      if (!isRole(value)) return null;
      roles[id] = value;
      if (value !== 'primary') continue;
      const t = prior?.targets?.[id];
      const valid = Array.isArray(t) ? t.filter((x: unknown) => typeof x === 'string') : [];
      if (valid.length === 0) return null;
      targets[id] = valid;
    }

    routed.push({
      sectionNumber: source.sectionNumber,
      // Taken from this split rather than from the payload: whatever the client
      // holds is a copy, and these are cheap to derive correctly.
      title: source.title,
      charCount: source.text.length,
      summary: typeof prior?.summary === 'string' ? prior.summary : '',
      roles,
      targets,
    });
  }

  const trades: TradePresence[] = [];
  for (const d of DIVISIONS) {
    const prior = priorTrades.find((t: any) => t?.id === d.id);
    if (!prior || typeof prior.present !== 'boolean') return null;
    trades.push({
      id: d.id,
      name: d.name,
      primaryCount: routed.filter((r) => r.roles[d.id] === 'primary').length,
      supportingCount: routed.filter((r) => r.roles[d.id] === 'supporting').length,
      present: prior.present,
      uncertain: prior.uncertain === true,
      note: typeof prior.note === 'string' ? prior.note : '',
    });
  }

  return { sections: routed, trades, warnings: [] };
}

export async function buildManifest(sections: RouterInput[]): Promise<Manifest> {
  if (sections.length === 0) {
    return { sections: [], trades: [], warnings: ['No sections to route.'] };
  }

  const client = getRouterClient();
  const warnings: string[] = [];
  /** Classification per section, held by position — see `buildPrompt`. */
  const byRef = new Map<number, any>();

  // Batched, and batches run in sequence rather than at once: the classifier is
  // one small call per batch and a manual can need five of them, which is not
  // worth the risk of drawing an overload.
  const batches: RouterInput[][] = [];
  for (let i = 0; i < sections.length; i += BATCH_SIZE) {
    batches.push(sections.slice(i, i + BATCH_SIZE));
  }

  for (const [index, batch] of batches.entries()) {
    const offset = index * BATCH_SIZE;
    // Streamed because the SDK refuses a non-streaming request whose token
    // budget could take it past ten minutes, whatever it actually uses.
    const message = await withRetry(`manifest:batch-${index + 1}`, () =>
      client.messages
        .stream({
          model: ROUTER_MODEL,
          max_tokens: 32_000,
          messages: [{ role: 'user', content: buildPrompt(batch, offset) }],
        } as Anthropic.MessageStreamParams)
        .finalMessage(),
    );

    const raw = (message.content as Anthropic.ContentBlock[])
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    if (message.stop_reason === 'max_tokens') {
      warnings.push(
        `Batch ${index + 1} of ${batches.length} hit its output limit, so some of its ` +
          'sections may be missing from the manifest. Anything unclassified is treated as ' +
          'supporting everywhere — check the list before generating.',
      );
    }

    let entries: unknown[] = [];
    try {
      entries = parseManifest(raw);
    } catch {
      // One bad batch should cost its own sections, not the whole book. The
      // sections it covered fall through to "unclassified", which is reported
      // below rather than being left to look like absent scope.
      console.warn(
        `[manifest] batch ${index + 1}/${batches.length} unparseable ` +
          `(stop_reason=${message.stop_reason}, ${raw.length} chars). ` +
          `First 200: ${JSON.stringify(raw.slice(0, 200))}`,
      );
    }

    placeEntries(entries, batch, offset, byRef);

    const missing = batch.filter((_, i) => !byRef.has(offset + i));
    if (missing.length > 0) {
      console.warn(
        `[manifest] batch ${index + 1}/${batches.length}: ${missing.length} of ${batch.length} ` +
          `sections came back unclassified (${missing.map((m) => m.sectionNumber).join(', ')})`,
      );
      warnings.push(
        `${missing.length} section${missing.length === 1 ? '' : 's'} in batch ${index + 1} of ` +
          `${batches.length} could not be classified (${missing
            .map((m) => m.sectionNumber)
            .join(', ')}). They are treated as supporting everywhere, which means they count ` +
          'towards no trade. Check them on the list before generating.',
      );
    }
  }

  if (byRef.size === 0) {
    throw new Error(
      'The section classifier returned nothing usable for any part of this upload. ' +
        'Check the server log for what it replied.',
    );
  }

  const unclassified: string[] = [];

  const routed: RoutedSection[] = sections.map((s, i) => {
    const entry = byRef.get(i);
    const roles: Record<DivisionId, Role> = {
      plumbing: 'none',
      sheetmetal: 'none',
      hydronic: 'none',
    };
    const targets: RoutedSection['targets'] = {};

    if (!entry) {
      unclassified.push(s.sectionNumber);
      roles.plumbing = roles.sheetmetal = roles.hydronic = 'supporting';
    } else {
      for (const id of Object.keys(roles) as DivisionId[]) {
        const value = entry.roles?.[id];
        roles[id] = isRole(value) ? value : 'none';
        const t = entry.targets?.[id];
        if (roles[id] === 'primary') {
          const valid = Array.isArray(t) ? t.filter((x: unknown) => typeof x === 'string') : [];
          if (valid.length === 0) {
            warnings.push(
              `${s.sectionNumber} is primary for ${id} but names no outline section — ` +
                'it will be read as supporting instead.',
            );
            roles[id] = 'supporting';
          } else {
            targets[id] = valid;
          }
        }
      }
    }

    return {
      sectionNumber: s.sectionNumber,
      title: s.title,
      charCount: s.text.length,
      summary: typeof entry?.summary === 'string' ? entry.summary : '',
      roles,
      targets,
    };
  });

  const trades: TradePresence[] = DIVISIONS.map((d) => {
    const primaryCount = routed.filter((r) => r.roles[d.id] === 'primary').length;
    const supportingCount = routed.filter((r) => r.roles[d.id] === 'supporting').length;

    /**
     * Presence has to rest on sections that belong to this trade and nobody
     * else. Counting every "primary" reported a plumbing sheet in a Division 23
     * book, on the strength of identification, supports and expansion
     * compensation — sections that are primary for several trades at once, and
     * in that book were Division 23 anyway.
     *
     * Two filters. The section must carry this trade's own CSI division number,
     * which is the one thing that does not vary between offices. And it must not
     * be primary for every trade, since a section that serves all of them
     * distinguishes none of them.
     *
     * Counted by section number rather than by row: a book that names the same
     * section in two places has one section of that scope, not two.
     */
    const divisionPrefix = d.divisionShort.replace(/\D/g, '');
    const distinctive = new Set(
      routed
        .filter(
          (r) =>
            r.roles[d.id] === 'primary' &&
            r.sectionNumber.replace(/\D/g, '').startsWith(divisionPrefix) &&
            !DIVISIONS.every((other) => r.roles[other.id] === 'primary'),
        )
        .map((r) => r.sectionNumber),
    ).size;

    /**
     * Sections of this trade's own division that nobody managed to classify.
     * Absence and ignorance read identically on the review screen otherwise, and
     * they call for opposite responses: one means the scope is not in the book,
     * the other means the tool could not tell and somebody should look.
     */
    const unread = unclassified.filter((n) =>
      n.replace(/\D/g, '').startsWith(divisionPrefix),
    ).length;

    const present = distinctive >= 3;
    const note = present
      ? `${distinctive} sections of this trade's own scope.`
      : unread > 0
        ? `${unread} Division ${divisionPrefix} section${unread === 1 ? '' : 's'} could not be ` +
          `classified, so this trade cannot be judged from ${
            distinctive === 0 ? 'what was read' : `the ${distinctive} that were`
          }. Check the list rather than treating the trade as absent.`
        : distinctive === 0
          ? 'Nothing in this upload belongs to this trade.'
          : `Only ${distinctive} section${distinctive === 1 ? '' : 's'} are specific to this ` +
            'trade — thin, probably not in scope on this job. Build it only if you know otherwise.';

    return {
      id: d.id,
      name: d.name,
      primaryCount,
      supportingCount,
      present,
      uncertain: !present && unread > 0,
      note,
    };
  });

  if (!trades.some((t) => t.present)) {
    warnings.push(
      unclassified.length > 0
        ? `No trade has enough of its own sections to build a sheet from, but ${unclassified.length} ` +
          'section(s) went unclassified — so this may be a classifier failure rather than a book ' +
          'without mechanical scope. Check the list before concluding the scope is absent.'
        : 'No trade has enough of its own sections to build a sheet from. Check that the ' +
          'right division was uploaded.',
    );
  }

  return { sections: routed, trades, warnings };
}

/**
 * Match a batch's replies back onto the sections that were sent.
 *
 * By `ref` — the position the prompt gave each section — because section numbers
 * are not unique within a book. A reply that omits its ref, or gives one outside
 * the batch, falls back to matching on section number *within this batch only*,
 * each candidate used once. That fallback can still mis-seat two sections that
 * share a number inside a single batch, but it can never let a divider page a
 * hundred pages away answer for a real section.
 */
function placeEntries(
  entries: unknown[],
  batch: RouterInput[],
  offset: number,
  into: Map<number, any>,
): void {
  const leftovers: any[] = [];

  for (const raw of entries) {
    const entry = raw as any;
    const ref = Number(entry?.ref);
    if (Number.isInteger(ref) && ref >= offset && ref < offset + batch.length && !into.has(ref)) {
      into.set(ref, entry);
    } else {
      leftovers.push(entry);
    }
  }

  for (const entry of leftovers) {
    const number = typeof entry?.sectionNumber === 'string' ? entry.sectionNumber : null;
    if (!number) continue;
    const i = batch.findIndex((s, k) => s.sectionNumber === number && !into.has(offset + k));
    if (i !== -1) into.set(offset + i, entry);
  }
}
