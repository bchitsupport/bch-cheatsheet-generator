'use client';

import { useState } from 'react';
import { DIVISIONS, type DivisionId } from '@/lib/upload-lists';

const WALKTHROUGH = [
  {
    title: 'Pull the spec sections out of Procore',
    body: 'Procore → Documents (or Specifications) → open the project spec book. Expand the division folder, tick the sections on the list below, and use Download → Selected. If the spec book is one combined PDF, open it, use the bookmark panel to find each section, and export those page ranges individually — one PDF per section.',
  },
  {
    title: 'Pick your division',
    body: 'Click one of the three cards on the New Sheet page. The required-sections list underneath the drop zone changes to match, and any files you had already uploaded are cleared — a section number means something different in each list.',
  },
  {
    title: 'Fill in the project info',
    body: 'Project name and preparer name are required. The rest fills out the banner: sub-line ("AIRSIDE D / CCBS"), your title and email, and the drawing the abbreviations come from ("AD-M001").',
  },
  {
    title: 'Drop the PDFs in',
    body: 'Drag all of them at once. Each file gets read as it lands and its CSI number is matched against the list. Green checks mean matched, "missing" means still needed. Anything that is not on the list is kept but tagged "not needed — will skip".',
  },
  {
    title: 'Generate',
    body: 'The button unlocks once every required section is checked off and the two required fields are filled. Expect 60–180 seconds. The progress list shows which stage it is on.',
  },
  {
    title: 'Check the checklist before you distribute',
    body: 'The checklist PDF is the audit trail: which sections were read, what conflicts were found, how each was resolved, and what the specs never answered. Read the high-severity entries before anyone works off the sheet.',
  },
];

export default function HowToUsePage() {
  const [active, setActive] = useState<DivisionId>('plumbing');
  const division = DIVISIONS.find((d) => d.id === active)!;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-bch-navy">How to Use</h1>
        <p className="mt-1 text-sm text-bch-muted">
          What to upload for each division, what to leave out, and how to get the specs
          out of Procore.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Division"
        className="mb-6 flex flex-wrap gap-2 border-b border-bch-line"
      >
        {DIVISIONS.map((d) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={active === d.id}
            onClick={() => setActive(d.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active === d.id
                ? 'border-bch-accent text-bch-accent'
                : 'border-transparent text-bch-muted hover:text-bch-ink'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">
            Upload these — {division.divisionLabel}
          </h2>
          <p className="mt-1 text-xs text-bch-muted">
            All {division.tier1.length} are required. The Generate button stays locked
            until every one is checked off.
          </p>

          <ul className="mt-4 divide-y divide-bch-line rounded-md border border-bch-line">
            {division.tier1.map((s) => (
              <li key={s.number} className="flex gap-3 px-3 py-2 text-sm">
                <span className="w-[76px] shrink-0 font-mono text-xs text-bch-muted">
                  {s.number}
                </span>
                <span>{s.title}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">Skip these — and why</h2>
          <p className="mt-1 text-xs text-bch-muted">
            These usually ship in the same division folder. Uploading them costs
            generation time and dilutes the sections that matter.
          </p>

          <ul className="mt-4 space-y-3">
            {division.skip.map((s) => (
              <li key={s.section} className="rounded-md bg-slate-50 px-3 py-2.5">
                <div className="text-sm font-medium">{s.section}</div>
                <div className="mt-0.5 text-xs text-bch-muted">{s.why}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-bch-navy">Step by step</h2>

          <ol className="mt-4 space-y-5">
            {WALKTHROUGH.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bch-navy text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{step.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-bch-muted">
                    {step.body}
                  </p>
                  <div className="mt-2 flex h-24 items-center justify-center rounded-md border border-dashed border-bch-line bg-slate-50 text-xs text-slate-400">
                    screenshot placeholder
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="card border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-900">If something goes wrong</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-900">
            <li>
              <b>&ldquo;No text found — looks like a scanned PDF.&rdquo;</b> The section was
              scanned rather than exported. Run OCR on it (Acrobat → Scan &amp; OCR →
              Recognize Text) and upload again.
            </li>
            <li>
              <b>A section stays &ldquo;missing&rdquo; even though you uploaded it.</b> The
              CSI number could not be read off page 1 — usually a cover sheet in front of
              the section. Delete the cover page and re-upload.
            </li>
            <li>
              <b>The sheet looks thin in the later sections.</b> Too much spec text in one
              batch. Split into two runs and combine the PDFs afterward.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
