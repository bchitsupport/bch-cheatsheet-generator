// Deep import on purpose: pdf-parse's index.js runs a debug block that reads a
// test fixture off disk when `module.parent` is falsy. That file doesn't exist
// in a bundled/serverless deploy, so importing the package root throws at load.
// The lib entry point is the actual parser and has no such side effect.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface PdfText {
  /** Full document text, pages joined by blank lines. */
  text: string;
  /** Page 1 only — what section matching reads. */
  firstPage: string;
  pageCount: number;
}

/**
 * Reimplements pdf-parse's default page renderer so we can keep the per-page
 * split. The default joins everything into one string and we lose page 1.
 */
function makePageCollector(pages: string[]) {
  return async function renderPage(pageData: any): Promise<string> {
    const textContent = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });

    let lastY: number | undefined;
    let text = '';
    for (const item of textContent.items) {
      if (lastY === item.transform[5] || lastY === undefined) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }

    pages.push(text);
    return text;
  };
}

export async function extractPdfText(buffer: Buffer): Promise<PdfText> {
  const pages: string[] = [];
  const result = await pdfParse(buffer, { pagerender: makePageCollector(pages) });

  return {
    text: normalize(result.text),
    firstPage: normalize(pages[0] ?? ''),
    pageCount: result.numpages,
  };
}

/**
 * Per-page text, kept separate.
 *
 * The splitter needs pages as distinct units: a combined division book stamps
 * every page with the section it belongs to, so attribution is per page rather
 * than something inferred from where boundaries fall.
 */
export async function extractPdfPages(
  buffer: Buffer,
): Promise<{ pages: string[]; pageCount: number }> {
  const pages: string[] = [];
  const result = await pdfParse(buffer, { pagerender: makePageCollector(pages) });
  return { pages: pages.map(normalize), pageCount: result.numpages };
}

/**
 * Page count of a PDF we produced — used for the results summary.
 *
 * pdf-parse bundles pdf.js 1.10 (2018), which rejects some perfectly valid
 * Chromium output with "bad XRef entry". Rather than show "—" when that
 * happens, fall back to counting page objects in the raw file.
 */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const result = await pdfParse(buffer, { max: 0 });
    if (result.numpages > 0) return result.numpages;
  } catch {
    /* fall through to the byte-level count */
  }
  return countPageObjects(buffer);
}

/**
 * Every page in a PDF is an object with `/Type /Page` (not `/Pages`, which is
 * the tree node). Chromium writes these uncompressed, so a scan is reliable
 * here even though it would not be for arbitrary PDFs.
 */
function countPageObjects(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

/**
 * Specs are full of soft hyphens, non-breaking spaces, and page furniture that
 * burns tokens without carrying meaning. Collapse the worst of it.
 */
function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '') // soft hyphen
    .replace(/[   ]/g, ' ') // non-breaking spaces
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
