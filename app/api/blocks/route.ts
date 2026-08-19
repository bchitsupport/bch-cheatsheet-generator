import { BLOCK_MODEL } from '@/lib/anthropic';
import { extractDataBlocks, type BlockRequest } from '@/lib/data-blocks';
import { extractPdfPages } from '@/lib/pdf-extract';
import { buildManifest } from '@/lib/section-router';
import { splitSpecBook } from '@/lib/spec-splitter';
import type { DivisionId } from '@/lib/upload-lists';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Phase 1 end to end: split an upload, work out what each section is, then read
 * every section into its own data block.
 *
 * Streams NDJSON because this runs one call per section and takes minutes — the
 * caller should see sections landing rather than a blank wait.
 */
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const form = await request.formData();
  const uploads = form.getAll('files').filter((f): f is File => f instanceof File);
  const model = (form.get('model') as string) || BLOCK_MODEL;

  const buffers = await Promise.all(uploads.map(async (f) => Buffer.from(await f.arrayBuffer())));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

      try {
        if (buffers.length === 0) throw new Error('No files were uploaded.');

        const pages: string[] = [];
        let declaredPages = 0;
        for (const buffer of buffers) {
          const extracted = await extractPdfPages(buffer);
          declaredPages += extracted.pageCount;
          pages.push(...extracted.pages);
        }

        const split = splitSpecBook(pages, declaredPages);
        if (split.sections.length === 0) {
          throw new Error(split.warnings[0] ?? 'No sections were found in this upload.');
        }
        send({ type: 'split', sections: split.sections.length, pageCount: split.pageCount });

        const manifest = await buildManifest(
          split.sections.map((s) => ({
            sectionNumber: s.sectionNumber,
            title: s.title,
            text: s.text,
          })),
        );
        send({ type: 'manifest', trades: manifest.trades, warnings: manifest.warnings });

        const textByNumber = new Map(split.sections.map((s) => [s.sectionNumber, s.text]));
        const requests: BlockRequest[] = manifest.sections
          .filter((s) => Object.values(s.roles).some((r) => r !== 'none'))
          .map((s) => ({
            sectionNumber: s.sectionNumber,
            title: s.title,
            text: textByNumber.get(s.sectionNumber) ?? '',
            targets: s.targets,
            supportingFor: (Object.keys(s.roles) as DivisionId[]).filter(
              (id) => s.roles[id] === 'supporting',
            ),
          }));

        send({ type: 'start', total: requests.length });

        const blocks = await extractDataBlocks(requests, model, (p) =>
          send({ type: 'progress', ...p }),
        );

        send({ type: 'done', blocks, model });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Phase 1 failed.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
