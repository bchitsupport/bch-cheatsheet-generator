'use client';

import type { PastJob } from './types';

const KEY = 'bch-past-jobs';
const MAX_JOBS = 10;

export function loadPastJobs(): PastJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PastJob[]) : [];
  } catch {
    return [];
  }
}

/**
 * Prepend a job and keep the 10 most recent. Two PDFs as base64 run ~500KB–1MB
 * a job, so if the quota still blows we drop the oldest entries one at a time
 * rather than losing the whole history.
 */
export function savePastJob(job: PastJob): { saved: boolean; message?: string } {
  if (typeof window === 'undefined') return { saved: false };

  let jobs = [job, ...loadPastJobs()].slice(0, MAX_JOBS);

  while (jobs.length > 0) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(jobs));
      return { saved: true };
    } catch {
      if (jobs.length === 1) {
        return {
          saved: false,
          message:
            'This job was too large for browser storage and was not saved to Past Jobs. ' +
            'Download the PDFs now — they are still available on this page.',
        };
      }
      jobs = jobs.slice(0, jobs.length - 1);
    }
  }

  return { saved: false };
}

export function deletePastJob(id: string): PastJob[] {
  const remaining = loadPastJobs().filter((j) => j.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(remaining));
  } catch {
    /* nothing useful to do — the read path tolerates a stale key */
  }
  return remaining;
}

export function clearPastJobs(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function downloadBase64Pdf(base64: string, fileName: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(s: string): string {
  return (
    s
      .replace(/[^a-zA-Z0-9 _.-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'BCH-Cheat-Sheet'
  );
}
