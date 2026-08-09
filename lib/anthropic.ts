import Anthropic from '@anthropic-ai/sdk';
import {
  CHECKLIST_CSS,
  CHECKLIST_PATTERNS,
  TEMPLATE_CSS,
  TEMPLATE_PATTERNS,
} from './template';
import type { Discrepancy, ProjectInfo, Severity } from './types';
import type { Division } from './upload-lists';

/**
 * Sonnet tier, current model ID. The original spec named `claude-sonnet-4-6`;
 * `claude-sonnet-5` is the current Sonnet and is a drop-in for it. Override with
 * ANTHROPIC_MODEL if you want to pin a different one.
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5';

/**
 * Defaults to `medium`, not `high`, because the deployment target cannot run
 * `high` at all.
 *
 * Timed on a full Division 23 job (10 sections, ~185k chars of spec text):
 *
 *   medium  243s   4-page sheet    7 discrepancies
 *   high    495s   5-page sheet   11 discrepancies
 *
 * Vercel Hobby's function ceiling is 300s — its maximum, not a raisable default —
 * so `high` is not a choice there, it is a guaranteed timeout. `medium` finds
 * fewer conflicts, which is a real cost on a document whose job is finding
 * conflicts. On Vercel Pro (800s), set ANTHROPIC_EFFORT=high and raise
 * `maxDuration` in app/api/generate/route.ts to 800.
 */
const EFFORT = (process.env.ANTHROPIC_EFFORT ?? 'medium') as
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

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to .env.local for local development, ' +
        'or to the project Environment Variables in Vercel.',
    );
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface SpecInput {
  fileName: string;
  sectionNumber: string;
  text: string;
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
  return `You are building a BCH Mechanical field cheat sheet. You will receive extracted
text from construction specification sections. Your job is to produce two things:

1. A complete HTML document for the cheat sheet, using the exact template and
   CSS provided below.
2. A checklist in HTML format containing: build verification results, and a
   discrepancy log of every conflict, gap, overlap, and ambiguity found in the
   specs.

RULES:
- Include anything that changes what a fitter installs or orders, or what an
  estimator prices.
- Exclude submittal procedures, warranty language, QA boilerplate, delivery
  and storage clauses.
- When two documents conflict, the more stringent requirement wins — and log
  the conflict.
- Consolidate rows that resolve to the same answer.
- Every value must be traceable to a spec paragraph.
- Never invent a value to fill a gap — log it as a discrepancy instead.
- If a spec defers to an industry standard (like SMACNA), say so on the sheet
  and name the standard and the parameter that selects from it.
- Strip all security markings and restricted-information notices from the spec
  text — none of it belongs on the cheat sheet.
- No revision labels anywhere on the sheet.

SHEET SHAPE:
- Target 3 to 5 letter pages of dense, tabular content.
- Number sections 01, 02, 03... in install order: materials, joints, hangers,
  insulation, then the system-specific sections, then identification, then
  testing.
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
  "location":"22 70 00 §3.3.I vs NFPA 54 §7.3.1","issue":"...","resolution":"..."}]
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
  return `DIVISION: ${division.name}
BANNER TITLE: ${division.bannerTitle}
BANNER SUBTITLE: FIELD CHEAT SHEET · ${division.divisionLabel}
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

export async function generateSheet(
  division: Division,
  project: ProjectInfo,
  specs: SpecInput[],
): Promise<ModelOutput> {
  const anthropic = getClient();

  const specText = specs
    .map(
      (s) =>
        `=== SPEC SECTION ${s.sectionNumber} (source file: ${s.fileName}) ===\n\n${s.text}`,
    )
    .join('\n\n');

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
          `${buildJobHeader(division, project)}\n\n` +
          `Here are the specification sections. Generate the cheat sheet and checklist.\n\n${specText}`,
      },
    ],
  } as unknown as Anthropic.MessageStreamParams;

  // Streaming: max_tokens is far above the ~16k point where a non-streaming
  // request risks an SDK HTTP timeout, and it keeps the Vercel function's
  // connection alive while the model works.
  const stream = anthropic.messages.stream(params);

  const message = await stream.finalMessage();

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

    const salvaged = await generateChecklistOnly(division, project, specText);

    return {
      cheatsheetHtml: parsed.cheatsheetHtml,
      checklistHtml: salvaged.checklistHtml ?? fallbackChecklist(),
      discrepancies: salvaged.discrepancies,
      sectionCount: specs.length,
      recoveredChecklist: true,
    };
  }

  return {
    cheatsheetHtml: parsed.cheatsheetHtml,
    checklistHtml: parsed.checklistHtml,
    discrepancies: parsed.discrepancies,
    sectionCount: specs.length,
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

  const message = await anthropic.messages.stream(params).finalMessage();
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
    `[generate:${label}] stop_reason=${message.stop_reason} ` +
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
