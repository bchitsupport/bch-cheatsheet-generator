import { LARGE_INPUT_THRESHOLD, generateSheet, type SpecInput } from '@/lib/anthropic';
import { countPdfPages } from '@/lib/pdf-extract';
import { renderAll } from '@/lib/pdf-render';
import { getDivision, isDivisionId } from '@/lib/upload-lists';
import type { GenerateEvent, ExtractedFile, ProjectInfo } from '@/lib/types';

export const runtime = 'nodejs';
// Vercel Hobby caps this at 60s; Pro allows 300. Either way the client sees
// progress the whole time because the response streams.
export const maxDuration = 300;

interface GenerateBody {
  division?: unknown;
  project?: Partial<ProjectInfo>;
  files?: ExtractedFile[];
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

      const startedAt = Date.now();

      /**
       * Keeps the response stream from going silent. The model call runs for
       * minutes without emitting anything, and an idle stream is dropped by
       * proxies between the browser and the function (seen live as ECONNRESET
       * ~40s in). Ten seconds is comfortably inside any common idle timeout.
       */
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const startHeartbeat = () => {
        heartbeat ??= setInterval(() => {
          try {
            send({ type: 'heartbeat', elapsedMs: Date.now() - startedAt });
          } catch {
            stopHeartbeat(); // stream already closed
          }
        }, 10_000);
      };
      const stopHeartbeat = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = undefined;
      };

      try {
        const body = (await request.json()) as GenerateBody;

        if (!isDivisionId(body.division)) {
          throw new Error('Missing or unknown division.');
        }
        const division = getDivision(body.division);
        const project = normalizeProject(body.project);

        if (!project.projectName) throw new Error('Project name is required.');
        if (!project.preparerName) throw new Error('Preparer name is required.');

        const warnings: string[] = [];

        // --- 1. Extraction (already done client-side; validate and select here)
        send({ type: 'step', step: 'extract' });

        const all = Array.isArray(body.files) ? body.files : [];

        for (const f of all.filter((f) => f.error)) {
          const warning = `Skipped ${f.fileName}: ${f.error}`;
          warnings.push(warning);
          send({ type: 'warning', message: warning });
        }

        const usable = all.filter((f) => !f.error && f.text?.trim() && f.matchedSection);

        for (const f of all.filter((f) => !f.error && f.text?.trim() && !f.matchedSection)) {
          const warning = `Not needed for this division — skipped ${f.fileName}${
            f.sectionNumber ? ` (${f.sectionNumber})` : ''
          }.`;
          warnings.push(warning);
          send({ type: 'warning', message: warning });
        }

        if (usable.length === 0) {
          throw new Error(
            'None of the uploaded files matched a required section for this division.',
          );
        }

        const specs: SpecInput[] = usable
          .slice()
          .sort((a, b) => (a.matchedSection ?? '').localeCompare(b.matchedSection ?? ''))
          .map((f) => ({
            fileName: f.fileName,
            sectionNumber: f.matchedSection!,
            text: f.text,
          }));

        const totalChars = specs.reduce((sum, s) => sum + s.text.length, 0);
        if (totalChars > LARGE_INPUT_THRESHOLD) {
          const warning =
            `These specs total ${totalChars.toLocaleString()} characters, past the ` +
            `${LARGE_INPUT_THRESHOLD.toLocaleString()} point where coverage of the later ` +
            'sections starts to thin out. Generating anyway — check the discrepancy log, ' +
            'and consider splitting into two batches if sections look shallow.';
          warnings.push(warning);
          send({ type: 'warning', message: warning });
        }

        // --- 2 + 3. Read the specs and write the sheet (one model call)
        send({ type: 'step', step: 'read' });
        startHeartbeat();
        const output = await generateSheet(division, project, specs);
        stopHeartbeat();

        if (output.recoveredChecklist) {
          const warning =
            'The sheet used the whole response budget, so the checklist and ' +
            'discrepancy log were generated in a second pass. Both are complete — ' +
            'but if the sheet cites a discrepancy number that is not in the log, ' +
            'regenerate to get them back in sync.';
          warnings.push(warning);
          send({ type: 'warning', message: warning });
        }

        send({ type: 'step', step: 'generate' });

        // --- 4 + 5. Render both documents in one browser. Chromium's cold
        // start on a serverless host is slow enough to be worth covering too.
        send({ type: 'step', step: 'render' });
        startHeartbeat();
        const [cheatsheet, checklist] = await renderAll([
          output.cheatsheetHtml,
          output.checklistHtml,
        ]);
        stopHeartbeat();

        send({ type: 'step', step: 'checklist' });
        const pageCount = await countPdfPages(cheatsheet);

        send({
          type: 'done',
          result: {
            cheatsheetPdf: cheatsheet.toString('base64'),
            checklistPdf: checklist.toString('base64'),
            sectionCount: output.sectionCount,
            pageCount,
            discrepancies: output.discrepancies,
            warnings,
          },
        });
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Generation failed.',
        });
      } finally {
        stopHeartbeat();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      // Stop nginx-style proxies from buffering the progress frames.
      'X-Accel-Buffering': 'no',
    },
  });
}

function normalizeProject(p: Partial<ProjectInfo> | undefined): ProjectInfo {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    projectName: s(p?.projectName),
    projectSub: s(p?.projectSub),
    preparerName: s(p?.preparerName),
    preparerTitle: s(p?.preparerTitle),
    preparerEmail: s(p?.preparerEmail),
    legendDrawing: s(p?.legendDrawing),
  };
}
