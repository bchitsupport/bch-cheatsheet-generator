import { NextResponse } from 'next/server';
import { extractPdfText } from '@/lib/pdf-extract';
import {
  extractSectionNumber,
  extractSectionTitle,
  matchToDivision,
} from '@/lib/section-matcher';
import { getDivision, isDivisionId } from '@/lib/upload-lists';
import type { ExtractedFile } from '@/lib/types';
import { requireAccess } from '@/lib/access';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Extract text + CSI section number from uploaded PDFs.
 *
 * This runs as soon as files are dropped so the section checklist can fill in
 * immediately. The extracted text comes back to the browser and is posted to
 * /api/generate as JSON, so the PDFs themselves are only uploaded once.
 */
export async function POST(request: Request) {
  // Middleware cannot run on this route — see lib/access.ts.
  const denied = await requireAccess(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const divisionId = form.get('division');

    if (!isDivisionId(divisionId)) {
      return NextResponse.json({ error: 'Missing or unknown division.' }, { status: 400 });
    }
    const division = getDivision(divisionId);

    const uploads = form.getAll('files').filter((f): f is File => f instanceof File);
    if (uploads.length === 0) {
      return NextResponse.json({ error: 'No files were uploaded.' }, { status: 400 });
    }

    const files: ExtractedFile[] = [];

    for (const file of uploads) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { text, firstPage, pageCount } = await extractPdfText(buffer);

        if (!text.trim()) {
          files.push({
            id,
            fileName: file.name,
            sectionNumber: null,
            matchedSection: null,
            title: null,
            pageCount,
            charCount: 0,
            text: '',
            error: 'No text found — this looks like a scanned PDF. Run OCR on it first.',
          });
          continue;
        }

        const sectionNumber = extractSectionNumber(firstPage) ?? extractSectionNumber(text);

        files.push({
          id,
          fileName: file.name,
          sectionNumber,
          matchedSection: matchToDivision(sectionNumber, division),
          title: extractSectionTitle(firstPage),
          pageCount,
          charCount: text.length,
          text,
        });
      } catch (err) {
        files.push({
          id,
          fileName: file.name,
          sectionNumber: null,
          matchedSection: null,
          title: null,
          pageCount: 0,
          charCount: 0,
          text: '',
          error: err instanceof Error ? err.message : 'Could not read this PDF.',
        });
      }
    }

    return NextResponse.json({ files });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
