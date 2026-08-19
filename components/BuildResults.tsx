'use client';

import DiscrepancyLog from '@/components/DiscrepancyLog';
import type { BuiltSheet, ProjectInfo } from '@/lib/types';

interface Props {
  sheets: BuiltSheet[];
  project: ProjectInfo;
}

function download(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const slug = (s: string) =>
  s.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 48) || 'sheet';

export default function BuildResults({ sheets, project }: Props) {
  if (sheets.length === 0) return null;

  return (
    <div className="space-y-6">
      {sheets.map((sheet) => {
        const base = `${slug(project.projectName)}-${sheet.trade}`;
        const high = sheet.discrepancies.filter((d) => d.severity === 'high').length;

        return (
          <section key={sheet.trade} className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-bch-navy">{sheet.name}</h2>
              <span className="text-xs text-bch-muted">
                {sheet.pageCount} pages · {sheet.blockCount} sections read ·{' '}
                {sheet.discrepancies.length} discrepancies
                {high > 0 && `, ${high} high severity`}
              </span>
            </div>

            {sheet.recoveredChecklist && (
              <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                The sheet used the whole response budget, so the checklist was written in a
                second pass. Both are complete — but if the sheet cites a discrepancy number
                that is not in the log, rebuild to get them back in sync.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => download(sheet.cheatsheetPdf, `${base}-cheat-sheet.pdf`)}
                className="btn-primary"
              >
                Download cheat sheet
              </button>
              <button
                type="button"
                onClick={() => download(sheet.checklistPdf, `${base}-checklist.pdf`)}
                className="btn-outline"
              >
                Download checklist
              </button>
            </div>

            {sheet.discrepancies.length > 0 && (
              <div className="mt-5">
                <DiscrepancyLog items={sheet.discrepancies} />
              </div>
            )}
          </section>
        );
      })}

      <p className="text-xs text-bch-muted">
        Read the checklist before anyone builds from a sheet. The high-severity entries are
        the point — a sheet is only as trustworthy as the checklist that came with it.
      </p>
    </div>
  );
}
