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

export default function DiscrepancyLog({ items }: { items: Discrepancy[] }) {
  const [open, setOpen] = useState(false);

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
            ({items.length} {items.length === 1 ? 'entry' : 'entries'})
          </span>
        </span>
        <span aria-hidden="true" className="text-bch-muted">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul className="mt-3 space-y-3">
          {items.map((d) => (
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

              {d.issue && <p className="mt-2 text-sm leading-relaxed">{d.issue}</p>}
              {d.resolution && (
                <p className="mt-2 text-sm leading-relaxed text-bch-muted">
                  <span className="font-semibold text-bch-ink">Resolved to: </span>
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
