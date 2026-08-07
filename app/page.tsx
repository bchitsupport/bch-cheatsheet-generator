'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import DivisionSelector from '@/components/DivisionSelector';
import GenerateButton, { type ReadinessIssue } from '@/components/GenerateButton';
import ProgressSteps from '@/components/ProgressSteps';
import ProjectForm from '@/components/ProjectForm';
import ResultsPanel from '@/components/ResultsPanel';
import UploadZone from '@/components/UploadZone';
import { savePastJob } from '@/lib/past-jobs';
import { buildSectionMatches } from '@/lib/section-matcher';
import {
  EMPTY_PROJECT,
  type ExtractedFile,
  type GenerateEvent,
  type GenerationResult,
  type ProgressStepKey,
  type ProjectInfo,
} from '@/lib/types';
import { getDivision, type DivisionId } from '@/lib/upload-lists';

export default function NewSheetPage() {
  const [divisionId, setDivisionId] = useState<DivisionId | null>(null);
  const [project, setProject] = useState<ProjectInfo>(EMPTY_PROJECT);
  const [files, setFiles] = useState<ExtractedFile[]>([]);

  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<ProgressStepKey | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  const division = divisionId ? getDivision(divisionId) : null;

  const issues = useMemo<ReadinessIssue[]>(() => {
    if (!division) return [{ message: 'Select a division.' }];

    const list: ReadinessIssue[] = [];

    if (!project.projectName.trim()) list.push({ message: 'Enter a project name.' });
    if (!project.preparerName.trim()) list.push({ message: 'Enter a preparer name.' });

    const missing = buildSectionMatches(files, division).filter(
      (m) => m.status === 'missing',
    );
    if (missing.length > 0) {
      list.push({
        message: `Upload the remaining ${missing.length} required section${
          missing.length === 1 ? '' : 's'
        }: ${missing.map((m) => m.number).join(', ')}.`,
      });
    }

    return list;
  }, [division, files, project.preparerName, project.projectName]);

  const selectDivision = useCallback(
    (id: DivisionId) => {
      if (id === divisionId) return;
      // Section matching is division-specific, so previously matched files would
      // be wrong against a different list. Start clean.
      setDivisionId(id);
      setFiles([]);
      setResult(null);
      setError(null);
      setWarnings([]);
      setStep(null);
      setStorageNote(null);
    },
    [divisionId],
  );

  const generate = useCallback(async () => {
    if (!division) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setWarnings([]);
    setStorageNote(null);
    setStep('extract');

    const startedAt = Date.now();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division: division.id, project, files }),
      });

      if (!res.body) {
        throw new Error(
          res.status === 504
            ? 'The server timed out. On Vercel Hobby the limit is 60 seconds — upgrade to Pro, or split the specs into two batches.'
            : `Request failed (${res.status}).`,
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      const handle = (event: GenerateEvent) => {
        switch (event.type) {
          case 'step':
            setStep(event.step);
            break;
          case 'warning':
            setWarnings((prev) => [...prev, event.message]);
            break;
          case 'done': {
            finished = true;
            setResult(event.result);
            setStep(null);

            const saved = savePastJob({
              id: `${Date.now()}`,
              projectName: project.projectName,
              projectSub: project.projectSub,
              division: division.id,
              divisionName: division.name,
              date: new Date().toISOString(),
              pageCount: event.result.pageCount,
              discrepancyCount: event.result.discrepancies.length,
              cheatsheetPdf: event.result.cheatsheetPdf,
              checklistPdf: event.result.checklistPdf,
            });
            if (!saved.saved && saved.message) setStorageNote(saved.message);

            setTimeout(
              () => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }),
              50,
            );
            break;
          }
          case 'error':
            finished = true;
            setError(event.message);
            break;
        }
      };

      // NDJSON: one JSON object per line.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            handle(JSON.parse(line) as GenerateEvent);
          } catch {
            /* partial frame — the next chunk completes it */
          }
        }
      }

      if (buffer.trim()) {
        try {
          handle(JSON.parse(buffer) as GenerateEvent);
        } catch {
          /* ignore trailing noise */
        }
      }

      if (!finished) {
        // The stream ended without a done/error frame. The route reports its own
        // failures, so reaching here means the server process itself was killed —
        // almost always the hosting platform's function time limit (Vercel: 300s),
        // occasionally memory. Say so, because "connection closed" on its own
        // sends people looking at their network.
        const secs = Math.round((Date.now() - startedAt) / 1000);
        setError(
          `The server stopped responding after ${secs} seconds, without reporting an error. ` +
            'That usually means the generation exceeded the hosting time limit rather than ' +
            'anything being wrong with your specs. Try again with fewer spec sections, or ' +
            'split the upload into two batches. If it keeps happening at roughly the same ' +
            'time, the job needs to run in the background instead.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setRunning(false);
    }
  }, [division, files, project]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-bch-navy">New Sheet</h1>
        <p className="mt-1 text-sm text-bch-muted">
          Upload the spec sections for one division and get back a field cheat sheet
          plus a verification checklist.
        </p>
      </header>

      <DivisionSelector value={divisionId} onChange={selectDivision} />

      {division && (
        <>
          <ProjectForm value={project} onChange={setProject} />

          <UploadZone
            division={division}
            files={files}
            onFilesChange={setFiles}
            disabled={running}
          />

          <GenerateButton issues={issues} running={running} onGenerate={generate} />

          {(running || warnings.length > 0 || error) && (
            <ProgressSteps
              current={step}
              done={Boolean(result)}
              failed={Boolean(error)}
              warnings={warnings}
            />
          )}

          {error && (
            <div className="card border-red-200 bg-red-50 p-5">
              <h2 className="text-sm font-bold text-red-800">Generation failed</h2>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={generate}
                disabled={running || issues.length > 0}
                className="btn-primary mt-4"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={resultsRef}>
            {result && (
              <ResultsPanel
                result={result}
                division={division}
                project={project}
                storageNote={storageNote}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
