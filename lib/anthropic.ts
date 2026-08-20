import Anthropic from '@anthropic-ai/sdk';
import {
  CHECKLIST_CSS,
  CHECKLIST_PATTERNS,
  TEMPLATE_CSS,
  TEMPLATE_PATTERNS,
} from './template';
import type { ReferredSection } from './section-router';
import type { Discrepancy, ProjectInfo, Severity } from './types';
import type { Division } from './upload-lists';

/**
 * Sonnet tier, current model ID. The original spec named `claude-sonnet-4-6`;
 * `claude-sonnet-5` is the current Sonnet and is a drop-in for it. Override with
 * ANTHROPIC_MODEL if you want to pin a different one.
 */
/**
 * Quality is capped by where the code runs, so the defaults follow the host.
 *
 * Locally there is no function time limit, so the default is the strongest
 * configuration: Opus for the reasoning, high effort for thoroughness. On Vercel
 * the function is killed at 300s (Hobby's maximum), which that configuration
 * cannot finish inside — so a deployed run falls back to Sonnet at medium.
 *
 * Deciding this from `process.env.VERCEL` rather than requiring dashboard
 * variables means neither side can be silently misconfigured: a local run always
 * gets the best sheet, and a deploy always stays inside its ceiling. Either can
 * still be overridden with ANTHROPIC_MODEL / ANTHROPIC_EFFORT.
 */
const ON_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const MODEL =
  process.env.ANTHROPIC_MODEL ?? (ON_SERVERLESS ? 'claude-sonnet-5' : 'claude-opus-5');

/**
 * Timed on a full Division 23 job (10 sections, ~185k chars of spec text),
 * Sonnet 5:
 *
 *   medium  243s   4-page sheet    7 discrepancies
 *   high    495s   5-page sheet   11 discrepancies
 *
 * Effort drives how thoroughly the specs are cross-checked, so it is the main
 * lever on discrepancy coverage — the whole point of the checklist. Locally that
 * is worth the extra minutes; on Vercel Hobby's 300s ceiling `high` is not a
 * choice, it is a guaranteed timeout.
 *
 * On Vercel Pro (800s), set ANTHROPIC_EFFORT=high and raise `maxDuration` in
 * app/api/generate/route.ts to 800.
 */
const EFFORT = (process.env.ANTHROPIC_EFFORT ?? (ON_SERVERLESS ? 'medium' : 'high')) as
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

/**
 * Thinking + sheet HTML + checklist + discrepancy JSON all come out of one
 * budget, so this has to cover the worst case, not the typical one.
 *
 * Sized from a real failure: a 13-section Division 23 sheet (5 pages, ~19k
 * chars of visible text) produced roughly 75k characters of HTML on its own.
 * Add adaptive thinking over a 250k-character upload at effort=high and the
 * old 48k ceiling was exhausted right after the sheet closed — the checklist
 * and the discrepancy JSON were silently cut off. 128k is Sonnet's maximum and
 * costs nothing when unused: you are billed for tokens produced, not reserved.
 */
const MAX_TOKENS = 128_000;

/** Past this, coverage of the later sections starts to thin out. */
export const LARGE_INPUT_THRESHOLD = 150_000;

/**
 * Sorting sections is classification over short excerpts, not the deep read the
 * sheet needs — Sonnet does it well and returns in seconds rather than minutes,
 * which matters because a person is waiting on the review screen. Override with
 * ANTHROPIC_ROUTER_MODEL if a book ever routes badly.
 */
export const ROUTER_MODEL = process.env.ANTHROPIC_ROUTER_MODEL ?? 'claude-sonnet-5';

/**
 * Phase 1 reads each spec section into a data block, and everything downstream
 * is built from those blocks — a value missed here is missed for good, because
 * the compose pass never sees the raw spec. So it gets the strongest model,
 * not the cheap one used for sorting sections by title.
 */
export const BLOCK_MODEL = process.env.ANTHROPIC_BLOCK_MODEL ?? MODEL;

/** Published rates, $ per million tokens, for reporting run cost. */
export const RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

/** The shared client, for callers that issue their own smaller requests. */
export function getRouterClient(): Anthropic {
  return getClient();
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local for local development, ' +
        'or to the project Environment Variables in Vercel.',
    );
  }
  // A sheet is a single ten-minute call; losing one to a transient capacity blip
  // costs the whole run, so retry harder than the SDK's default of 2.
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 5 });
  return client;
}

/**
 * Retry a whole streamed call on transient server-side failures.
 *
 * The SDK's own retries cover establishing the request. They do not cover a
 * stream that opens and then dies — which is what `overloaded_error` does, and
 * it killed two of three concurrent Division 22/23 runs outright. Backoff is
 * generous because these calls are minutes long: there is no point retrying a
 * ten-minute request against a busy pool one second later.
 */
export async function withRetry<T>(label: string, run: () => Promise<T>): Promise<T> {
  const DELAYS_MS = [5_000, 15_000, 40_000, 90_000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
    try {
      return await run();
    } catch (err) {
      lastError = err;
      const text = err instanceof Error ? err.message : String(err);
      const transient =
        // `terminated` and `aborted` are what Node's fetch throws when the
        // connection drops mid-response — the same fault as ECONNRESET, under a
        // different name. A 16-minute compose died on it and was not retried,
        // throwing away the whole reading phase that preceded it.
        /overloaded|rate_limit|429|500|502|503|529|ECONNRESET|ETIMEDOUT|socket hang up|terminated|aborted|fetch failed/i.test(
          text,
        );
      if (!transient || attempt === DELAYS_MS.length) break;

      const wait = DELAYS_MS[attempt];
      console.warn(
        `[${label}] attempt ${attempt + 1} failed (${text.slice(0, 120)}) — ` +
          `retrying in ${wait / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}

export interface SpecInput {
  fileName: string;
  sectionNumber: string;
  text: string;
  /**
   * 'primary' is the trade's own scope and drives the sheet. 'supporting' is the
   * rest of the division, included so a section that governs another trade's
   * work — a shared hanger schedule, a division-wide test pressure — is not
   * silently dropped. Defaults to primary when omitted.
   */
  role?: 'primary' | 'supporting';
}

export interface ModelOutput {
  cheatsheetHtml: string;
  checklistHtml: string;
  discrepancies: Discrepancy[];
  sectionCount: number;
  /** True when the checklist needed a second call because the first ran out of budget. */
  recoveredChecklist: boolean;
}

interface ParsedBlocks {
  cheatsheetHtml: string;
  /** null when the block never arrived — do not silently substitute. */
  checklistHtml: string | null;
  discrepancies: Discrepancy[];
  /** Distinguishes "the model logged none" from "the block was never written". */
  discrepanciesFound: boolean;
}

// ---------------------------------------------------------------- system prompt

/**
 * The system prompt is deliberately free of project and division specifics.
 *
 * It is ~10k tokens of template CSS and component patterns, identical on every
 * request, so keeping it byte-stable means the prompt cache hits across every
 * job for every project. Interpolating the project name in here — as this did
 * originally — gave every project a unique prefix and a permanent cache miss
 * (observed as `cache_read=0` in the usage log). Job specifics go in the user
 * turn, after the cached prefix.
 */
function buildSystemPrompt(): string {
  return `You are building a BCH Mechanical cheat sheet. You will receive extracted
text from construction specification sections. Your job is to produce two things:

WHO READS THIS: estimators, first. They are pricing the job from these sheets, so
what governs quantity, material and scope matters most — size breaks, material by
system and location, what is included and what is somebody else's, named products
and their acceptable equals, and anything that changes a unit rate. Project
managers and installing crews read it too, so keep what governs how the work is
built. Drop what only matters to neither.

1. A complete HTML document for the cheat sheet, using the exact template and
   CSS provided below.
2. A checklist in HTML format: the discrepancy log of every conflict, gap,
   overlap and ambiguity found in the specs, followed by the GAPS block for
   anything the sheet could not answer. Nothing else — no build-verification
   table, no list of things to verify. The log is the document.

RULES:
- Include a value when someone would otherwise stop work and go look it up:
  what to install, what to order, what it costs, what is prohibited. That is a
  much narrower set than "everything the spec states" — being in the spec is not
  by itself a reason to be on the sheet.
- Exclude submittal procedures, warranty language, QA boilerplate, delivery
  and storage clauses.
- When two documents conflict, the more stringent requirement wins — and log
  the conflict.
- Consolidate rows that resolve to the same answer.
- Every value must be traceable to a spec paragraph.
- Never invent a value to fill a gap — log it as a discrepancy instead.
- If a spec defers to an industry standard (like SMACNA), say so on the sheet
  and name the standard and the parameter that selects from it.

- Never build a table whose data column is references into another document
  (figure numbers, table numbers, paragraph numbers). "Fig. 2-1 / Fig. 2-2 /
  Fig. 3-1" down a column is not information — nobody can install from it
  without that book open. When a spec defers wholesale to a standard, say it
  ONCE in a callout: name the standard, name the parameter that selects within
  it (e.g. static-pressure class), and state any thresholds the spec DOES give
  in its own words (e.g. ">60 in. dia = flanged transverse joint"). Those
  thresholds are the actionable part; the figure numbers are not. Do not repeat
  a filler phrase down a column ("Same basis", "As above") — state the shared
  rule once beneath the table instead.
- Strip all security markings and restricted-information notices from the spec
  text — none of it belongs on the cheat sheet.
- No revision labels anywhere on the sheet.

SEVERITY — RANK BY CONSEQUENCE, NOT BY HOW WRONG THE SPEC IS:
- HIGH   — the work cannot be priced or built correctly until this is answered.
           Getting it wrong means buying the wrong material, failing an
           inspection, or removing work already installed.
- MEDIUM — work can proceed on the reading the sheet shows, but the answer
           changes cost or method and has to be confirmed before it is locked
           in: before a purchase order, a submittal, or fabrication.
- LOW    — worth knowing, changes nothing that gets bought or built. Loose
           wording, a superseded standard, a cross-reference to a section that
           was not issued.

- Rank on what happens if the reader acts on the sheet and the other reading was
  the right one. A flat contradiction with no cost or code consequence is LOW.
  An ambiguity that decides a pipe material is HIGH, however politely the spec
  puts it.
- Most entries are not HIGH. If more than about a fifth are, the ranking has
  stopped telling anyone anything and everything gets read or nothing does.
- Never raise severity to draw attention to good analysis. The reader is
  triaging a long list with limited time; an inflated HIGH costs them the time
  they should have spent on a real one.

ORDER OF THE LOG:
- Sort by severity first: every HIGH, then every MEDIUM, then every LOW.
- Within a severity band, sort by spec section number ascending, so a reader
  working through one section finds its entries together.
- Number them D-01, D-02, D-03... in that final display order, with no gaps. The
  sheet cites these numbers, so they must match what someone finds when they
  look the number up.
- Do not order by the sequence the sections were supplied in. Measured on a real
  75-entry log ordered that way, high-severity entries landed at positions 18
  and 22, behind low-severity ones — nobody triaging that list finds them.

THE LOW-SEVERITY TAIL:
- Write HIGH and MEDIUM entries out in full, in the table, in the shape below.
- Do NOT write LOW entries into the table. One real log ran to 91 entries of
  which 51 were LOW — half a document describing things that, by the definition
  above, change nothing that gets bought or built. It buries the seven that do.
- Instead, close the table with one short paragraph: how many LOW items there
  were and what kinds — for example "38 low-severity items were logged: loose
  wording, superseded standard references, and cross-references to sections that
  were not issued. None changes what is bought or built. The full list is held
  with this job in the generator."
- Still emit EVERY discrepancy, LOW included, in the DISCREPANCIES JSON. The
  JSON is the complete record and is what the website shows on screen; the
  printed log is the triage view. Nothing is being discarded, only unprinted.
- If there are no LOW items, omit the paragraph rather than say "0 items".

WRITING A DISCREPANCY:
A log can run to seventy entries, and a reader skims it deciding which ones touch
them today. Every entry therefore takes the same shape, in the same order, so
they can be skimmed rather than read.

- AFFECTS column: the work in question, in a few words — "Chilled water pipe,
  1-1/4" through 2"", "Outdoor gas piping above 5 psi". Never the spec's
  structure. This is what tells a reader in one glance whether to keep reading.
- Then three labelled lines, always these three, always in this order:
    Problem —     what is wrong, in one or two plain sentences.
    Sheet shows — the reading the sheet was built on.
    Do this —     the action, as an instruction to a person.
- Write "Do this" as a command with an actor: "Price welded joints for the
  outdoor run", "Confirm the size break with the engineer before releasing
  take-off". Never "must not be released until confirmed", which hides who acts.
- Describe what the requirement IS, not how the specification is arranged.
  "The spec sets the size break twice and the two disagree" — not "§2.1.B.1
  states one range and §2.1.B.2 the next". The paragraph numbers live in the
  WHERE column, which is where a reader checks the claim against the book.
- Do not explain that a second clause "mirrors" or "repeats" the same conflict.
  Say the conflict once and name every size or system it touches.
- Keep an entry under about sixty words. Cutting words is not cutting
  information: a value, a size, a limit or a citation must never be dropped to
  make an entry shorter.

SUPPORTING SECTIONS:
Spec text arrives in two groups. PRIMARY sections are the trade's own scope and
drive the sheet. SUPPORTING sections are the rest of the division, supplied so
nothing is missed when one section governs another's work — a hanger schedule
that covers both duct and pipe, a vibration section that applies to equipment on
either side, a general-requirements section that sets test pressures for the
whole division.
- Read every supporting section. Where one changes, restricts, or overrides
  something in a primary section, put the governing requirement on the sheet and
  cite the supporting section as its source.
- Where a primary section defers to a supporting one ("as specified in Section
  23 05 29"), resolve it: state the actual requirement, not the pointer.
- A conflict between a primary and a supporting section is a discrepancy and
  goes in the log like any other, with both section numbers in WHERE.
- Do not widen the sheet's scope to cover supporting sections for their own
  sake. They earn space only where they govern the primary trade's work. A
  supporting section that never touches this trade produces nothing.

SHEET SHAPE — LENGTH IS A HARD REQUIREMENT, NOT A PREFERENCE:
- The approved reference sheet carries about 1,100 characters of visible text per
  outline section — 4 letter pages for its 10 sections. Match that density: the
  budget is per section, so a division with more sections earns proportionally
  more pages, and one with fewer earns fewer. Never pad a section to reach it.
- A recent build came back at 41,000 characters over 8 pages with the same 10
  sections: four times the text. Every value in it was accurate and it was still
  a failure. Accuracy is not the same as fitness for use.
- This is a card someone reads with a takeoff open or standing on a jobsite,
  looking for one number. It is not a summary of the specification. The test for
  a row is not "is this true" but "would someone otherwise have to stop and go
  look this up".
- LENGTH DISCIPLINE APPLIES TO THE SHEET ONLY. The checklist has no length limit.
  Depth of analysis, every conflict, every gap, all reasoning — that goes in the
  checklist, at whatever length it takes. Cutting the sheet must never mean
  finding fewer discrepancies.
- When a section runs long, cut in this order:
  1. Rows restating what anyone in the trade already knows.
  2. Approved-manufacturer lists, unless the spec names a sole source.
  3. Conditions that apply to every row — state once beneath the table.
  4. Prose notes that repeat a value already in a table cell.
  5. Secondary properties nobody checks in the field (test-method citations,
     ASTM sub-grades where the base standard is enough, packaging clauses).
- Never shrink type, tighten spacing, or edit the CSS to fit more in. The format
  is fixed. If it does not fit in 5 pages, cut content.
- The section outline is FIXED and supplied in the user message. Use exactly
  those sections, with those titles, in that order, numbered 01, 02, 03...
  Do not add, rename, reorder, merge or split them. The same specs must produce
  the same sheet skeleton every time so two sheets can be compared and a fitter
  learns where things live.
- Put content in the section the outline says it belongs to, even if you would
  have grouped it differently.
- If a section has no supporting spec content, still emit the section head, put
  a single "Not covered by the sections provided — see discrepancy log." note in
  it, and log a discrepancy naming the CSI section that would have supplied it.
  Do not silently drop it.
- Every section head carries the CSI numbers it draws from in .sec-s.
- Prefer tables over prose. A paragraph on this sheet is a failure unless it is
  a callout.
- Use .g2 / .g13 to put two short tables side by side rather than leaving a
  half-empty page.

PAGE BREAKS:
- The CSS already handles this. Do NOT add break-inside, break-before, or
  break-after declarations of your own, inline or in a <style> block.
- In particular do NOT put break-inside:avoid on .sec or on table.g. A table
  taller than the space left on the page cannot honour it, so the whole table
  jumps to the next page and leaves a half-empty one behind. Long tables are
  meant to split at a row boundary; the header repeats automatically.
- Long tables are fine. Prefer one 30-row table over three padded 10-row tables.

OUTPUT FORMAT:
Emit exactly three delimited blocks, in this order, with nothing before, between,
or after them — no preamble, no explanation, no markdown code fences:

<<<CHEATSHEET_HTML>>>
(the complete HTML document — <!DOCTYPE html> through </html>, with the full
template CSS inside a <style> block in <head>)
<<<END_CHEATSHEET_HTML>>>
<<<CHECKLIST_HTML>>>
(the complete checklist HTML document, same structure, using the checklist CSS)
<<<END_CHECKLIST_HTML>>>
<<<DISCREPANCIES_JSON>>>
(a JSON array — one object per discrepancy, same set that appears in the
checklist's discrepancy log, in the same order. Shape:
[{"id":"D-01","severity":"high|medium|low","kind":"conflict|gap|overlap|ambiguity",
  "location":"22 70 00 §3.3.I vs NFPA 54 §7.3.1",
  "affects":"Outdoor gas piping above 5 psi",
  "issue":"the Problem line, without its label",
  "resolution":"the Sheet shows and Do this lines, without their labels"}]
Emit [] if there are none.)
<<<END_DISCREPANCIES_JSON>>>

Do not write the literal text "[THE FULL TEMPLATE CSS ABOVE, VERBATIM]" or any
other placeholder into the output — paste the real CSS.

TEMPLATE CSS (use this exactly — do not modify any values):
${TEMPLATE_CSS}

TEMPLATE STRUCTURE:
${TEMPLATE_PATTERNS}

CHECKLIST CSS (use this exactly for the checklist document):
${CHECKLIST_CSS}

CHECKLIST STRUCTURE:
${CHECKLIST_PATTERNS}

The division and project details for this job arrive in the user message.`;
}

/** Job specifics — goes in the user turn so the cached system prefix stays stable. */
function buildJobHeader(division: Division, project: ProjectInfo): string {
  const orBlank = (v: string, fallback: string) => (v.trim() ? v : fallback);

  const outline = division.outline
    .map(
      (s, i) =>
        `${String(i + 1).padStart(2, '0')}  ${s.title}\n` +
        `      spec refs: ${s.sources.join(' · ')}\n` +
        `      covers:    ${s.covers}`,
    )
    .join('\n');

  return `REQUIRED SECTION OUTLINE — use exactly these, in this order:
${outline}

DIVISION: ${division.name}
BANNER TITLE: ${division.bannerTitle}
BANNER SUBTITLE: CHEAT SHEET · ${division.divisionLabel}
FOOTER DIVISION: ${division.divisionShort}
PROJECT: ${project.projectName}
PROJECT SUB: ${orBlank(project.projectSub, '(none given — omit the line)')}
PREPARER: ${project.preparerName}
PREPARER TITLE: ${orBlank(project.preparerTitle, '(none given — omit the line)')}
PREPARER EMAIL: ${orBlank(project.preparerEmail, '(none given — omit the line)')}
LEGEND DRAWING: ${orBlank(
    project.legendDrawing,
    '(none given — say "see contract drawings for legend" in the key panel)',
  )}`;
}

// ---------------------------------------------------------------- the call

/** A Phase 1 data block — one spec section, already read and structured. */
export interface ComposeBlock {
  sectionNumber: string;
  title: string | null;
  markdown: string;
}

/**
 * Raw spec sections, grouped by role. Primary first, so the sheet's backbone is
 * read before the material that qualifies it.
 */
function buildSpecText(specs: SpecInput[]): string {
  const one = (s: SpecInput, kind: string) =>
    `=== ${kind} SPEC SECTION ${s.sectionNumber} (source file: ${s.fileName}) ===\n\n${s.text}`;

  const primary = specs.filter((s) => s.role !== 'supporting');
  const supporting = specs.filter((s) => s.role === 'supporting');

  return [
    ...primary.map((s) => one(s, 'PRIMARY')),
    ...(supporting.length
      ? [
          '=== THE SECTIONS BELOW ARE SUPPORTING CONTEXT ===\n' +
            'They are the rest of the division, supplied so that a requirement governing\n' +
            "this trade's work from outside its own sections is not missed. Apply the\n" +
            'SUPPORTING SECTIONS rules.',
          ...supporting.map((s) => one(s, 'SUPPORTING')),
        ]
      : []),
  ].join('\n\n');
}

function buildBlockText(blocks: ComposeBlock[]): string {
  return blocks.map((b) => b.markdown).join('\n\n');
}

const SPEC_LEAD_IN =
  'Here are the specification sections. Generate the cheat sheet and checklist.';

/**
 * Composing from blocks is a different job from composing from raw spec, and the
 * difference is worth stating: the reading has already been done, so the work is
 * selection and layout, and the blocks are the only record of the spec that will
 * reach the sheet.
 */
const BLOCKS_LEAD_IN = `Below are DATA BLOCKS — one per specification section, each already read out of
the spec by an earlier pass. Every table, note and callout carries the paragraph
it came from.

Build the cheat sheet and checklist from these blocks.

- The blocks are now your only source. You cannot go back to the spec, so do not
  assume a value exists that no block states.
- Each block names the outline sections it feeds. Honour that, but you decide
  what actually earns space — a block offering more than fits is normal, and
  cutting is your job.
- Blocks were read one section at a time, so no block saw any other. Conflicts
  BETWEEN blocks are yours to find, and they are the most valuable entries in the
  discrepancy log: two sections giving different answers for the same size,
  pressure or condition.
- Roll up each block's own DISCREPANCIES entries into the log as well.
- A block's EXCLUDED list records what an earlier pass deliberately left out. Do
  not reinstate it without reason.`;

/**
 * Sections that relate to the trade but were not read. Naming them on the
 * checklist is the difference between a reader knowing where to look and never
 * learning the section existed — on a full project manual the fire alarm section
 * governs smoke damper interlocks, and nothing else on the sheet would say so.
 */
function buildReferredBlock(referred: ReferredSection[]): string {
  if (referred.length === 0) return '';

  const rows = referred
    .map((r) => {
      const pages =
        r.startPage !== null ? `pages ${r.startPage}-${r.endPage}` : 'page range unknown';
      return `- ${r.sectionNumber} ${r.title ?? ''} (${pages}) — ${r.summary}`;
    })
    .join('\n');

  return `

RELATED SECTIONS THAT WERE NOT READ — CONTEXT ONLY, DO NOT LIST THEM:
These sections were identified as bearing on this trade's work but sit outside
the divisions this sheet is built from, so nobody has read them. They are not
discrepancies, they do not go in any document, and you must not invent
requirements from them.

They are here for one purpose: if the sheet would otherwise state something as
complete when one of these sections plainly governs part of it, say so in the
relevant row rather than implying the sheet covers it. Otherwise ignore them.

${rows}`;
}

export async function generateSheet(
  division: Division,
  project: ProjectInfo,
  specs: SpecInput[],
): Promise<ModelOutput> {
  return composeSheet(division, project, buildSpecText(specs), SPEC_LEAD_IN, specs.length);
}

/** Phase 2 — build the sheet from Phase 1 blocks rather than raw spec text. */
export async function generateSheetFromBlocks(
  division: Division,
  project: ProjectInfo,
  blocks: ComposeBlock[],
  referred: ReferredSection[] = [],
  coverage = '',
): Promise<ModelOutput> {
  const coverageBlock = coverage
    ? `\n\nWHAT THIS UPLOAD COVERED — put this sentence in the checklist, directly under\n` +
      `the header, in the muted colour, exactly as written and with nothing added:\n\n${coverage}`
    : '';

  return composeSheet(
    division,
    project,
    buildBlockText(blocks) + buildReferredBlock(referred) + coverageBlock,
    BLOCKS_LEAD_IN,
    blocks.length,
  );
}

async function composeSheet(
  division: Division,
  project: ProjectInfo,
  bodyText: string,
  leadIn: string,
  sectionCount: number,
): Promise<ModelOutput> {
  const anthropic = getClient();

  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Adaptive thinking + effort. Cast because the SDK's published typings for
    // these two fields move faster than the pinned version; the wire shape is
    // what the API expects either way.
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        // The template CSS and patterns are ~10k tokens and identical across
        // every generation for a division. Cache them.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          `${buildJobHeader(division, project)}\n\n${leadIn}\n\n${bodyText}`,
      },
    ],
  } as unknown as Anthropic.MessageStreamParams;

  // Streaming: max_tokens is far above the ~16k point where a non-streaming
  // request risks an SDK HTTP timeout, and it keeps the Vercel function's
  // connection alive while the model works.
  const message = await withRetry('generate:sheet', () =>
    anthropic.messages.stream(params).finalMessage(),
  );

  if (message.stop_reason === 'refusal') {
    throw new Error(
      'The model declined to process these documents. If the specs contain ' +
        'security markings or restricted-information notices, remove those pages and retry.',
    );
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (!text.trim()) {
    throw new Error('The model returned an empty response. Retry the generation.');
  }

  logUsage('sheet', message);

  const parsed = parseModelOutput(text);

  // The sheet is written first, so a budget overrun truncates the checklist and
  // the discrepancy JSON while leaving a perfectly well-formed sheet behind.
  // Checking only the sheet — as this did originally — lets that through, and
  // the run then reports "0 discrepancies" when the truth is "never written".
  const sheetComplete = parsed.cheatsheetHtml.includes('</html>');

  if (!sheetComplete) {
    throw new Error(
      'The response was cut off before the sheet finished. Try again with fewer ' +
        'spec sections, or split the upload into two batches.',
    );
  }

  if (!parsed.checklistHtml || !parsed.discrepanciesFound) {
    // Salvage rather than make the user sit through another 3-minute run: ask
    // for just the two missing blocks. The system prompt is byte-identical, so
    // this is a cache read, and the output is a fraction of a full generation.
    const missing = [
      !parsed.checklistHtml ? 'checklist' : null,
      !parsed.discrepanciesFound ? 'discrepancy log' : null,
    ].filter(Boolean);

    console.warn(
      `[generate] ${missing.join(' and ')} missing from the first response ` +
        `(stop_reason=${message.stop_reason}) — requesting separately`,
    );

    const salvaged = await generateChecklistOnly(division, project, bodyText);

    return {
      cheatsheetHtml: parsed.cheatsheetHtml,
      checklistHtml: salvaged.checklistHtml ?? fallbackChecklist(),
      discrepancies: salvaged.discrepancies,
      sectionCount,
      recoveredChecklist: true,
    };
  }

  return {
    cheatsheetHtml: parsed.cheatsheetHtml,
    checklistHtml: parsed.checklistHtml,
    discrepancies: parsed.discrepancies,
    sectionCount,
    recoveredChecklist: false,
  };
}

/**
 * Second pass for the checklist and discrepancy log alone, used when the first
 * response ran out of budget after finishing the sheet. Same system prompt, so
 * the cached prefix still hits.
 */
async function generateChecklistOnly(
  division: Division,
  project: ProjectInfo,
  specText: string,
): Promise<{ checklistHtml: string | null; discrepancies: Discrepancy[] }> {
  const anthropic = getClient();

  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          `${buildJobHeader(division, project)}\n\n` +
          'Here are the specification sections. The cheat sheet has already been ' +
          'generated from them in a previous step — do NOT produce it again.\n\n' +
          'Emit ONLY these two blocks, in this order, and nothing else:\n' +
          '<<<CHECKLIST_HTML>>> ... <<<END_CHECKLIST_HTML>>>\n' +
          '<<<DISCREPANCIES_JSON>>> ... <<<END_DISCREPANCIES_JSON>>>\n\n' +
          'The discrepancy IDs must run D-01, D-02, ... in the order they appear ' +
          'in the checklist log, because the sheet already cites them by that ' +
          `number.\n\n${specText}`,
      },
    ],
  } as unknown as Anthropic.MessageStreamParams;

  const message = await withRetry('generate:checklist', () =>
    anthropic.messages.stream(params).finalMessage(),
  );
  logUsage('checklist', message);

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    checklistHtml: unfenceOrNull(block(text, 'CHECKLIST_HTML')),
    discrepancies: parseDiscrepancies(block(text, 'DISCREPANCIES_JSON')),
  };
}

/**
 * Server-side only. Without this a budget overrun is invisible — which is
 * exactly how the missing checklist went unnoticed the first time.
 */
function logUsage(label: string, message: Anthropic.Message): void {
  const u = message.usage as Anthropic.Usage & {
    cache_read_input_tokens?: number;
  };
  console.log(
    `[generate:${label}] model=${MODEL} effort=${EFFORT} ` +
      `stop_reason=${message.stop_reason} ` +
      `in=${u.input_tokens} out=${u.output_tokens} ` +
      `cache_read=${u.cache_read_input_tokens ?? 0} of max_tokens=${MAX_TOKENS}`,
  );
  if (message.stop_reason === 'max_tokens') {
    console.warn(
      `[generate:${label}] hit the ${MAX_TOKENS}-token ceiling — output was truncated`,
    );
  }
}

// ---------------------------------------------------------------- parsing

function block(text: string, name: string): string | null {
  const re = new RegExp(`<<<${name}>>>([\\s\\S]*?)<<<END_${name}>>>`);
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/** Strip a ```html / ```json fence if the model wrapped a block in one anyway. */
function unfence(s: string): string {
  const m = s.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : s;
}

function unfenceOrNull(s: string | null): string | null {
  return s ? unfence(s) : null;
}

export function parseModelOutput(raw: string): ParsedBlocks {
  let cheatsheetHtml = block(raw, 'CHEATSHEET_HTML');
  let checklistHtml = block(raw, 'CHECKLIST_HTML');
  let discrepanciesRaw = block(raw, 'DISCREPANCIES_JSON');

  // Fallback: the model wrapped everything in a JSON object instead.
  if (!cheatsheetHtml) {
    const json = tryParseJsonEnvelope(raw);
    if (json) {
      cheatsheetHtml = json.cheatsheet_html ?? null;
      checklistHtml = json.checklist_html ?? null;
      discrepanciesRaw = json.discrepancies
        ? JSON.stringify(json.discrepancies)
        : discrepanciesRaw;
    }
  }

  // Last resort: a bare HTML document with no wrapper at all.
  if (!cheatsheetHtml) {
    const html = raw.match(/<!DOCTYPE html>[\s\S]*?<\/html>/gi);
    if (html?.length) {
      cheatsheetHtml = html[0];
      checklistHtml ??= html[1] ?? null;
    }
  }

  if (!cheatsheetHtml) {
    throw new Error(
      'Could not find the cheat sheet HTML in the model response. Retry the generation.',
    );
  }

  // A checklist that arrived but never closed its </html> is a truncation too —
  // treat it as missing so the caller re-requests it rather than rendering a
  // half-written document.
  const checklist = unfenceOrNull(checklistHtml);
  const checklistUsable = checklist && checklist.includes('</html>') ? checklist : null;

  return {
    cheatsheetHtml: unfence(cheatsheetHtml),
    checklistHtml: checklistUsable,
    discrepancies: parseDiscrepancies(discrepanciesRaw),
    discrepanciesFound: discrepanciesRaw !== null,
  };
}

function tryParseJsonEnvelope(raw: string): {
  cheatsheet_html?: string;
  checklist_html?: string;
  discrepancies?: unknown;
} | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const SEVERITIES: Severity[] = ['high', 'medium', 'low'];

function parseDiscrepancies(raw: string | null): Discrepancy[] {
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(unfence(raw));
  } catch {
    // Salvage the array if there's stray prose around it.
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return [];
    try {
      data = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(data)) return [];

  return data.flatMap((item, i): Discrepancy[] => {
    if (typeof item !== 'object' || item === null) return [];
    const o = item as Record<string, unknown>;
    const severity = String(o.severity ?? 'medium').toLowerCase() as Severity;

    return [
      {
        id: str(o.id) || `D-${String(i + 1).padStart(2, '0')}`,
        severity: SEVERITIES.includes(severity) ? severity : 'medium',
        kind: str(o.kind) || 'issue',
        location: str(o.location),
        issue: str(o.issue),
        resolution: str(o.resolution),
      },
    ];
  });
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function fallbackChecklist(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Verification Checklist</title><style>${CHECKLIST_CSS}</style></head>
<body><div class="head"><h1>VERIFICATION CHECKLIST</h1></div>
<div class="box red"><h3>CHECKLIST NOT RETURNED</h3>
<p>The cheat sheet generated, but the model did not return a checklist document.
Regenerate to produce one.</p></div></body></html>`;
}
