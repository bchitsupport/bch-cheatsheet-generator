'use client';

import { useState } from 'react';
import type { Discrepancy, Severity } from '@/lib/types';

const SEVERITY_STYLE: Record<Severity, string> = {
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-blue-100 text-blue-800',
};

export function severityCounts(items: Discrepancy[]): Record<Severity, number> {
  return items.reduce(
    (acc, d) => {
      acc[d.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  );
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export default function DiscrepancyLog({ items }: { items: Discrepancy[] }) {
  const [open, setOpen] = useState(false);

  // The model is told to emit these highest-severity-first, but sorting here as
  // well means a log that came back in another order still reads correctly on
  // screen — and an older saved job renders the same way as a new one.
  // The printed checklist carries high and medium only; this is where the low
  // tail is "available in full on request", so the count is worth stating.
  const lowCount = items.filter((d) => d.severity === 'low').length;

  const sorted = [...items].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      (a.location ?? '').localeCompare(b.location ?? ''),
  );

  if (items.length === 0) {
    return (
      <p className="text-sm text-bch-muted">
        No conflicts, gaps, or ambiguities were logged for these sections.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-bch-line bg-slate-50 px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-100"
      >
        <span>
          Discrepancy log
          <span className="ml-2 font-normal text-bch-muted">
            ({items.length} {items.length === 1 ? 'entry' : 'entries'}
            {lowCount > 0 && `, incl. ${lowCount} low not printed on the PDF`})
          </span>
        </span>
        <span aria-hidden="true" className="text-bch-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-3">
          {sorted.map((d) => (
            <li key={d.id} className="rounded-md border border-bch-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-bch-navy">{d.id}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${SEVERITY_STYLE[d.severity]}`}
                >
                  {d.severity}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {d.kind}
                </span>
                {d.location && (
                  <span className="font-mono text-xs text-bch-muted">{d.location}</span>
                )}
              </div>

              {d.affects && (
                <p className="mt-2 text-sm font-semibold text-bch-ink">{d.affects}</p>
              )}
              {d.issue && <p className="mt-1 text-sm leading-relaxed">{d.issue}</p>}
              {d.resolution && (
                <p className="mt-2 text-sm leading-relaxed text-bch-muted">
                  <span className="font-semibold text-bch-ink">Sheet shows / do this: </span>
                  {d.resolution}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
