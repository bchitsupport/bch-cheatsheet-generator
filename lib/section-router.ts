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
import { getRouterClient, ROUTER_MODEL } from './anthropic';
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

  return (
    `This upload contained ${builtNames} specifications. No ${absent
      .map((t) => t.name)
      .join(' or ')} sections were found in it, so no sheet was built for ` +
    `${absent.length === 1 ? 'that trade' : 'those trades'}. If that scope exists on this ` +
    'job, its specification was not part of what was uploaded.'
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
 * `locate` supplies page numbers, which are the whole value of a pointer: an
 * entry saying "28 46 00, pages 1590-1607" can be acted on; one saying
 * "28 46 00" cannot, in a book this size.
 */
export function planReading<T extends { sectionNumber: string }>(
  manifest: Manifest,
  trades: DivisionId[],
  sources: T[],
  locate: (n: string) => { startPage: number | null; endPage: number | null },
  /** Sections the user asked to have read in full despite the division filter. */
  alsoRead: ReadonlySet<string> = new Set(),
): ReadingPlan<T> {
  const referred = { plumbing: [], sheetmetal: [], hydronic: [] } as ReadingPlan<T>['referred'];
  const readNumbers = new Set<string>();

  for (const section of manifest.sections) {
    const roles = trades.map((t) => [t, section.roles[t]] as const).filter(([, r]) => r !== 'none');
    if (roles.length === 0) continue;

    const inReadDivision = READ_DIVISIONS.has(divisionOf(section.sectionNumber));
    const primaryForSomething = roles.some(([, r]) => r === 'primary');

    if (inReadDivision || primaryForSomething || alsoRead.has(section.sectionNumber)) {
      readNumbers.add(section.sectionNumber);
      continue;
    }

    if (ADMINISTRATIVE_DIVISIONS.has(divisionOf(section.sectionNumber))) continue;

    const where = locate(section.sectionNumber);
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
  }

  for (const trade of Object.keys(referred) as DivisionId[]) {
    referred[trade].sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
  }

  return { toRead: sources.filter((s) => readNumbers.has(s.sectionNumber)), referred };
}

export interface RouterInput {
  sectionNumber: string;
  title: string | null;
  text: string;
}

/** Enough of a section to tell what it is without paying for the whole thing. */
const EXCERPT_CHARS = 900;

function buildPrompt(sections: RouterInput[]): string {
  const outlines = DIVISIONS.map(
    (d) =>
      `${d.id} — ${d.name}\n` +
      d.outline.map((s, i) => `  ${String(i + 1).padStart(2, '0')} ${s.title}`).join('\n'),
  ).join('\n\n');

  const list = sections
    .map(
      (s) =>
        `--- ${s.sectionNumber} — ${s.title ?? '(no title)'} ---\n` +
        s.text.slice(0, EXCERPT_CHARS).replace(/\s+/g, ' ').trim(),
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
- Every "primary" needs at least one target outline section, named exactly as
  written above.

Return ONLY JSON between the markers, no commentary:

<<<MANIFEST_JSON>>>
[
  {
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

export async function buildManifest(sections: RouterInput[]): Promise<Manifest> {
  if (sections.length === 0) {
    return { sections: [], trades: [], warnings: ['No sections to route.'] };
  }

  const client = getRouterClient();
  // A big book is ~30 sections, each costing a summary line plus its targets.
  // 16k ran out on a 29-section division and the closing marker never arrived.
  // Streamed because the SDK refuses a non-streaming request whose token budget
  // could take it past ten minutes, whatever it actually ends up using.
  const message = await client.messages
    .stream({
      model: ROUTER_MODEL,
      max_tokens: 48_000,
      messages: [{ role: 'user', content: buildPrompt(sections) }],
    } as Anthropic.MessageStreamParams)
    .finalMessage();

  const raw = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const warnings: string[] = [];
  if (message.stop_reason === 'max_tokens') {
    warnings.push(
      'The classifier hit its output limit, so the later sections may be missing from ' +
        'the manifest. Anything unclassified is treated as supporting everywhere — check ' +
        'the list before generating.',
    );
  }
  let entries: unknown[];
  try {
    entries = parseManifest(raw);
  } catch (err) {
    throw new Error(
      `Could not read the section manifest: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const byNumber = new Map(entries.map((e) => [(e as any)?.sectionNumber, e as any]));

  const routed: RoutedSection[] = sections.map((s) => {
    const entry = byNumber.get(s.sectionNumber);
    const roles: Record<DivisionId, Role> = {
      plumbing: 'none',
      sheetmetal: 'none',
      hydronic: 'none',
    };
    const targets: RoutedSection['targets'] = {};

    if (!entry) {
      warnings.push(`${s.sectionNumber} was not classified — treating it as supporting everywhere.`);
      roles.plumbing = roles.sheetmetal = roles.hydronic = 'supporting';
    } else {
      for (const id of Object.keys(roles) as DivisionId[]) {
        const value = entry.roles?.[id];
        roles[id] = isRole(value) ? value : 'none';
        const t = entry.targets?.[id];
        if (roles[id] === 'primary') {
          const valid = Array.isArray(t)
            ? t.filter((x: unknown) => typeof x === 'string')
            : [];
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
     */
    const divisionPrefix = d.divisionShort.replace(/\D/g, '');
    const distinctive = routed.filter(
      (r) =>
        r.roles[d.id] === 'primary' &&
        r.sectionNumber.replace(/\D/g, '').startsWith(divisionPrefix) &&
        !DIVISIONS.every((other) => r.roles[other.id] === 'primary'),
    ).length;

    const present = distinctive >= 3;
    const note = present
      ? `${distinctive} sections of this trade's own scope.`
      : distinctive === 0
        ? 'Nothing in this upload belongs to this trade.'
        : `Only ${distinctive} section${distinctive === 1 ? '' : 's'} are specific to this ` +
          'trade — thin, probably not in scope on this job. Build it only if you know otherwise.';

    return { id: d.id, name: d.name, primaryCount, supportingCount, present, note };
  });

  if (!trades.some((t) => t.present)) {
    warnings.push(
      'No trade has enough of its own sections to build a sheet from. Check that the ' +
        'right division was uploaded.',
    );
  }

  return { sections: routed, trades, warnings };
}
