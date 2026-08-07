'use client';

import { PROGRESS_STEPS, type ProgressStepKey } from '@/lib/types';

export default function ProgressSteps({
  current,
  done,
  failed,
  warnings,
}: {
  current: ProgressStepKey | null;
  done: boolean;
  failed: boolean;
  warnings: string[];
}) {
  const currentIndex = current ? PROGRESS_STEPS.findIndex((s) => s.key === current) : -1;

  return (
    <section>
      <h2 className="section-title mb-3">Progress</h2>

      <div className="card p-5">
        <ol className="space-y-3">
          {PROGRESS_STEPS.map((step, i) => {
            const state = done
              ? 'done'
              : i < currentIndex
                ? 'done'
                : i === currentIndex
                  ? failed
                    ? 'failed'
                    : 'active'
                  : 'pending';

            return (
              <li key={step.key} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    state === 'done'
                      ? 'bg-green-100 text-green-700'
                      : state === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : state === 'active'
                          ? 'bg-blue-100 text-bch-accent'
                          : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {state === 'done' ? (
                    '✓'
                  ) : state === 'failed' ? (
                    '!'
                  ) : state === 'active' ? (
                    <span className="bch-spin inline-block h-3.5 w-3.5 rounded-full border-2 border-blue-200 border-t-bch-accent" />
                  ) : (
                    i + 1
                  )}
                </span>

                <span
                  className={`text-sm ${
                    state === 'pending'
                      ? 'text-slate-400'
                      : state === 'active'
                        ? 'font-semibold text-bch-ink'
                        : 'text-bch-ink'
                  }`}
                >
                  {step.label}
                  {state === 'active' && '…'}
                </span>
              </li>
            );
          })}
        </ol>

        {warnings.length > 0 && (
          <ul className="mt-5 space-y-1.5 border-t border-bch-line pt-4">
            {warnings.map((w, i) => (
              <li
                key={`${i}-${w}`}
                className="flex items-start gap-2 text-xs text-amber-800"
              >
                <span aria-hidden="true" className="mt-[1px]">
                  ⚠
                </span>
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
