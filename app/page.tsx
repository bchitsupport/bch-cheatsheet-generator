'use client';

import { useCallback, useRef, useState } from 'react';
import BuildResults from '@/components/BuildResults';
import ManifestReview from '@/components/ManifestReview';
import ProjectForm from '@/components/ProjectForm';
import SpecUpload from '@/components/SpecUpload';
import { savePastJob } from '@/lib/past-jobs';
import {
  EMPTY_PROJECT,
  type BuildEvent,
  type BuildStepKey,
  type BuiltSheet,
  type ManifestView,
  type ProjectInfo,
} from '@/lib/types';
import type { DivisionId } from '@/lib/upload-lists';

type Stage = 'upload' | 'review' | 'building' | 'done';

const STEP_LABEL: Record<BuildStepKey, string> = {
  split: 'Splitting the book into sections',
  identify: 'Working out what each section is',
  read: 'Reading every section',
  compose: 'Writing the sheets',
};

export default function NewSheetPage() {
  const [project, setProject] = useState<ProjectInfo>(EMPTY_PROJECT);
  const [files, setFiles] = useState<File[]>([]);

  const [stage, setStage] = useState<Stage>('upload');
  const [manifest, setManifest] = useState<ManifestView | null>(null);
  const [selected, setSelected] = useState<DivisionId[]>([]);
  const [alsoRead, setAlsoRead] = useState<string[]>([]);
  const [sheets, setSheets] = useState<BuiltSheet[]>([]);

  const [step, setStep] = useState<BuildStepKey | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [spent, setSpent] = useState<number | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);

  /**
   * Which of the two runs is in flight. Both post to the same route and both
   * begin by splitting and identifying, so without this the progress card
   * cannot tell the user whether a build has started or the scan is repeating.
   */
  const [mode, setMode] = useState<"scan" | "build">("scan");

  /**
   * True once the route says it is classifying — which on a build only happens
   * when the posted manifest did not match the split, so the phase list has to
   * grow back to four.
   */
  const [reclassifying, setReclassifying] = useState(false);

  /**
   * One request handler for both stages. Called with no trades it stops after
   * the manifest; called with trades it goes on to build. The route decides —
   * this just reads the frames.
   */
  const run = useCallback(
    async (trades: DivisionId[]) => {
      setError(null);
      setWarnings([]);
      setStep(null);
      setProgress(null);
      setElapsed(0);
      setSpent(null);
      setReclassifying(false);
      if (trades.length > 0) setSheets([]);

      const body = new FormData();
      for (const f of files) body.append('files', f);
      for (const t of trades) body.append('trades', t);
      for (const n of alsoRead) body.append('alsoRead', n);
      if (trades.length > 0 && manifest) {
        // What the review screen is showing. The route classifies again only if
        // this does not line up with the split, so a build no longer repeats —
        // or re-charges for — the work the scan already did.
        body.set(
          'manifest',
          JSON.stringify({
            sections: manifest.sections.map((x) => ({
              sectionNumber: x.sectionNumber,
              summary: x.summary,
              roles: x.roles,
              targets: x.targets,
            })),
            trades: manifest.trades.map((t) => ({
              id: t.id,
              present: t.present,
              uncertain: t.uncertain,
              note: t.note,
            })),
          }),
        );
      }
      if (trades.length > 0) {
        body.set('projectName', project.projectName);
        body.set('projectSub', project.projectSub);
        body.set('preparerName', project.preparerName);
        body.set('preparerTitle', project.preparerTitle);
        body.set('preparerEmail', project.preparerEmail);
        body.set('legendDrawing', project.legendDrawing);
      }

      const startedAt = Date.now();
      const built: BuiltSheet[] = [];
      let finished = false;

      try {
        const res = await fetch('/api/build', { method: 'POST', body });
        if (!res.body) throw new Error(`Request failed (${res.status}).`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handle = (event: BuildEvent) => {
          switch (event.type) {
            case 'step':
              setStep(event.step);
              if (event.step === 'identify' && trades.length > 0) setReclassifying(true);
              if (event.total) setProgress({ done: 0, total: event.total });
              break;
            case 'progress':
              setProgress({ done: event.done, total: event.total });
              break;
            case 'manifest': {
              const m = event as unknown as ManifestView;
              setManifest(m);
              // Default to whatever the book actually contains.
              setSelected(m.trades.filter((t) => t.present).map((t) => t.id));
              break;
            }
            case 'awaiting-selection':
              finished = true;
              setStage('review');
              break;
            case 'warning':
              setWarnings((prev) => [...prev, event.message]);
              break;
            case 'usage':
              // What the reading phase actually cost, against the estimate shown
              // before the run. With no spend cap this is the only feedback loop.
              setSpent(event.dollars);
              break;
            case 'heartbeat':
              setElapsed(Math.round(event.elapsedMs / 1000));
              break;
            case 'sheet': {
              const { type: _t, ...sheet } = event;
              built.push(sheet as BuiltSheet);
              setSheets([...built]);
              savePastJob({
                id: `${Date.now()}-${sheet.trade}`,
                projectName: project.projectName,
                projectSub: project.projectSub,
                division: sheet.trade,
                divisionName: sheet.name,
                date: new Date().toISOString(),
                pageCount: sheet.pageCount,
                discrepancyCount: sheet.discrepancies.length,
                cheatsheetPdf: sheet.cheatsheetPdf,
                checklistPdf: sheet.checklistPdf,
              });
              break;
            }
            case 'done':
              finished = true;
              setStage('done');
              setStep(null);
              setTimeout(
                () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
                50,
              );
              break;
            case 'error':
              finished = true;
              setError(event.message);
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              handle(JSON.parse(line) as BuildEvent);
            } catch {
              /* partial frame — the next chunk completes it */
            }
          }
        }
        if (buffer.trim()) {
          try {
            handle(JSON.parse(buffer) as BuildEvent);
          } catch {
            /* trailing noise */
          }
        }

        if (!finished) {
          // The route reports its own failures, so an unannounced end means the
          // server process itself died — almost always a hosting time limit.
          const secs = Math.round((Date.now() - startedAt) / 1000);
          setError(
            `The server stopped responding after ${secs} seconds without reporting an ` +
              'error. That usually means the run exceeded the hosting time limit rather ' +
              'than anything being wrong with your specs.',
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The run failed.');
      }
    },
    [files, project, alsoRead, manifest],
  );

  /** Put the progress card on screen — it renders on the next tick. */
  const revealProgress = () => {
    setTimeout(
      () => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      60,
    );
  };

  const scan = useCallback(async () => {
    setMode('scan');
    setStage('building');
    revealProgress();
    setManifest(null);
    setSheets([]);
    await run([]);
    setStage((s) => (s === 'building' ? 'upload' : s));
  }, [run]);

  const build = useCallback(async () => {
    setMode('build');
    setStage('building');
    // The build button sits below the review, and the progress card above it.
    // Without this the run starts several screens out of sight and the only
    // feedback is a spinner you have to go looking for.
    revealProgress();
    await run(selected);
    setStage((s) => (s === 'building' ? 'review' : s));
  }, [run, selected]);

  // A scan stops after the manifest; a build carries on into reading and
  // composing. Numbering the phase against the right list is what makes
  // "Splitting the book into sections" legible as step 1 of 4 rather than as
  // the scan apparently running a second time.
  const phases: BuildStepKey[] =
    mode === 'build'
      ? reclassifying
        ? ['split', 'identify', 'read', 'compose']
        : ['split', 'read', 'compose']
      : ['split', 'identify'];
  const stepIndex = Math.max(0, step ? phases.indexOf(step) : 0);

  const busy = stage === 'building';
  const canScan = files.length > 0 && !busy;
  const missingProject =
    !project.projectName.trim() || !project.preparerName.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-bch-navy">New Sheet</h1>
        <p className="mt-1 text-sm text-bch-muted">
          Upload a division — whole or in pieces. The tool works out which sections are
          in it, which trades it covers, and builds a cheat sheet and checklist for each.
        </p>
      </header>

      <ProjectForm value={project} onChange={setProject} />

      <SpecUpload files={files} onChange={setFiles} disabled={busy} />

      {stage === 'upload' && (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={scan} disabled={!canScan} className="btn-primary">
            Scan the specifications
          </button>
          <span className="text-xs text-bch-muted">
            Reads what&rsquo;s in the upload and shows you before anything is generated.
          </span>
        </div>
      )}

      {busy && (
        <section
          ref={progressRef}
          className="card sticky top-4 z-30 border-bch-accent p-5 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <span className="bch-spin inline-block h-5 w-5 shrink-0 rounded-full border-2 border-bch-line border-t-bch-accent" />
            <span className="text-base font-bold text-bch-navy">
              {mode === 'build' ? 'Building your sheets' : 'Scanning the specifications'}
            </span>
            {elapsed > 0 && (
              <span className="ml-auto text-xs tabular-nums text-bch-muted">
                {Math.floor(elapsed / 60)}m {String(elapsed % 60).padStart(2, '0')}s
              </span>
            )}
          </div>

          {/*
            The phase, numbered against the phases this run actually has.
            A build repeats the split and the identify — the route takes files,
            not a saved manifest — so without a number the screen says
            "Splitting the book into sections" after you press Build and reads
            like it never left the scan.
          */}
          <p className="mt-2 text-sm text-bch-ink">
            <span className="font-semibold">
              Step {stepIndex + 1} of {phases.length}
            </span>
            {' · '}
            {step ? STEP_LABEL[step] : 'Starting'}
            {mode === 'build' && (step === 'split' || step === 'identify') && (
              <span className="text-bch-muted">
                {' '}
                — repeated from the scan, because the build starts from the files again
              </span>
            )}
          </p>

          <div className="mt-3 flex gap-1">
            {phases.map((p, i) => (
              <span
                key={p}
                className={`h-1.5 flex-1 rounded ${
                  i < stepIndex
                    ? 'bg-bch-accent'
                    : i === stepIndex
                      ? 'bg-bch-accent/40'
                      : 'bg-bch-line'
                }`}
              />
            ))}
          </div>

          {progress && progress.total > 0 && (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded bg-bch-line">
                <div
                  className="h-full bg-bch-accent transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-bch-muted">
                {progress.done} of {progress.total} sections
              </p>
            </div>
          )}

          <p className="mt-3 text-xs text-bch-muted">
            {mode === 'build'
              ? 'A full division takes 15–25 minutes. Leave this tab open.'
              : 'A scan takes a couple of minutes. Leave this tab open.'}
          </p>

          {spent !== null && (
            <p className="mt-2 text-xs text-bch-muted">
              Reading the specifications cost{' '}
              <span className="font-semibold tabular-nums text-bch-ink">
                ${spent.toFixed(2)}
              </span>
              . Writing the sheets adds roughly $2 each.
            </p>
          )}

          {sheets.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-bch-ink">
              Finished: {sheets.map((s) => s.name).join(', ')}
            </p>
          )}
        </section>
      )}

      {warnings.map((w) => (
        <p
          key={w}
          className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {w}
        </p>
      ))}

      {error && (
        <div className="card border-red-200 bg-red-50 p-5">
          <h2 className="text-sm font-bold text-red-800">That didn&rsquo;t work</h2>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {manifest && (stage === 'review' || stage === 'done' || busy) && (
        <ManifestReview
          manifest={manifest}
          selected={selected}
          onSelectedChange={setSelected}
          alsoRead={alsoRead}
          onAlsoReadChange={setAlsoRead}
          disabled={busy}
        />
      )}

      {manifest && stage === 'review' && (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={build}
            disabled={busy || selected.length === 0 || missingProject}
            className="btn-primary"
          >
            Build {selected.length} sheet{selected.length === 1 ? '' : 's'}
          </button>
          {missingProject && (
            <span className="text-xs text-amber-700">
              Enter a project name and preparer name first.
            </span>
          )}
          {selected.length === 0 && !missingProject && (
            <span className="text-xs text-bch-muted">Choose at least one sheet.</span>
          )}
        </div>
      )}

      <div ref={resultsRef}>
        <BuildResults sheets={sheets} project={project} />
      </div>
    </div>
  );
}
