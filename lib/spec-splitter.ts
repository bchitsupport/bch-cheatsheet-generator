/**
 * Cut a combined specification book into its CSI sections.
 *
 * Offices send divisions two ways: as one file per section, or as a single bound
 * book. This handles the second, and it does not guess at boundaries — every
 * page of a spec book carries the section it belongs to in its running header:
 *
 *     COMMON WORK RESULTS FOR PLUMBING
 *     22 05 00
 *     AHCA # 23/100069-18451  ADVENTHEALTH CARROLLWOOD  22 05 00-3
 *
 * So each page is attributed independently and sections are the runs of pages
 * that agree. Where a book has no running header, the `SECTION 22 05 00 - TITLE`
 * line that opens each section is used instead, and pages inherit the last one
 * seen. Both paths report which was used, because the second is weaker and the
 * result deserves a human glance.
 */

/**
 * Offices write CSI numbers either spaced (`22 05 00`) or tight (`220500`), with
 * an optional two-digit suffix. Both forms are accepted everywhere and
 * normalised to the spaced form, so a book's own convention never leaks into the
 * section numbers the rest of the pipeline sees.
 */
/**
 * Three real books, three conventions: `22 05 29`, `230000`, `23 0700`. Spaces
 * between the pairs are optional and independent, so all of them parse. The
 * digit guards on each end stop a six-digit run inside a longer number — a
 * project number, a phone number — from reading as a section.
 */
const CSI = String.raw`(?<!\d)\d{2} ?\d{2} ?\d{2}(?:\.\d{2})?(?!\d)`;

function normaliseNumber(raw: string): string {
  const compact = raw.replace(/\s+/g, '');
  const base = compact.slice(0, 6);
  const suffix = compact.slice(6);
  return `${base.slice(0, 2)} ${base.slice(2, 4)} ${base.slice(4, 6)}${suffix}`;
}

/**
 * `SECTION 22 05 00 - COMMON WORK RESULTS FOR PLUMBING`.
 *
 * Some books print this only on a section's first page; others repeat it in the
 * running header of every page. It is therefore read as evidence of which
 * section a page belongs to and as the source of the title — never on its own as
 * proof that a section starts here.
 */
const SECTION_LINE = new RegExp(
  // The title is optional: some books put it on the following line instead of
  // after a dash, and a section with no title still needs to be found.
  //
  // Case-sensitive, and anchored to the start of a line. That is what separates
  // a heading from a cross-reference: headings are written `SECTION 01 10 00 -
  // SUMMARY`, while body text says "as specified in Section 01 25 00". Matching
  // case-insensitively turned one such sentence into a section of its own,
  // splitting its neighbour in two.
  String.raw`^\s*SECTION\s+(${CSI})\s*(?:[-–—:]\s*(.+?))?\s*$`,
  'm',
);

/**
 * The running header written title-first — `HVAC INSULATION 23 0700 - 1 of 7`.
 * Without this the only match in such a book is the one SECTION line per
 * section, which drops the method to the weak fallback and lets a section
 * absorb its neighbours.
 */
const TITLE_THEN_NUMBER = new RegExp(
  // The separator is \s+, which spans a newline: extraction puts the title and
  // the number on one line in some books and on consecutive lines in others.
  String.raw`^([A-Z][A-Z0-9 &,'./()–-]{3,80}?)\s+(${CSI})\s*[-–—/]\s*\d`,
  'm',
);

/**
 * The page's own stamp: section number, a separator, then its ordinal within the
 * section — `22 05 00-3` or `230000 / 3`. The trailing boundary matters: without
 * it a project number like `NO.100763 – BLOOMINGDALE` reads as a section stamp.
 */
const PAGE_STAMP = new RegExp(String.raw`\b(${CSI})\s*[/-]\s*(\d{1,3})(?!\d)`, 'g');

/**
 * A number and title in the running header without the word SECTION —
 * `Hillsborough County Public Schools 23 09 23 Direct-Digital Control System`,
 * or `237313 - CENTRAL-STATION AIR-HANDLING UNITS`. A 106-page section written
 * this way was swallowed whole by its neighbour before this existed.
 *
 * The lookbehind is load-bearing: without it `HCPS PROJECT NO.100763 –
 * BLOOMINGDALE HIGH SCHOOL` reads as section 10 07 63 titled "BLOOMINGDALE".
 */
const HEADER_TITLED = new RegExp(
  String.raw`(?<![.\d])\b(${CSI})\s*(?:[-–—]\s*)?([A-Za-z][^\n]{3,90})`,
);

/**
 * `Page 1 of 11` / `41 of 106` — a section-relative page count in books that do
 * not stamp the section number onto the ordinal. Gives both the page's place and
 * the section's true length, which is then checked against the detected range.
 */
const ORDINAL_OF = /(?:^|\s)(?:Page\s+)?(\d{1,3})\s+of\s+(\d{1,3})(?!\d)/i;

/** A bare CSI number on its own line, as some running headers write it. */
const BARE_NUMBER = new RegExp(String.raw`^\s*(${CSI})\s*$`);

/**
 * How many lines from the top of a page count as the running header — counted
 * after blanks are dropped. Extraction pads some layouts with six empty lines
 * before the header even starts, which put a title-and-number pair out of reach
 * of a window measured in raw lines.
 */
const HEADER_LINES = 10;

export interface SplitSection {
  sectionNumber: string;
  title: string | null;
  /** 1-based, inclusive. */
  startPage: number;
  endPage: number;
  pageCount: number;
  text: string;
  charCount: number;
  warnings: string[];
}

export interface SplitResult {
  sections: SplitSection[];
  pageCount: number;
  /** 'running-header' is reliable; 'section-lines' deserves review. */
  method: 'running-header' | 'section-lines' | 'none';
  /** Repeated page furniture removed from the section text, in characters. */
  furnitureRemoved: number;
  warnings: string[];
}

interface PageRead {
  page: number;
  section: string | null;
  ordinal: number | null;
  /** The section's own stated page count, where the header gives one. */
  statedTotal: number | null;
  /**
   * This page carries a `SECTION nnnnnn - TITLE` line.
   *
   * Kept separate from `isStart`, which means "numbered 1 within its section"
   * and depends on a page stamp. A book with no running header has no stamps at
   * all, so every `isStart` is false — and treating that as "no sections found"
   * made a 216-page manual with perfectly good SECTION lines unreadable.
   */
  hasSectionLine: boolean;
  isStart: boolean;
  title: string | null;
}

/** Read one page's own claim about which section it belongs to. */
function readPage(text: string, page: number): PageRead {
  // Blank lines are layout, not content, and counting them shrinks the header
  // window to nothing on padded layouts.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const headerLines = lines.slice(0, HEADER_LINES);
  const header = headerLines.join('\n');
  // The whole page: a section can begin anywhere on one. Some books run sections
  // continuously, starting a new one wherever the last ended — in a 216-page
  // manual the headings sat at line 16 and beyond, and a window measured from the
  // top of the page found 47 of 113. Case-sensitivity, not position, is what
  // keeps body cross-references out.
  const opening = lines.join('\n');

  let section: string | null = null;
  let ordinal: number | null = null;
  let title: string | null = null;

  // The `SECTION nnnnnn - TITLE` line, wherever it appears, names the section
  // this page belongs to and gives the title.
  const named = SECTION_LINE.exec(opening);
  if (named) {
    section = normaliseNumber(named[1]);
    if (named[2]) title = named[2].replace(/\s+/g, ' ').trim();
  }
  const hasSectionLine = named !== null;

  // The page stamp carries the section and the page's place within it. Confined
  // to the header so a body reference to another section cannot masquerade.
  PAGE_STAMP.lastIndex = 0;
  const stamp = PAGE_STAMP.exec(header);
  if (stamp) {
    const stamped = normaliseNumber(stamp[1]);
    // The stamp wins on ordinal; on identity the two agree in every real book,
    // and if they disagree the section line is the more deliberate statement.
    section ??= stamped;
    if (stamped === section) ordinal = Number(stamp[2]);
  }

  // Title before the number, then the page stamp — run against the whole header
  // so a title and number on consecutive lines are seen as one.
  if (!section || !title) {
    const flipped = TITLE_THEN_NUMBER.exec(header);
    if (flipped) {
      const candidate = normaliseNumber(flipped[2]);
      if (!section || candidate === section) {
        section ??= candidate;
        title ??= flipped[1].replace(/\s+/g, ' ').trim();
      }
    }
  }

  // A numbered title in the running header, for books that never write SECTION.
  if (!section || !title) {
    for (const line of headerLines) {
      const titled = HEADER_TITLED.exec(line);
      if (!titled) continue;
      const candidate = normaliseNumber(titled[1]);
      if (section && candidate !== section) continue;
      section ??= candidate;
      title ??= titled[2].replace(/\s+/g, ' ').trim();
      break;
    }
  }

  if (!section) {
    for (const line of headerLines) {
      const bare = BARE_NUMBER.exec(line);
      if (bare) {
        section = normaliseNumber(bare[1]);
        break;
      }
    }
  }

  // Always look for "N of M": the stated total is what makes a split checkable,
  // and it is present in books that also stamp the ordinal onto the number.
  let statedTotal: number | null = null;
  for (const line of headerLines) {
    const of = ORDINAL_OF.exec(line);
    if (!of) continue;
    statedTotal = Number(of[2]);
    ordinal ??= Number(of[1]);
    break;
  }

  // A page opens a section when it says so — ordinal 1. Books that repeat the
  // SECTION line in every running header would otherwise mark every page a
  // start, so the line itself is not evidence of one.
  return {
    page,
    section,
    ordinal,
    statedTotal,
    hasSectionLine,
    isStart: ordinal === 1,
    title,
  };
}

/**
 * Page furniture — the running header repeated on every page — is pure token
 * cost. Lines are compared with digits masked so `22 05 00-3` and `22 05 00-4`
 * count as the same line.
 */
function stripFurniture(pages: string[]): { pages: string[]; removed: number } {
  const counts = new Map<string, number>();
  const mask = (line: string) => line.replace(/\d+/g, '#').trim();

  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.split('\n').slice(0, HEADER_LINES)) {
      const key = mask(line);
      if (!key || key.length > 120 || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // Only lines that appear on nearly every page. A threshold this high cannot
  // catch real content, which never repeats that consistently.
  const threshold = Math.max(2, Math.floor(pages.length * 0.8));
  const furniture = new Set(
    [...counts].filter(([, n]) => n >= threshold).map(([key]) => key),
  );

  let removed = 0;
  const cleaned = pages.map((page) => {
    const lines = page.split('\n');
    const kept = lines.filter((line, i) => {
      if (i >= HEADER_LINES) return true;
      if (!furniture.has(mask(line))) return true;
      removed += line.length + 1;
      return false;
    });
    return kept.join('\n').trim();
  });

  return { pages: cleaned, removed };
}

/** `3, 5, 6, 7, 20` → `3, 5–7, 20`. */
function summarisePages(list: number[]): string {
  const runs: string[] = [];
  for (let i = 0; i < list.length; ) {
    let j = i;
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    runs.push(i === j ? `${list[i]}` : `${list[i]}–${list[j]}`);
    i = j + 1;
  }
  return runs.join(', ');
}

export function splitSpecBook(pages: string[], declaredPageCount?: number): SplitResult {
  const warnings: string[] = [];
  const reads = pages.map((text, i) => readPage(text, i + 1));

  /**
   * A page that yields no text is invisible to everything downstream and says
   * nothing about itself. Usually it is a scan — a page image with no text layer
   * — and its requirements would simply be absent from the sheet with no sign
   * that anything was missing.
   */
  const blank = pages.map((t, i) => (t.trim() ? 0 : i + 1)).filter(Boolean);
  if (blank.length) {
    warnings.push(
      `${blank.length} page${blank.length === 1 ? '' : 's'} contain no extractable text ` +
        `(${summarisePages(blank)}). These are almost certainly scanned images. Whatever is ` +
        'on them will not reach the sheet — run OCR on the file and upload it again if they ' +
        'carry specification content.',
    );
  }

  // A document whose page objects outnumber the pages that were read means text
  // extraction skipped something, which is a different fault from a blank page.
  if (declaredPageCount !== undefined && declaredPageCount !== pages.length) {
    warnings.push(
      `The file declares ${declaredPageCount} pages but ${pages.length} were read. ` +
        `${Math.abs(declaredPageCount - pages.length)} page(s) were not extracted at all — ` +
        'the file may be damaged or partly encrypted. Treat the split as incomplete.',
    );
  }

  const stampedPages = reads.filter((r) => r.section !== null).length;
  const explicitStarts = reads.filter((r) => r.hasSectionLine).length;

  let method: SplitResult['method'];
  if (stampedPages >= pages.length * 0.8) {
    method = 'running-header';
  } else if (explicitStarts > 0) {
    method = 'section-lines';
    warnings.push(
      `Only ${stampedPages} of ${pages.length} pages carry a section in their header, so ` +
        `boundaries were taken from the ${explicitStarts} "SECTION ..." lines instead and ` +
        'pages between them were inherited. Check the page ranges before generating.',
    );
    // Carry each named section forward across the pages that follow it. Any page
    // that names a section starts one; the rest belong to whatever came before.
    let current: string | null = null;
    for (const r of reads) {
      if (r.section) current = r.section;
      else r.section = current;
    }
  } else {
    return {
      sections: [],
      pageCount: pages.length,
      method: 'none',
      furnitureRemoved: 0,
      warnings: [
        'No CSI section numbers were found in this document. If it is a scanned ' +
          'book it needs OCR first; if it is a single section, upload it as one file.',
      ],
    };
  }

  const { pages: clean, removed } = stripFurniture(pages);

  // Group runs of consecutive pages that name the same section.
  const groups: PageRead[][] = [];
  for (const r of reads) {
    if (!r.section) {
      // Unattributed: belongs with whatever came before it.
      if (groups.length) groups[groups.length - 1].push(r);
      continue;
    }
    const last = groups[groups.length - 1];
    if (last && last[0].section === r.section) last.push(r);
    else groups.push([r]);
  }

  const seenNumbers = new Map<string, number>();
  const sections: SplitSection[] = groups.map((group) => {
    const sectionNumber = group[0].section!;
    const startPage = group[0].page;
    const endPage = group[group.length - 1].page;
    const sectionWarnings: string[] = [];

    const titled = group.find((r) => r.title);
    const ordinals = group.map((r) => r.ordinal).filter((n): n is number => n !== null);

    if (ordinals.length === 0) {
      sectionWarnings.push(
        'No page in this run is numbered within its section, so its extent is inferred ' +
          'from where the section number changes. Check the page range.',
      );
    }
    // Where the book states its own section length, the split is checkable.
    const blankHere = blank.filter((p) => p >= startPage && p <= endPage);
    if (blankHere.length) {
      sectionWarnings.push(
        `Page${blankHere.length === 1 ? '' : 's'} ${summarisePages(blankHere)} in this section ` +
          'have no extractable text and will contribute nothing.',
      );
    }

    const stated = group.find((r) => r.statedTotal !== null)?.statedTotal ?? null;
    if (stated !== null && stated !== endPage - startPage + 1) {
      sectionWarnings.push(
        `The header says this section is ${stated} pages, but ${endPage - startPage + 1} were ` +
          'attributed to it. A neighbouring section may have absorbed some of it.',
      );
    }
    if (ordinals.length && ordinals[0] !== 1) {
      sectionWarnings.push(
        `The first page is numbered ${ordinals[0]} within the section, not 1 — earlier ` +
          'pages may be missing from the upload.',
      );
    }

    const repeat = seenNumbers.get(sectionNumber);
    if (repeat !== undefined) {
      sectionWarnings.push(
        `${sectionNumber} also appears at pages ${repeat}+. A section split across two ` +
          'places in the book usually means a page was misattributed.',
      );
    }
    seenNumbers.set(sectionNumber, startPage);

    const text = clean
      .slice(startPage - 1, endPage)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      sectionNumber,
      title: titled?.title ?? null,
      startPage,
      endPage,
      pageCount: endPage - startPage + 1,
      text,
      charCount: text.length,
      warnings: sectionWarnings,
    };
  });

  const empty = sections.filter((s) => s.charCount < 200);
  if (empty.length) {
    warnings.push(
      `${empty.length} detected section(s) have almost no text (${empty
        .map((s) => s.sectionNumber)
        .join(', ')}). They may be divider pages, or the book may need OCR.`,
    );
  }

  return { sections, pageCount: pages.length, method, furnitureRemoved: removed, warnings };
}
