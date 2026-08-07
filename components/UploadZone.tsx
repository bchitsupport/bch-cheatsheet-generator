'use client';

import { useCallback, useRef, useState } from 'react';
import { buildSectionMatches, unmatchedFiles } from '@/lib/section-matcher';
import type { ExtractedFile } from '@/lib/types';
import type { Division } from '@/lib/upload-lists';

export default function UploadZone({
  division,
  files,
  onFilesChange,
  disabled,
}: {
  division: Division;
  files: ExtractedFile[];
  onFilesChange: (files: ExtractedFile[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming?.length || disabled) return;

      const pdfs = Array.from(incoming).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
      );

      if (pdfs.length === 0) {
        setError('Only PDF files can be uploaded.');
        return;
      }

      setBusy(true);
      setError(null);

      try {
        const form = new FormData();
        form.append('division', division.id);
        for (const f of pdfs) form.append('files', f);

        const res = await fetch('/api/extract', { method: 'POST', body: form });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error ?? 'Extraction failed.');

        // Re-uploading the same file replaces its entry rather than duplicating it.
        const incomingFiles = data.files as ExtractedFile[];
        const incomingIds = new Set(incomingFiles.map((f) => f.id));
        onFilesChange([...files.filter((f) => !incomingIds.has(f.id)), ...incomingFiles]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not read those PDFs.');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [division.id, disabled, files, onFilesChange],
  );

  const matches = buildSectionMatches(files, division);
  const matchedCount = matches.filter((m) => m.status === 'matched').length;
  const extras = unmatchedFiles(files);
  const failed = files.filter((f) => f.error);

  return (
    <section>
      <h2 className="section-title mb-3">3 · Upload spec sections</h2>

      <div className="card p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && !busy && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
            disabled
              ? 'cursor-not-allowed border-slate-200 bg-slate-50'
              : dragging
                ? 'cursor-pointer border-bch-accent bg-blue-50'
                : 'cursor-pointer border-slate-300 bg-slate-50 hover:border-bch-accent hover:bg-blue-50/40'
          }`}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={dragging ? 'text-bch-accent' : 'text-slate-400'}
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5-5 5 5" />
            <path d="M12 5v12" />
          </svg>

          <p className="mt-3 text-sm font-semibold text-bch-ink">
            {busy ? 'Reading PDFs…' : 'Drop spec PDFs here or click to browse'}
          </p>
          <p className="mt-1 text-xs text-bch-muted">
            Text-based PDFs only. Scanned sections need OCR first.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => void addFiles(e.target.files)}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        {/* ---- required sections checklist ---- */}
        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="section-title">Required sections</h3>
            <span
              className={`font-mono text-xs ${
                matchedCount === matches.length ? 'text-green-700' : 'text-bch-muted'
              }`}
            >
              {matchedCount} of {matches.length}
            </span>
          </div>

          <ul className="divide-y divide-bch-line rounded-md border border-bch-line">
            {matches.map((m) => (
              <li
                key={m.number}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    m.status === 'matched'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {m.status === 'matched' ? '✓' : '–'}
                </span>

                <span className="w-[76px] shrink-0 font-mono text-xs text-bch-muted">
                  {m.number}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.title}</span>

                {m.status === 'matched' ? (
                  <span className="max-w-[220px] truncate text-xs text-bch-muted">
                    {m.fileName}
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    missing
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* ---- files that matched nothing ---- */}
        {extras.length > 0 && (
          <div className="mt-5">
            <h3 className="section-title mb-2">Other uploads</h3>
            <ul className="space-y-1.5">
              {extras.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {f.fileName}
                    {f.sectionNumber && (
                      <span className="ml-2 font-mono text-xs text-bch-muted">
                        {f.sectionNumber}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    not needed — will skip
                  </span>
                  <button
                    type="button"
                    onClick={() => onFilesChange(files.filter((x) => x.id !== f.id))}
                    className="shrink-0 text-xs text-bch-muted underline hover:text-red-600"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---- files that failed extraction ---- */}
        {failed.length > 0 && (
          <div className="mt-5">
            <h3 className="section-title mb-2">Could not be read</h3>
            <ul className="space-y-1.5">
              {failed.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{f.fileName}</span>
                    <span className="block text-xs">{f.error}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onFilesChange(files.filter((x) => x.id !== f.id))}
                    className="shrink-0 text-xs underline"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {files.length > 0 && (
          <button
            type="button"
            onClick={() => onFilesChange([])}
            className="mt-5 text-xs text-bch-muted underline hover:text-bch-ink"
          >
            Clear all uploads
          </button>
        )}
      </div>
    </section>
  );
}
