'use client';

import { DIVISIONS, type Division, type DivisionId } from '@/lib/upload-lists';

function Icon({ kind }: { kind: Division['icon'] }) {
  const common = {
    width: 30,
    height: 30,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (kind === 'wrench') {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a4 4 0 1 0 5 5L21 21l-2 2-9.7-9.7a4 4 0 1 1-5-5L7 9l2-2-2.7-2.7z" />
      </svg>
    );
  }

  if (kind === 'fan') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 10c0-3.5-1-6-3-6s-2.5 2.5-1 4.5S12 12 12 10z" />
        <path d="M14 12c3.5 0 6-1 6-3s-2.5-2.5-4.5-1S12 12 14 12z" />
        <path d="M12 14c0 3.5 1 6 3 6s2.5-2.5 1-4.5S12 12 12 14z" />
        <path d="M10 12c-3.5 0-6 1-6 3s2.5 2.5 4.5 1S12 12 10 12z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M3 8h7a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h5" />
      <rect x="1" y="5.5" width="3" height="5" rx="0.5" />
      <rect x="20" y="13.5" width="3" height="5" rx="0.5" />
      <path d="M9 8v8" />
    </svg>
  );
}

export default function DivisionSelector({
  value,
  onChange,
}: {
  value: DivisionId | null;
  onChange: (id: DivisionId) => void;
}) {
  return (
    <section>
      <h2 className="section-title mb-3">1 · Select a division</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {DIVISIONS.map((division) => {
          const selected = value === division.id;
          return (
            <button
              key={division.id}
              type="button"
              onClick={() => onChange(division.id)}
              aria-pressed={selected}
              className={`card flex flex-col items-start gap-3 p-5 text-left transition ${
                selected
                  ? 'border-bch-accent ring-2 ring-bch-accent/25'
                  : 'hover:border-bch-accent/50 hover:shadow'
              }`}
            >
              <span
                className={`rounded-md p-2 ${
                  selected ? 'bg-bch-accent text-white' : 'bg-slate-100 text-bch-navy'
                }`}
              >
                <Icon kind={division.icon} />
              </span>

              <span className="text-sm font-bold leading-snug text-bch-navy">
                {division.name}
              </span>
              <span className="text-xs leading-relaxed text-bch-muted">
                {division.blurb}
              </span>

              <span className="mt-auto pt-2 font-mono text-[11px] text-bch-muted">
                {division.divisionLabel} · {division.tier1.length} spec sections needed
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
