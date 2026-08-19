'use client';

import { useCallback, useRef, useState } from 'react';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

const fmtSize = (bytes: number) =>
  bytes > 1_000_000 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

/**
 * Collects PDFs without asking which division they belong to.
 *
 * The old uploader matched every file against a fixed section list for a chosen
 * division, which meant picking the division first and naming files correctly.
 * Nothing here needs either: the book says which sections it contains and which
 * trades are in it.
 */
export default function SpecUpload({ files, onChange, disabled }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const pdfs = Array.from(incoming).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
      // Same file dropped twice is a mistake, not a request for two copies.
      const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
      onChange([...files, ...pdfs.filter((f) => !seen.has(`${f.name}:${f.size}`))]);
    },
    [files, onChange],
  );

  const totalSize = files.reduce((n, f) => n + f.size, 0);

  return (
    <section className="card p-5">
      <h2 className="section-title mb-3">2 · Specifications</h2>
      <p className="mt-1 text-sm text-bch-muted">
        Drop in whatever you have — a whole division as one file, or the individual
        sections. The tool reads which sections are in it and which trades they cover.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? 'border-bch-accent bg-blue-50'
            : 'border-bch-line bg-bch-bg hover:border-bch-accent'
        } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <span className="text-sm font-semibold text-bch-ink">
          Drop PDFs here, or click to choose
        </span>
        <span className="mt-1 text-xs text-bch-muted">
          Any number of files. Scanned specs need OCR first.
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-bch-muted">
              {files.length} file{files.length === 1 ? '' : 's'} · {fmtSize(totalSize)}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={disabled}
              className="text-xs font-semibold text-bch-accent hover:underline disabled:opacity-50"
            >
              Remove all
            </button>
          </div>

          <ul className="mt-2 divide-y divide-bch-line border-t border-bch-line">
            {files.map((f, i) => (
              <li key={`${f.name}:${f.size}`} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm text-bch-ink">{f.name}</span>
                <span className="shrink-0 text-xs text-bch-muted">{fmtSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, j) => j !== i))}
                  disabled={disabled}
                  aria-label={`Remove ${f.name}`}
                  className="shrink-0 text-xs font-semibold text-bch-muted hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
