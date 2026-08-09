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
