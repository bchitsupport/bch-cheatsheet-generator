'use client';

import type { ProjectInfo } from '@/lib/types';

const FIELDS: {
  key: keyof ProjectInfo;
  label: string;
  placeholder: string;
  required?: boolean;
  wide?: boolean;
}[] = [
  {
    key: 'projectName',
    label: 'Project name',
    placeholder: "Tampa Int'l Airport",
    required: true,
  },
  { key: 'projectSub', label: 'Project sub-line', placeholder: 'AIRSIDE D / CCBS' },
  {
    key: 'preparerName',
    label: 'Preparer name',
    placeholder: 'Joshua Ahwai',
    required: true,
  },
  {
    key: 'preparerTitle',
    label: 'Preparer title',
    placeholder: 'Assistant Project Manager Intern',
  },
  {
    key: 'preparerEmail',
    label: 'Preparer email',
    placeholder: 'joshua.ahwai@bchmechanical.com',
  },
  { key: 'legendDrawing', label: 'Legend drawing number', placeholder: 'AD-M001' },
];

export default function ProjectForm({
  value,
  onChange,
}: {
  value: ProjectInfo;
  onChange: (next: ProjectInfo) => void;
}) {
  return (
    <section>
      <h2 className="section-title mb-3">1 · Project info</h2>

      <div className="card p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className={field.wide ? 'md:col-span-2' : undefined}>
              <label htmlFor={field.key} className="field-label">
                {field.label}
                {field.required && <span className="ml-1 text-red-600">*</span>}
              </label>
              <input
                id={field.key}
                type={field.key === 'preparerEmail' ? 'email' : 'text'}
                className="field-input"
                placeholder={field.placeholder}
                value={value[field.key]}
                onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-bch-muted">
          These fill the sheet banner. The project name and preparer name are required;
          the rest are omitted from the banner if left blank.
        </p>
      </div>
    </section>
  );
}
