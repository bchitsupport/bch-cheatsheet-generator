'use client';

import { useState } from 'react';
import type { ManifestView, SectionRole } from '@/lib/types';
import type { DivisionId } from '@/lib/upload-lists';

interface Props {
  manifest: ManifestView;
  selected: DivisionId[];
  onSelectedChange: (trades: DivisionId[]) => void;
  /** Section numbers outside Divisions 22/23 the user wants read in full. */
  alsoRead: string[];
  onAlsoReadChange: (sections: string[]) => void;
  disabled?: boolean;
}

const money = (n: number) => (n < 10 ? `$${n.toFixed(2)}` : `$${n.toFixed(0)}`);

const TRADE_ORDER: DivisionId[] = ['plumbing', 'sheetmetal', 'hydronic'];
const SHORT: Record<DivisionId, string> = {
  plumbing: 'PLB',
  sheetmetal: 'SMT',
  hydronic: 'HYD',
};

function RoleMark({ role }: { role: SectionRole }) {
  if (role === 'primary') {
    return (
      <span
        title="Primary — drives this sheet"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-bch-navy text-[10px] font-bold text-white"
      >
        P
      </span>
    );
  }
  if (role === 'supporting') {
    return (
      <span
        title="Supporting — read for cross-references"
        className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-200 text-[10px] font-bold text-slate-600"
      >
        s
      </span>
    );
  }
  return <span className="text-slate-300" title="Not used on this sheet">·</span>;
}

/**
 * What the upload turned out to contain, for confirmation before anything is
 * spent. Getting a mis-split or a misfiled section in front of someone here is
 * the whole point — both are cheap to see now and expensive to discover in a
 * finished sheet.
 */
export default function ManifestReview({
  manifest,
  selected,
  onSelectedChange,
  alsoRead,
  onAlsoReadChange,
  disabled,
}: Props) {
  const [showAll, setShowAll] = useState(false);

  const toggle = (id: DivisionId) =>
    onSelectedChange(
      selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id],
    );

  const toggleRead = (n: string) =>
    onAlsoReadChange(
      alsoRead.includes(n) ? alsoRead.filter((x) => x !== n) : [...alsoRead, n],
    );

  const rows = showAll
    ? manifest.sections
    : manifest.sections.filter((s) => Object.values(s.roles).some((r) => r === 'primary'));
  const hidden = manifest.sections.length - rows.length;

  // Sections that relate to the work but sit outside the divisions read in full.
  const referred = manifest.sections.filter((s) => s.willRefer);
  const extraCost = referred
    .filter((s) => alsoRead.includes(s.sectionNumber))
    .reduce((sum, s) => sum + s.addCost, 0);

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="section-title">3 · What&rsquo;s in this upload</h2>
        <span className="text-xs text-bch-muted">
          {manifest.pageCount} pages · {manifest.sections.length} sections
          {manifest.furnitureRemoved > 0 &&
            ` · ${manifest.furnitureRemoved.toLocaleString()} chars of repeated page headers removed`}
        </span>
      </div>

      {manifest.method === 'section-lines' && (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          This book has no running header, so section boundaries were taken from its
          &ldquo;SECTION&hellip;&rdquo; lines. Check the page ranges below before building.
        </p>
      )}

      {/* ---- which sheets to build */}
      <div className="mt-4 space-y-2">
        {TRADE_ORDER.map((id) => {
          const trade = manifest.trades.find((t) => t.id === id);
          if (!trade) return null;
          const on = selected.includes(id);
          return (
            <label
              key={id}
              className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition ${
                on ? 'border-bch-accent bg-blue-50' : 'border-bch-line bg-white'
              } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(id)}
                disabled={disabled}
                className="mt-0.5 h-4 w-4"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-bold text-bch-ink">{trade.name}</span>
                  <span className="text-xs text-bch-muted">
                    {trade.primaryCount} primary · {trade.supportingCount} supporting
                  </span>
                  {!trade.present && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      not detected
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-bch-muted">{trade.note}</span>
              </span>
            </label>
          );
        })}
      </div>

      {/* ---- the sections themselves */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-bch-line text-[11px] uppercase tracking-wide text-bch-muted">
              <th className="py-2 pr-3 font-semibold">Section</th>
              {TRADE_ORDER.map((id) => (
                <th key={id} className="w-12 py-2 text-center font-semibold">
                  {SHORT[id]}
                </th>
              ))}
              <th className="w-16 py-2 text-right font-semibold">Pages</th>
              <th className="py-2 pl-3 font-semibold">What it is</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bch-line">
            {rows.map((s, i) => (
              <tr key={`${s.sectionNumber}-${s.startPage}-${i}`}>
                <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs text-bch-ink">
                  {s.sectionNumber}
                </td>
                {TRADE_ORDER.map((id) => (
                  <td key={id} className="py-2 text-center">
                    <RoleMark role={s.roles[id]} />
                  </td>
                ))}
                <td className="whitespace-nowrap py-2 text-right text-xs text-bch-muted">
                  {s.startPage !== null ? `${s.startPage}–${s.endPage}` : '—'}
                </td>
                <td className="py-2 pl-3 text-xs text-bch-ink">
                  {s.summary || s.title || '—'}
                  {s.splitWarnings.map((w) => (
                    <span key={w} className="mt-0.5 block text-[11px] text-amber-700">
                      {w}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- what this will cost, before anything is spent */}
      <div className="mt-5 rounded border border-bch-line bg-bch-bg p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-bold text-bch-ink">
            Reading {manifest.readPages} of {manifest.pageCount} pages
          </span>
          <span className="text-sm font-bold tabular-nums text-bch-navy">
            about {money(manifest.estimate.dollars + extraCost)}
          </span>
        </div>
        <p className="mt-1 text-xs text-bch-muted">
          {money(manifest.estimate.low + extraCost)}–{money(manifest.estimate.high + extraCost)} for{' '}
          {manifest.estimate.sheetCount} sheet
          {manifest.estimate.sheetCount === 1 ? '' : 's'} and their checklists. Estimated from
          measured runs; spec pages vary in density, so treat it as a range.
        </p>
      </div>

      {/* ---- related sections outside the divisions read in full */}
      {referred.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-bch-muted">
            Related, but not read — {referred.length} section
            {referred.length === 1 ? '' : 's'}
          </h3>
          <p className="mt-1 text-xs text-bch-muted">
            These sit outside Divisions 22 and 23 but bear on this work. Each is named on the
            checklist with its page range so it can be checked directly. Tick one to have it
            read in full instead.
          </p>
          <ul className="mt-2 divide-y divide-bch-line border-t border-bch-line">
            {referred.map((s) => (
              <li
                key={`${s.sectionNumber}-${s.startPage}`}
                className="flex items-start gap-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={alsoRead.includes(s.sectionNumber)}
                  onChange={() => toggleRead(s.sectionNumber)}
                  disabled={disabled}
                  aria-label={`Read section ${s.sectionNumber} in full`}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-bch-ink">{s.sectionNumber}</span>
                  <span className="ml-2 text-xs text-bch-muted">
                    {s.pageCount ?? '?'}p · pages {s.startPage ?? '?'}–{s.endPage ?? '?'}
                  </span>
                  <span className="mt-0.5 block text-xs text-bch-ink">
                    {s.summary || s.title || '—'}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-bch-muted">
                  +{money(s.addCost)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs font-semibold text-bch-accent hover:underline"
        >
          {showAll
            ? 'Show only sections that drive a sheet'
            : `Show ${hidden} supporting section${hidden === 1 ? '' : 's'} as well`}
        </button>
      )}

      <p className="mt-3 text-xs text-bch-muted">
        <strong className="text-bch-ink">P</strong> drives a sheet ·{' '}
        <strong className="text-bch-ink">s</strong> is read for cross-references and
        conflicts, but gets no section of its own. Nothing in the upload is discarded.
      </p>

      {manifest.warnings.map((w) => (
        <p
          key={w}
          className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {w}
        </p>
      ))}
    </section>
  );
}
