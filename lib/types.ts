import type { DivisionId } from './upload-lists';

export interface ProjectInfo {
  projectName: string;
  projectSub: string;
  preparerName: string;
  preparerTitle: string;
  preparerEmail: string;
  legendDrawing: string;
}

export const EMPTY_PROJECT: ProjectInfo = {
  projectName: '',
  projectSub: '',
  preparerName: '',
  preparerTitle: '',
  preparerEmail: '',
  legendDrawing: '',
};

/** One uploaded PDF after text extraction and section matching. */
export interface ExtractedFile {
  id: string;
  fileName: string;
  /** CSI number found on page 1, or null if none could be read. */
  sectionNumber: string | null;
  /** Matched Tier 1 section number, or null if the file isn't on the list. */
  matchedSection: string | null;
  title: string | null;
  pageCount: number;
  charCount: number;
  text: string;
  /** Set when extraction failed; the file is kept but excluded from generation. */
  error?: string;
}

export type MatchStatus = 'matched' | 'missing';

export interface SectionMatch {
  number: string;
  title: string;
  status: MatchStatus;
  fileName?: string;
}

export type Severity = 'high' | 'medium' | 'low';

export interface Discrepancy {
  id: string;
  severity: Severity;
  /** Free text: "conflict", "gap", "overlap", "ambiguity". */
  kind: string;
  /** Where it lives — spec paragraph references. */
  location: string;
  /** The work in question, in a few words — what a reader scans to decide relevance. */
  affects?: string;
  issue: string;
  resolution: string;
}

export interface GenerationResult {
  cheatsheetPdf: string; // base64
  checklistPdf: string; // base64
  sectionCount: number;
  pageCount: number;
  discrepancies: Discrepancy[];
  /** Non-fatal warnings surfaced to the user (skipped files, oversize input). */
  warnings: string[];
}

export const PROGRESS_STEPS = [
  { key: 'extract', label: 'Extracting text from PDFs' },
  { key: 'read', label: 'Reading specifications' },
  { key: 'generate', label: 'Generating cheat sheet' },
  { key: 'render', label: 'Rendering PDF' },
  { key: 'checklist', label: 'Building checklist' },
] as const;

export type ProgressStepKey = (typeof PROGRESS_STEPS)[number]['key'];

/** NDJSON frames streamed from POST /api/generate. */
export type GenerateEvent =
  | { type: 'step'; step: ProgressStepKey }
  | { type: 'warning'; message: string }
  /**
   * Emitted every few seconds while the model is working. The generation step
   * produces no output of its own for minutes at a time, and a stream that goes
   * silent that long gets dropped by proxies between the browser and the
   * function — observed as an ECONNRESET ~40s into a live request. These frames
   * keep bytes flowing and drive the elapsed-time readout.
   */
  | { type: 'heartbeat'; elapsedMs: number }
  | { type: 'done'; result: GenerationResult }
  | { type: 'error'; message: string };

// ─────────────────────────────────────────── the split/identify/build pipeline

export type SectionRole = 'primary' | 'supporting' | 'none';

/** One spec section as the review screen shows it. */
export interface RoutedSectionView {
  sectionNumber: string;
  title: string | null;
  summary: string;
  charCount: number;
  roles: Record<DivisionId, SectionRole>;
  targets: Partial<Record<DivisionId, string[]>>;
  startPage: number | null;
  endPage: number | null;
  pageCount: number | null;
  splitWarnings: string[];
  /** False for a related section outside Divisions 22/23 — pointed at, not read. */
  willRead: boolean;
  /** True when this section will be named on the checklist as related-but-unread. */
  willRefer: boolean;
  /** What reading it anyway would add, in dollars. Zero when already read. */
  addCost: number;
}

export interface TradePresenceView {
  id: DivisionId;
  name: string;
  primaryCount: number;
  supportingCount: number;
  present: boolean;
  /** Not present because sections of this division could not be classified. */
  uncertain: boolean;
  note: string;
}

export interface CostEstimateView {
  readPages: number;
  sheetCount: number;
  dollars: number;
  low: number;
  high: number;
  model: string;
}

export interface ManifestView {
  sections: RoutedSectionView[];
  trades: TradePresenceView[];
  pageCount: number;
  method: 'running-header' | 'section-lines' | 'none';
  furnitureRemoved: number;
  /** Pages that will actually be read, as against the upload's total. */
  readPages: number;
  estimate: CostEstimateView;
  warnings: string[];
}

export interface BuiltSheet {
  trade: DivisionId;
  name: string;
  cheatsheetPdf: string; // base64
  checklistPdf: string; // base64
  pageCount: number;
  blockCount: number;
  discrepancies: Discrepancy[];
  recoveredChecklist: boolean;
}

export const BUILD_STEPS = [
  { key: 'split', label: 'Splitting the book into sections' },
  { key: 'identify', label: 'Working out what each section is' },
  { key: 'read', label: 'Reading every section' },
  { key: 'compose', label: 'Writing the sheets' },
] as const;

export type BuildStepKey = (typeof BUILD_STEPS)[number]['key'];

/** NDJSON frames streamed from POST /api/build. */
export type BuildEvent =
  | { type: 'step'; step: BuildStepKey; trade?: DivisionId; total?: number }
  | { type: 'manifest' } & Partial<ManifestView>
  | { type: 'awaiting-selection' }
  | { type: 'progress'; done: number; total: number; sectionNumber: string }
  | {
      type: 'usage';
      phase: 'read';
      model: string;
      sections: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      dollars: number;
    }
  | { type: 'warning'; message: string }
  | { type: 'heartbeat'; elapsedMs: number }
  | ({ type: 'sheet' } & BuiltSheet)
  | { type: 'done'; elapsedMs: number }
  | { type: 'error'; message: string };

export interface PastJob {
  id: string;
  projectName: string;
  projectSub: string;
  division: DivisionId;
  divisionName: string;
  date: string; // ISO
  pageCount: number;
  discrepancyCount: number;
  cheatsheetPdf: string; // base64
  checklistPdf: string; // base64
}
