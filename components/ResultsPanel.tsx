'use client';

import DiscrepancyLog, { severityCounts } from '@/components/DiscrepancyLog';
import { downloadBase64Pdf, safeFileName } from '@/lib/past-jobs';
import type { GenerationResult, ProjectInfo } from '@/lib/types';
import type { Division } from '@/lib/upload-lists';

export default function ResultsPanel({
  result,
  division,
  project,
  storageNote,
}: {
  result: GenerationResult;
  division: Division;
  project: ProjectInfo;
  storageNote?: string | null;
}) {
  const base = safeFileName(
    `${project.projectName}-${project.projectSub || division.divisionShort}`,
  );
  const counts = severityCounts(result.discrepancies);

  return (
    <section>
      <h2 className="section-title mb-3">Results</h2>

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              downloadBase64Pdf(result.cheatsheetPdf, `${base}-Cheat-Sheet.pdf`)
            }
            className="btn-primary py-3.5 text-base"
          >
            ⬇ Download Cheat Sheet (PDF)
          </button>

          <button
            type="button"
            onClick={() =>
              downloadBase64Pdf(result.checklistPdf, `${base}-Checklist.pdf`)
            }
            className="btn-outline py-3.5 text-base"
          >
            ⬇ Download Checklist (PDF)
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-3 divide-x divide-bch-line rounded-md border border-bch-line">
          <Stat label="Spec sections" value={String(result.sectionCount)} />
          <Stat label="Sheet pages" value={result.pageCount ? String(result.pageCount) : '—'} />
          <Stat
            label="Discrepancies"
            value={String(result.discrepancies.length)}
            detail={
              result.discrepancies.length > 0
                ? `${counts.high} high · ${counts.medium} med · ${counts.low} low`
                : undefined
            }
          />
        </dl>

        {storageNote && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {storageNote}
          </p>
        )}

        <div className="mt-5">
          <DiscrepancyLog items={result.discrepancies} />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="px-4 py-3 text-center">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-bch-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-bold text-bch-navy">{value}</dd>
      {detail && <dd className="mt-0.5 text-[11px] text-bch-muted">{detail}</dd>}
    </div>
  );
}
