/**
 * What a build will cost, worked out before it runs.
 *
 * There is no spend cap on the account by design — a cap that halts a build
 * halfway wastes everything already spent on it. So this estimate is the only
 * thing standing between someone and an unexpected bill, and it is built from
 * measured runs rather than guesswork.
 *
 * The measurements, both on Opus at high effort:
 *
 *   Phase 1, Carrollwood Division 23 — 246 pages of spec across 29 sections
 *   produced 340,932 input and 171,646 output tokens.
 *
 *   Phase 2, one sheet — 93,241 input and 58,439 output tokens, averaged over
 *   four composes that ranged from 92,840 to 110,165 input.
 *
 * Spec pages vary in density and composes vary with how many blocks a sheet
 * draws on, so this is reported as a range, never a figure.
 */
import { RATES } from './anthropic';

const PHASE1_INPUT_PER_PAGE = 1_386;
const PHASE1_OUTPUT_PER_PAGE = 698;
const COMPOSE_INPUT_PER_SHEET = 93_241;
const COMPOSE_OUTPUT_PER_SHEET = 58_439;

/** Observed spread across measured runs, applied either side of the estimate. */
const SPREAD = 0.3;

export interface CostEstimate {
  readPages: number;
  sheetCount: number;
  inputTokens: number;
  outputTokens: number;
  /** Central estimate, US dollars. */
  dollars: number;
  low: number;
  high: number;
  model: string;
}

export function estimateBuildCost(
  readPages: number,
  sheetCount: number,
  model: string,
): CostEstimate {
  const inputTokens = readPages * PHASE1_INPUT_PER_PAGE + sheetCount * COMPOSE_INPUT_PER_SHEET;
  const outputTokens = readPages * PHASE1_OUTPUT_PER_PAGE + sheetCount * COMPOSE_OUTPUT_PER_SHEET;

  const rate = RATES[model] ?? RATES['claude-opus-5'];
  const dollars = (inputTokens * rate.input + outputTokens * rate.output) / 1_000_000;

  return {
    readPages,
    sheetCount,
    inputTokens,
    outputTokens,
    dollars,
    low: dollars * (1 - SPREAD),
    high: dollars * (1 + SPREAD),
    model,
  };
}

/** What adding one more section to the reading list costs. */
export function estimateSectionCost(pages: number, model: string): number {
  const rate = RATES[model] ?? RATES['claude-opus-5'];
  return (
    (pages * PHASE1_INPUT_PER_PAGE * rate.input + pages * PHASE1_OUTPUT_PER_PAGE * rate.output) /
    1_000_000
  );
}
