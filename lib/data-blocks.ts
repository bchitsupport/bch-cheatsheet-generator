/**
 * Phase 1 — read one spec section, in isolation, into a data block.
 *
 * The single-pass build asks one call to hold a whole division in mind while
 * writing a fixed outline, and material at the edges gets skimmed. That is not a
 * context-size problem: on a Division 23 book the 48,000-character testing and
 * balancing section and the 42,000-character water treatment section were both
 * sitting in the model's context and were simply never used. The sheet titled
 * CHEMICAL TREATMENT did not cite the chemical treatment spec.
 *
 * So each section gets its own call. Nothing competes for attention, and there
 * is no point past which coverage falls off, because no call ever sees more than
 * one section.
 *
 * Blocks are built once per section and reused by every sheet that section feeds,
 * which is what makes reading a whole division for two sheets affordable — and
 * what makes the two sheets agree with each other.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { getRouterClient, withRetry } from './anthropic';
import type { DivisionId } from './upload-lists';

/** Concurrent Phase 1 calls. Three at once drew overloaded_error from the API. */
const CONCURRENCY = 6;

export interface BlockRequest {
  sectionNumber: string;
  title: string | null;
  text: string;
  /** Outline sections this feeds, per sheet — empty when purely supporting. */
  targets: Partial<Record<DivisionId, string[]>>;
  /** Sheets this section is supporting for. */
  supportingFor: DivisionId[];
}

export interface DataBlock {
  sectionNumber: string;
  title: string | null;
  markdown: string;
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache hits. The system prefix is identical across every section. */
  cacheReadTokens: number;
  truncated: boolean;
  error?: string;
}

const SYSTEM = `You read one section of a construction specification and write a DATA BLOCK:
the structured intermediate a field cheat sheet is later assembled from.

You are NOT writing the sheet. You are pulling out everything that could belong on
one, with its citation, so a later pass can lay it out without going back to the
spec.

WHAT BELONGS
- Values someone would otherwise stop work to look up: what to install, what to
  order, what it costs, what is prohibited.
- Sizes, pressures, temperatures, thicknesses, spacings, slopes, materials,
  joint methods, test media and durations, tolerances, clearances.
- Prohibitions and "shall not" requirements — these matter as much as the values.
- Approved manufacturers where the spec names them.

WHAT DOES NOT
- Submittal procedures, warranty language, QA boilerplate, delivery and storage.
- Anything you cannot cite to a paragraph.

RULES
- Every table and note carries a "source:" line naming the paragraph.
- Never invent a value to fill a gap. Silence is a DISCREPANCIES entry.
- One row per distinct requirement. Consolidate rows that resolve to the same
  answer and record the consolidation under EXCLUDED.
- Mark which columns hold dimensions, pressures or standards designations — they
  render in a mono font later.
- Quote thresholds in the spec's own words. Never build a table whose data column
  is references into another document (figure or table numbers); instead name the
  standard once and state the thresholds the spec itself gives.
- EXCLUDED is not optional. It is how a reviewer confirms nothing was dropped.
- Strip security markings and restricted-information notices.

FORMAT — output exactly this, no preamble:

## DATA BLOCK — [spec number] [spec title]
**Feeds:** [sheet: outline section, ...  or "supporting only"]
**Source:** [spec section number]

### TABLE: [table name]
| Col | Col | Col |
|---|---|---|
| value | value | value |

- source: §[paragraph]
- mono: [which columns]

### NOTE: [what it attaches to]
[text]
- source: §[paragraph]

### CALLOUT: [heading] — [RED | NEUTRAL]
- [bullet]
- source: §[paragraph]

### DISCREPANCIES
- [OVERLAP | GAP | CONFLICT | AMBIGUOUS | STALE] §[para] vs §[para] — [what
  conflicts] — [recommended resolution]

### EXCLUDED
- [what was left out, and why]

Use RED callouts only for things that stop work or fail inspection. Omit any
heading that has no content — except EXCLUDED, which is always present.`;

function buildUserTurn(req: BlockRequest): string {
  const feeds = Object.entries(req.targets)
    .filter(([, list]) => list && list.length)
    .map(([sheet, list]) => `${sheet}: ${list!.join(', ')}`)
    .join('  |  ');

  const supporting = req.supportingFor.length
    ? `\nThis section is also SUPPORTING for: ${req.supportingFor.join(', ')}. ` +
      'Capture anything in it that governs, restricts or qualifies those trades\' work — ' +
      'shared supports, division-wide test pressures, access and coordination requirements — ' +
      'even where it is not that trade\'s own scope.'
    : '';

  const role = feeds
    ? `This section feeds these cheat-sheet outline sections:\n  ${feeds}`
    : 'This section is supporting context only — it does not drive a sheet section of its own. ' +
      'Capture only what governs another trade\'s work, and keep it short.';

  return `${role}${supporting}

SPEC SECTION ${req.sectionNumber}${req.title ? ` — ${req.title}` : ''}

${req.text}`;
}

async function extractOne(req: BlockRequest, model: string): Promise<DataBlock> {
  try {
    const message = await withRetry(`block:${req.sectionNumber}`, () =>
      getRouterClient()
        .messages.stream({
          model,
          // 16k truncated the 10-page valve section, which is a mid-sized one.
          // A block is cheap when unused — you pay for tokens produced.
          max_tokens: 32_000,
          system: [
            // Byte-stable across every section so the prefix caches after the
            // first call — this runs 30 times per book.
            { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
          ],
          messages: [{ role: 'user', content: buildUserTurn(req) }],
        } as unknown as Anthropic.MessageStreamParams)
        .finalMessage(),
    );

    const markdown = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return {
      sectionNumber: req.sectionNumber,
      title: req.title,
      markdown,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      truncated: message.stop_reason === 'max_tokens',
    };
  } catch (err) {
    return {
      sectionNumber: req.sectionNumber,
      title: req.title,
      markdown: '',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      truncated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export interface BlockProgress {
  done: number;
  total: number;
  sectionNumber: string;
}

/**
 * What the reading phase cost, totalled.
 *
 * Composes have always logged their tokens; the block calls did not, which meant
 * two thirds of a run's cost was invisible. With no spend cap on the account the
 * pre-build estimate is the only guard against a surprise, and an estimate that
 * cannot be checked against a real number is not a guard.
 */
export interface BlockUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  calls: number;
  failed: number;
  truncated: number;
}

export function totalBlockUsage(blocks: DataBlock[]): BlockUsage {
  return blocks.reduce<BlockUsage>(
    (acc, b) => ({
      inputTokens: acc.inputTokens + b.inputTokens,
      outputTokens: acc.outputTokens + b.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + b.cacheReadTokens,
      calls: acc.calls + 1,
      failed: acc.failed + (b.error ? 1 : 0),
      truncated: acc.truncated + (b.truncated ? 1 : 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0, failed: 0, truncated: 0 },
  );
}

/**
 * Build every block, a few at a time. Sections vary from 2 to 20 pages, so a
 * fixed-size pool keeps the long ones from serialising behind each other while
 * staying under the concurrency that drew overload errors.
 */
export async function extractDataBlocks(
  requests: BlockRequest[],
  model: string,
  onProgress?: (p: BlockProgress) => void,
): Promise<DataBlock[]> {
  const results: DataBlock[] = new Array(requests.length);
  let next = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= requests.length) return;
      results[i] = await extractOne(requests[i], model);
      done++;
      onProgress?.({ done, total: requests.length, sectionNumber: requests[i].sectionNumber });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, requests.length) }, worker),
  );

  const usage = totalBlockUsage(results);
  console.log(
    `[blocks] model=${model} sections=${usage.calls} in=${usage.inputTokens} ` +
      `out=${usage.outputTokens} cache_read=${usage.cacheReadTokens}` +
      (usage.failed ? ` failed=${usage.failed}` : '') +
      (usage.truncated ? ` truncated=${usage.truncated}` : ''),
  );

  return results;
}
