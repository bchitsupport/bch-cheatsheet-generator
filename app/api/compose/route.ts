import { generateSheetFromBlocks, type ComposeBlock } from '@/lib/anthropic';
import { countPdfPages } from '@/lib/pdf-extract';
import { renderAll } from '@/lib/pdf-render';
import { getDivision, isDivisionId } from '@/lib/upload-lists';
import type { ProjectInfo } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface ComposeBody {
  division?: unknown;
  project?: Partial<ProjectInfo>;
  blocks?: ComposeBlock[];
}

/**
 * Phase 2 — build a sheet and checklist from Phase 1 data blocks.
 *
 * Separate from /api/blocks on purpose: blocks are built once per book and every
 * sheet composes from the same set, so re-running a compose after a prompt change
 * costs one call rather than re-reading the whole division.
 */
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const body = (await request.json()) as ComposeBody;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

      const startedAt = Date.now();

      /**
       * A compose takes about ten minutes and says nothing while it works.
       * Node's fetch abandons a request whose response headers have not arrived
       * within five, so a plain JSON response is unreachable from a script —
       * the first attempt died on UND_ERR_HEADERS_TIMEOUT. Headers go out with
       * the first frame, and the beat keeps intermediaries from dropping an
       * idle connection.
       */
      let beat: ReturnType<typeof setInterval> | undefined;
      const stopBeat = () => {
        if (beat) clearInterval(beat);
        beat = undefined;
      };
      beat = setInterval(() => {
        try {
          send({ type: 'heartbeat', elapsedMs: Date.now() - startedAt });
        } catch {
          stopBeat();
        }
      }, 10_000);

      try {
        if (!isDivisionId(body.division)) throw new Error('Missing or unknown division.');
        const division = getDivision(body.division);

        const blocks = Array.isArray(body.blocks) ? body.blocks : [];
        if (blocks.length === 0) throw new Error('No data blocks were supplied.');

        const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
        const project: ProjectInfo = {
          projectName: s(body.project?.projectName),
          projectSub: s(body.project?.projectSub),
          preparerName: s(body.project?.preparerName),
          preparerTitle: s(body.project?.preparerTitle),
          preparerEmail: s(body.project?.preparerEmail),
          legendDrawing: s(body.project?.legendDrawing),
        };
        if (!project.projectName) throw new Error('Project name is required.');
        if (!project.preparerName) throw new Error('Preparer name is required.');

        send({ type: 'step', step: 'compose' });
        const output = await generateSheetFromBlocks(division, project, blocks);

        send({ type: 'step', step: 'render' });
        const [cheatsheet, checklist] = await renderAll([
          output.cheatsheetHtml,
          output.checklistHtml,
        ]);
        const pageCount = await countPdfPages(cheatsheet);

        send({
          type: 'done',
          result: {
            cheatsheetPdf: cheatsheet.toString('base64'),
            checklistPdf: checklist.toString('base64'),
            pageCount,
            blockCount: blocks.length,
            discrepancies: output.discrepancies,
            recoveredChecklist: output.recoveredChecklist,
          },
        });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Compose failed.',
        });
      } finally {
        stopBeat();
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
