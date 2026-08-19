import { NextResponse } from 'next/server';
import { extractPdfPages } from '@/lib/pdf-extract';
import { splitSpecBook } from '@/lib/spec-splitter';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Split one or more uploaded PDFs into CSI sections.
 *
 * Several files are concatenated in the order given before splitting, so a book
 * delivered in parts works, and so a set of single-section files can be run
 * through the same path to check the splitter against a known answer.
 *
 * Returns the sections with their text. Pass `meta=1` to get everything except
 * the text, which is what a review screen needs.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const uploads = form.getAll('files').filter((f): f is File => f instanceof File);

    if (uploads.length === 0) {
      return NextResponse.json({ error: 'No files were uploaded.' }, { status: 400 });
    }

    const pages: string[] = [];
    let declaredPages = 0;
    const sources: { fileName: string; startPage: number; pageCount: number }[] = [];

    for (const file of uploads) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfPages(buffer);
      sources.push({
        fileName: file.name,
        startPage: pages.length + 1,
        pageCount: extracted.pageCount,
      });
      declaredPages += extracted.pageCount;
      pages.push(...extracted.pages);
    }

    const result = splitSpecBook(pages, declaredPages);
    const metaOnly = form.get('meta') === '1';

    return NextResponse.json({
      ...result,
      sources,
      sections: result.sections.map((s) => (metaOnly ? { ...s, text: undefined } : s)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Split failed.' },
      { status: 500 },
    );
  }
}
