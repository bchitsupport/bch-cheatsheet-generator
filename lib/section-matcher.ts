import type { SectionMatch } from './types';
import type { ExtractedFile } from './types';
import type { Division } from './upload-lists';

/**
 * Pull the CSI section number off the first page of a spec.
 *
 * Real-world headers look like:
 *   "SECTION 22 11 19 - DOMESTIC WATER PIPING"
 *   "SECTION 23 21 13.13 UNDERGROUND HYDRONIC PIPING"
 *   "22 05 29 – HANGERS AND SUPPORTS FOR PLUMBING PIPING AND EQUIPMENT"
 *   "SECTION 221119"        (no spaces — some publishers strip them)
 *
 * Strategy: prefer a number that follows the word SECTION, since page 1 of a
 * spec usually also carries the project number and a page footer that can look
 * like a CSI number. Fall back to the first bare match near the top.
 */
export function extractSectionNumber(firstPageText: string): string | null {
  const text = firstPageText.replace(/ /g, ' ');

  // Pass 1 — explicitly labeled.
  //
  // The separators are [ \t], never \s: \s matches newlines, which lets a number
  // on the line above donate a group. A cover page reading
  //   Project No. 8827-24
  //   22 05 29 HANGERS AND SUPPORTS
  // parses as "24 22 05" under \s, which then matches nothing.
  const labeled = text.match(
    /SECTION[ \t]+(\d{2})[ \t.-]?(\d{2})[ \t.-]?(\d{2})(\.\d{1,2})?/i,
  );
  if (labeled) return formatSection(labeled);

  // Pass 2 — a bare CSI number heading its own line. Anchoring to line start
  // keeps project numbers, dates, and inline cross-references out; the number
  // is still found in the page footer ("22 11 19 - 1") when a section has no
  // header line of its own.
  for (const line of text.split('\n').slice(0, 60)) {
    const bare = line.match(/^\s*(\d{2})[ \t](\d{2})[ \t](\d{2})(\.\d{1,2})?\b/);
    if (bare) return formatSection(bare);
  }

  return null;
}

function formatSection(m: RegExpMatchArray): string {
  const base = `${m[1]} ${m[2]} ${m[3]}`;
  return m[4] ? `${base}${m[4]}` : base;
}

/** Grab the section title that trails the number, when there is one. */
export function extractSectionTitle(firstPageText: string): string | null {
  const m = firstPageText.match(
    /SECTION[ \t]+\d{2}[ \t.-]?\d{2}[ \t.-]?\d{2}(?:\.\d{1,2})?[ \t]*[-–—:]?[ \t]*([A-Z][A-Z \t,&/'()-]{5,80})/i,
  );
  if (!m) return null;
  return m[1]
    .replace(/\s+/g, ' ')
    .replace(/[\s-]+$/, '')
    .trim();
}

/**
 * Match a file's section number against a division's Tier 1 list.
 * Exact match first, then base-number match so "23 21 13.13" can fall back to
 * "23 21 13" if the list only carries the parent.
 */
export function matchToDivision(
  sectionNumber: string | null,
  division: Division,
): string | null {
  if (!sectionNumber) return null;
  const wanted = division.tier1.map((s) => s.number);

  if (wanted.includes(sectionNumber)) return sectionNumber;

  const base = sectionNumber.split('.')[0];
  if (wanted.includes(base)) return base;

  // "23 21 13" uploaded, list wants "23 21 13.13" and nothing else at the base.
  const child = wanted.find((w) => w.split('.')[0] === base && w !== base);
  if (child && !wanted.includes(base)) return child;

  return null;
}

/** Build the checkmark/missing list shown under the drop zone. */
export function buildSectionMatches(
  files: ExtractedFile[],
  division: Division,
): SectionMatch[] {
  return division.tier1.map((section) => {
    const hit = files.find((f) => !f.error && f.matchedSection === section.number);
    return {
      number: section.number,
      title: section.title,
      status: hit ? 'matched' : 'missing',
      fileName: hit?.fileName,
    };
  });
}

/** Files that matched nothing on the list — kept, but not sent to the model. */
export function unmatchedFiles(files: ExtractedFile[]): ExtractedFile[] {
  return files.filter((f) => !f.error && !f.matchedSection);
}
