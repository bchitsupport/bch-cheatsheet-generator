import { BLOCK_MODEL, RATES, generateSheetFromBlocks, type ComposeBlock } from '@/lib/anthropic';
import { estimateBuildCost, estimateSectionCost } from '@/lib/cost';
import { extractDataBlocks, totalBlockUsage, type BlockRequest } from '@/lib/data-blocks';
import { countPdfPages, extractPdfPages } from '@/lib/pdf-extract';
import { renderAll } from '@/lib/pdf-render';
import {
  buildManifest,
  describeCoverage,
  planReading,
  type Manifest,
} from '@/lib/section-router';
import { splitSpecBook } from '@/lib/spec-splitter';
import { getDivision, isDivisionId, type DivisionId } from '@/lib/upload-lists';
import type { ProjectInfo } from '@/lib/types';
import { requireAccess } from '@/lib/access';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * The whole pipeline behind one upload.
 *
 * Two stages, because a person has to look at the middle of it. Called without a
 * `trades` field it splits the book, works out what is in it, and stops — the
 * caller shows that manifest and asks which sheets to build. Called again with
 * the chosen trades it reads every section into a data block and composes each
 * sheet from them.
 *
 * Blocks are built once for the whole book, not once per sheet. That is what
 * makes reading a whole division for two trades affordable, and it is why the
 * two sheets agree with each other about anything they share.
 *
 * NDJSON throughout: this runs for tens of minutes and a client that waits for
 * response headers gives up long before the end.
 */
export async function POST(request: Request) {
  // Middleware cannot run on this route — see lib/access.ts.
  const denied = await requireAccess(request);
  if (denied) return denied;

  const encoder = new TextEncoder();
  const form = await request.formData();

  const uploads = form.getAll('files').filter((f): f is File => f instanceof File);
  const buffers = await Promise.all(uploads.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const requested = form
    .getAll('trades')
    .map(String)
    .filter((t): t is DivisionId => isDivisionId(t));
  // Sections outside Divisions 22/23 that the user ticked to have read in full.
  const alsoRead = new Set(form.getAll('alsoRead').map(String));

  const s = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
  const project: ProjectInfo = {
    projectName: s(form.get('projectName')),
    projectSub: s(form.get('projectSub')),
    preparerName: s(form.get('preparerName')),
    preparerTitle: s(form.get('preparerTitle')),
    preparerEmail: s(form.get('preparerEmail')),
    legendDrawing: s(form.get('legendDrawing')),
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

      const startedAt = Date.now();
      let beat: ReturnType<typeof setInterval> | undefined = setInterval(() => {
        try {
          send({ type: 'heartbeat', elapsedMs: Date.now() - startedAt });
        } catch {
          if (beat) clearInterval(beat);
          beat = undefined;
        }
      }, 10_000);

      try {
        if (buffers.length === 0) throw new Error('No files were uploaded.');

        // --- split
        send({ type: 'step', step: 'split' });
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

        // --- identify
        send({ type: 'step', step: 'identify' });
        const manifest: Manifest = await buildManifest(
          split.sections.map((sec) => ({
            sectionNumber: sec.sectionNumber,
            title: sec.title,
            text: sec.text,
          })),
        );

        // Index, not section number. A book can name the same number twice — a
        // divider page, a heading caught mid-page, a section genuinely split
        // across two places — and looking the source up by number gave both rows
        // the first one page range. Two identical rows reading "pages 5-5" for a
        // section that is really at 130 is what that looked like.
        const sectionsForReview = manifest.sections.map((routed, i) => {
          const source = split.sections[i];
          return {
            ...routed,
            startPage: source?.startPage ?? null,
            endPage: source?.endPage ?? null,
            pageCount: source?.pageCount ?? null,
            splitWarnings: source?.warnings ?? [],
          };
        });

        // Work the plan out for the trades the book actually contains, so the
        // review screen can say what will be read, what will only be pointed at,
        // and what that costs — before anyone commits to it.
        //
        // Everything from here on identifies a section by its position in the
        // split, never by its number. `routable` carries the classification and
        // the source text together so no later step has to look either up.
        const pageOfSection = (_n: string, i: number) => {
          const s = split.sections[i];
          return { startPage: s?.startPage ?? null, endPage: s?.endPage ?? null };
        };
        const routable = manifest.sections.map((routed, i) => ({
          ...routed,
          index: i,
          text: split.sections[i]?.text ?? '',
          pageCount: split.sections[i]?.pageCount ?? 0,
        }));

        const presentTrades = manifest.trades.filter((t) => t.present).map((t) => t.id);
        const preview = planReading(
          manifest,
          presentTrades.length ? presentTrades : (['plumbing', 'sheetmetal', 'hydronic'] as DivisionId[]),
          routable,
          pageOfSection,
        );

        const willRead = new Set(preview.toRead.map((s) => s.index));
        // The referred set has to come from the plan, not be re-derived as
        // "relevant but unread": the plan drops administrative divisions and
        // collapses duplicates, so inferring it again showed 94 sections on the
        // review screen for the 34 that actually reach the checklist.
        // Carried as positions, like willRead. As a set of section numbers it
        // marked every row sharing a pointed-at number, so a book naming
        // 03 30 00 three times listed three identical pointers for the one entry
        // that reaches the checklist — and gave React three rows with one key.
        // planReading keeps the first occurrence of each number, and it walks in
        // index order, so the first match is the one the pointer describes.
        const referredNumbers = new Set(
          Object.values(preview.referred).flatMap((list) => list.map((r) => r.sectionNumber)),
        );
        const willRefer = new Set(
          [...referredNumbers]
            .map((n) => manifest.sections.findIndex((s) => s.sectionNumber === n))
            .filter((i) => i !== -1),
        );
        const readPages = preview.toRead.reduce((sum, s) => sum + s.pageCount, 0);

        send({
          type: 'manifest',
          sections: sectionsForReview.map((s, i) => ({
            ...s,
            willRead: willRead.has(i),
            willRefer: willRefer.has(i),
            addCost: willRead.has(i)
              ? 0
              : estimateSectionCost(routable[i]?.pageCount ?? 0, BLOCK_MODEL),
          })),
          trades: manifest.trades,
          pageCount: split.pageCount,
          method: split.method,
          furnitureRemoved: split.furnitureRemoved,
          readPages,
          estimate: estimateBuildCost(readPages, Math.max(presentTrades.length, 1), BLOCK_MODEL),
          warnings: [...split.warnings, ...manifest.warnings],
        });

        // Stage one ends here. The caller decides what to build.
        if (requested.length === 0) {
          send({ type: 'awaiting-selection' });
          return;
        }

        if (!project.projectName) throw new Error('Project name is required.');
        if (!project.preparerName) throw new Error('Preparer name is required.');

        // --- decide what to read
        const plan = planReading(manifest, requested, routable, pageOfSection, alsoRead);
        const relevant = plan.toRead;

        const referredCount = new Set(
          requested.flatMap((t) => plan.referred[t].map((r) => r.sectionNumber)),
        ).size;
        if (referredCount > 0) {
          send({
            type: 'warning',
            message:
              `${referredCount} section${referredCount === 1 ? '' : 's'} outside Divisions 22 ` +
              'and 23 relate to this work — fire suppression, alarm interlocks and the like. ' +
              'They are not being read, but each is named on the checklist with its page range ' +
              'so it can be checked directly.',
          });
        }

        const blockRequests: BlockRequest[] = relevant.map((sec) => ({
          sectionNumber: sec.sectionNumber,
          title: sec.title,
          text: sec.text,
          targets: Object.fromEntries(
            requested
              .filter((t) => sec.roles[t] === 'primary')
              .map((t) => [t, sec.targets[t] ?? []]),
          ),
          supportingFor: requested.filter((t) => sec.roles[t] === 'supporting'),
        }));

        send({ type: 'step', step: 'read', total: blockRequests.length });
        const blocks = await extractDataBlocks(blockRequests, BLOCK_MODEL, (p) =>
          send({ type: 'progress', ...p }),
        );

        const blockUsage = totalBlockUsage(blocks);
        const rate = RATES[BLOCK_MODEL] ?? RATES['claude-opus-5'];
        send({
          type: 'usage',
          phase: 'read',
          model: BLOCK_MODEL,
          sections: blockUsage.calls,
          inputTokens: blockUsage.inputTokens,
          outputTokens: blockUsage.outputTokens,
          cacheReadTokens: blockUsage.cacheReadTokens,
          dollars:
            (blockUsage.inputTokens * rate.input + blockUsage.outputTokens * rate.output) /
            1_000_000,
        });

        const failed = blocks.filter((b) => b.error);
        for (const b of failed) {
          send({ type: 'warning', message: `Could not read ${b.sectionNumber}: ${b.error}` });
        }

        // Blocks come back index-aligned with the requests, which are aligned
        // with `relevant`. Keyed by section number instead, a book naming the
        // same number twice would compose both rows from one block.
        const blockAt = (i: number) => blocks[i];

        // --- one sheet per trade, all from the same blocks
        for (const trade of requested) {
          const division = getDivision(trade);
          send({ type: 'step', step: 'compose', trade });

          const forTrade: ComposeBlock[] = relevant
            .map((sec, i) => [sec, blockAt(i)] as const)
            .filter(([sec, b]) => sec.roles[trade] !== 'none' && Boolean(b) && !b.error && Boolean(b.markdown))
            .map(([, b]) => ({
              sectionNumber: b.sectionNumber,
              title: b.title,
              markdown: b.markdown,
            }));

          if (forTrade.length === 0) {
            send({ type: 'warning', message: `No usable sections for ${division.name} — skipped.` });
            continue;
          }

          const output = await generateSheetFromBlocks(
            division,
            project,
            forTrade,
            plan.referred[trade],
            describeCoverage(manifest.trades, requested),
          );
          const [cheatsheet, checklist] = await renderAll([
            output.cheatsheetHtml,
            output.checklistHtml,
          ]);

          send({
            type: 'sheet',
            trade,
            name: division.name,
            cheatsheetPdf: cheatsheet.toString('base64'),
            checklistPdf: checklist.toString('base64'),
            pageCount: await countPdfPages(cheatsheet),
            blockCount: forTrade.length,
            discrepancies: output.discrepancies,
            recoveredChecklist: output.recoveredChecklist,
          });
        }

        send({ type: 'done', elapsedMs: Date.now() - startedAt });
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Build failed.' });
      } finally {
        if (beat) clearInterval(beat);
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
