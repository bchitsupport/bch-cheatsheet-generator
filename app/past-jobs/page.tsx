'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  clearPastJobs,
  deletePastJob,
  downloadBase64Pdf,
  loadPastJobs,
  safeFileName,
} from '@/lib/past-jobs';
import type { PastJob } from '@/lib/types';

export default function PastJobsPage() {
  const [jobs, setJobs] = useState<PastJob[] | null>(null);

  // localStorage is browser-only, so read after mount rather than during render.
  useEffect(() => setJobs(loadPastJobs()), []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-bch-navy">Past Jobs</h1>
          <p className="mt-1 text-sm text-bch-muted">
            The 10 most recent sheets, stored in this browser only. Clearing site data
            deletes them.
          </p>
        </div>

        {jobs && jobs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearPastJobs();
              setJobs([]);
            }}
            className="shrink-0 text-xs text-bch-muted underline hover:text-red-600"
          >
            Clear history
          </button>
        )}
      </header>

      {jobs === null ? (
        <div className="card p-8 text-center text-sm text-bch-muted">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-bch-muted">No sheets generated yet.</p>
          <Link href="/" className="btn-primary mt-4">
            Create your first sheet
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-bch-line bg-slate-50 text-left">
                <Th>Project</Th>
                <Th>Division</Th>
                <Th>Date</Th>
                <Th className="text-center">Pages</Th>
                <Th className="text-center">Discrepancies</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bch-line">
              {jobs.map((job) => {
                const base = safeFileName(`${job.projectName}-${job.projectSub}`);
                return (
                  <tr key={job.id} className="align-middle">
                    <td className="px-4 py-3">
                      <div className="font-medium">{job.projectName}</div>
                      {job.projectSub && (
                        <div className="text-xs text-bch-muted">{job.projectSub}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-bch-muted">{job.divisionName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-bch-muted">
                      {new Date(job.date).toLocaleDateString()}{' '}
                      {new Date(job.date).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {job.pageCount || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {job.discrepancyCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            downloadBase64Pdf(
                              job.cheatsheetPdf,
                              `${base}-Cheat-Sheet.pdf`,
                            )
                          }
                          className="text-xs font-semibold text-bch-accent hover:underline"
                        >
                          Sheet
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadBase64Pdf(job.checklistPdf, `${base}-Checklist.pdf`)
                          }
                          className="text-xs font-semibold text-bch-accent hover:underline"
                        >
                          Checklist
                        </button>
                        <button
                          type="button"
                          onClick={() => setJobs(deletePastJob(job.id))}
                          className="text-xs text-bch-muted hover:text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-bch-muted ${className}`}
    >
      {children}
    </th>
  );
}
