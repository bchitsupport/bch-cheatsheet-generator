import { LARGE_INPUT_THRESHOLD, generateSheet, type SpecInput } from '@/lib/anthropic';
import { countPdfPages } from '@/lib/pdf-extract';
import { renderAll } from '@/lib/pdf-render';
import { getDivision, isDivisionId } from '@/lib/upload-lists';
import type { GenerateEvent, ExtractedFile, ProjectInfo } from '@/lib/types';

export const runtime = 'nodejs';

/**
 * 300s is Vercel Hobby's default AND its hard maximum — it cannot be raised on
 * that plan, and setting a higher value fails the deployment. On Pro, raise this
 * to 800 (and set ANTHROPIC_EFFORT=high, which does not fit inside 300s).
 */
export const maxDuration = 300;
const FUNCTION_LIMIT_SECONDS = 300;

const ON_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

/**
 * Above this much spec text, a hosted run is likely to hit the ceiling.
 * Derived from a measured 184,860-character Division 23 job that finished at
 * 286.6s of the 300s budget — so ~170k is the point where the margin stops being
 * meaningful. Local runs have no limit and are never warned.
 */
const TIMEOUT_RISK_CHARS = 170_000;

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

        const readable = all.filter((f) => !f.error && f.text?.trim());
        const primary = readable.filter((f) => f.matchedSection);
        // A section outside the division's list is still part of the division and
        // can govern this trade's work — a shared hanger schedule, a
        // division-wide test pressure. Previously these were dropped, so a
        // requirement that lived in a neighbouring section never reached the
        // sheet. They now go in as supporting context instead.
        const supporting = readable.filter((f) => !f.matchedSection);

        if (primary.length === 0) {
          throw new Error(
            'None of the uploaded files matched a required section for this division.',
          );
        }

        if (supporting.length > 0) {
          const notice =
            `Reading ${supporting.length} extra section${supporting.length === 1 ? '' : 's'} ` +
            'as supporting context — they are not part of this division\'s outline, but any ' +
            'requirement in them that governs this trade will be carried onto the sheet and ' +
            'any conflict logged.';
          warnings.push(notice);
          send({ type: 'warning', message: notice });
        }

        const bySection = (a: ExtractedFile, b: ExtractedFile) =>
          (a.matchedSection ?? a.sectionNumber ?? '').localeCompare(
            b.matchedSection ?? b.sectionNumber ?? '',
          );

        const specs: SpecInput[] = [
          ...primary.slice().sort(bySection).map((f) => ({
            fileName: f.fileName,
            sectionNumber: f.matchedSection!,
            text: f.text,
            role: 'primary' as const,
          })),
          ...supporting.slice().sort(bySection).map((f) => ({
            fileName: f.fileName,
            sectionNumber: f.sectionNumber ?? f.fileName,
            text: f.text,
            role: 'supporting' as const,
          })),
        ];

        const totalChars = specs.reduce((sum, s) => sum + s.text.length, 0);

        // Serverless has a wall-clock ceiling the model call does not know about.
        // Measured on Vercel Hobby (300s max): a 184,860-character Division 23 job
        // finished at 286.6s — 13 seconds of margin. Rather than let someone wait
        // five minutes to find out, say so before starting.
        if (ON_SERVERLESS && totalChars > TIMEOUT_RISK_CHARS) {
          const warning =
            `At ${totalChars.toLocaleString()} characters this job is close to the ` +
            `${FUNCTION_LIMIT_SECONDS}-second limit of the hosted version — a comparable ` +
            'run finished with only seconds to spare. If it stops without producing a ' +
            'sheet, that is the time limit, not your specs: split the upload into two ' +
            'batches, or run the tool locally where there is no limit.';
          warnings.push(warning);
          send({ type: 'warning', message: warning });
        }
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
