'use client';

export interface ReadinessIssue {
  message: string;
}

export default function GenerateButton({
  issues,
  running,
  onGenerate,
}: {
  issues: ReadinessIssue[];
  running: boolean;
  onGenerate: () => void;
}) {
  const ready = issues.length === 0;

  return (
    <section>
      <h2 className="section-title mb-3">4 · Generate</h2>

      <div className="card p-5">
        {!ready && (
          <ul className="mb-4 space-y-1.5">
            {issues.map((issue) => (
              <li
                key={issue.message}
                className="flex items-start gap-2 text-sm text-bch-muted"
              >
                <span aria-hidden="true" className="mt-[3px] text-amber-500">
                  ●
                </span>
                {issue.message}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onGenerate}
          disabled={!ready || running}
          className="btn-primary w-full py-3.5 text-base"
        >
          {running ? (
            <>
              <span
                aria-hidden="true"
                className="bch-spin inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white"
              />
              Generating…
            </>
          ) : (
            'Generate Cheat Sheet'
          )}
        </button>

        <p className="mt-3 text-center text-xs text-bch-muted">
          Typically 60–180 seconds depending on how much spec text was uploaded.
        </p>
      </div>
    </section>
  );
}
