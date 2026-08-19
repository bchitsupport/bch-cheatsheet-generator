/**
 * The whole pipeline from one upload: split, identify, read, compose.
 *
 *   npm run dev                                       # in another terminal
 *   node scripts/build-sheets.mjs <dir|file.pdf>                    # review only
 *   node scripts/build-sheets.mjs <dir|file.pdf> --build [outDir]   # build too
 *   node scripts/build-sheets.mjs <dir> --build --trades hydronic,sheetmetal
 *
 * Without --build it stops after the manifest and shows what it found, which
 * costs one small model call. With --build it builds every trade the manifest
 * says is present, unless --trades names a subset.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const args = process.argv.slice(2);
const build = args.includes('--build');
const tradesArg = args.includes('--trades') ? args[args.indexOf('--trades') + 1] : null;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--trades');
const [target, outDir = 'out/build'] = positional;

if (!target) {
  console.error('usage: node scripts/build-sheets.mjs <dir|file.pdf> [--build] [outDir] [--trades a,b]');
  process.exit(1);
}
if (build && !process.env.PROJECT_NAME) {
  console.error('PROJECT_NAME is not set — refusing to build rather than banner the wrong job.');
  process.exit(1);
}

try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(`No dev server at ${BASE}. Start one with:  npm run dev`);
  process.exit(1);
}

const isDir = fs.statSync(target).isDirectory();
const files = isDir
  ? fs.readdirSync(target).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
  : [path.basename(target)];
const dir = isDir ? target : path.dirname(target);

const startedAt = Date.now();
const at = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`.padStart(5);

async function run(trades) {
  const form = new FormData();
  for (const name of files) {
    form.append(
      'files',
      new Blob([fs.readFileSync(path.join(dir, name))], { type: 'application/pdf' }),
      name,
    );
  }
  for (const t of trades) form.append('trades', t);
  if (trades.length) {
    form.set('projectName', process.env.PROJECT_NAME);
    form.set('projectSub', process.env.PROJECT_SUB ?? '');
    form.set('preparerName', process.env.PREPARER_NAME ?? 'Joshua Ahwai');
    form.set('preparerTitle', process.env.PREPARER_TITLE ?? 'Assistant Project Manager Intern');
    form.set('preparerEmail', process.env.PREPARER_EMAIL ?? 'joshua.ahwai@bchmechanical.com');
    form.set('legendDrawing', process.env.LEGEND_DRAWING ?? '');
  }

  const res = await fetch(`${BASE}/api/build`, { method: 'POST', body: form });

  // A non-200 has no NDJSON in it, so the loop below would find no frames and
  // the run would report success having built nothing. Seen for real: editing
  // files mid-run made Next rebuild, and the next request 404'd as a stale
  // deployment while the script exited 0.
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(
      `POST /api/build returned ${res.status}.` +
        (res.status === 404
          ? ' The dev server rebuilt mid-run — restart it and try again.'
          : '') +
        (detail ? `\n${detail}` : ''),
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const out = { manifest: null, sheets: [], failure: null };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const e = JSON.parse(line);
      switch (e.type) {
        case 'step':
          console.log(`[${at()}] ${e.step}${e.trade ? ` — ${e.trade}` : ''}${e.total ? ` (${e.total} sections)` : ''}`);
          break;
        case 'progress':
          console.log(`[${at()}]   ${String(e.done).padStart(2)}/${e.total}  ${e.sectionNumber}`);
          break;
        case 'manifest':
          out.manifest = e;
          break;
        case 'sheet':
          out.sheets.push(e);
          console.log(`[${at()}] built ${e.name} — ${e.pageCount}p, ${e.discrepancies.length} discrepancies`);
          break;
        case 'warning':
          console.log(`[${at()}] ! ${e.message}`);
          break;
        case 'error':
          out.failure = e.message;
          break;
      }
    }
  }
  return out;
}

// ---- stage one: what is in this upload
const review = await run([]);
if (review.failure) {
  console.error(`\nFAILED: ${review.failure}`);
  process.exit(1);
}

const m = review.manifest;
console.log(
  `\n${m.pageCount} pages · ${m.sections.length} sections · split by ${m.method} · ` +
    `${m.furnitureRemoved.toLocaleString()} chars of furniture removed\n`,
);
const MARK = { primary: 'P', supporting: 's', none: '·' };
console.log('  SECTION      PLB SMT HYD  PAGES  WHAT IT IS');
for (const s of m.sections) {
  const marks = ['plumbing', 'sheetmetal', 'hydronic'].map((t) => ` ${MARK[s.roles[t]]} `).join(' ');
  console.log(
    `  ${s.sectionNumber.padEnd(12)} ${marks} ${String(s.pageCount ?? '?').padStart(3)}p  ` +
      `${(s.summary || s.title || '').slice(0, 58)}`,
  );
}
console.log('\nTRADES FOUND');
for (const t of m.trades) {
  console.log(`  ${t.present ? '[x]' : '[ ]'} ${t.name.padEnd(34)} ${t.primaryCount} primary`);
  console.log(`      ${t.note}`);
}
for (const w of m.warnings) console.log(`\n! ${w}`);

if (!build) {
  console.log('\n(review only — pass --build to generate)');
  process.exit(0);
}

// ---- stage two: build
const trades = tradesArg
  ? tradesArg.split(',').map((t) => t.trim())
  : m.trades.filter((t) => t.present).map((t) => t.id);

if (trades.length === 0) {
  console.error('\nNo trade is present in this upload — nothing to build.');
  process.exit(1);
}

console.log(`\nBuilding: ${trades.join(', ')}\n`);
const result = await run(trades);
if (result.failure) {
  console.error(`\nFAILED: ${result.failure}`);
  process.exit(1);
}
if (result.sheets.length === 0) {
  console.error('\nFAILED: the build reported no error but produced no sheets.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
console.log('\n─────────────────────────────────────────');
for (const sheet of result.sheets) {
  const sheetPath = path.join(outDir, `${sheet.trade}-cheat-sheet.pdf`);
  const listPath = path.join(outDir, `${sheet.trade}-checklist.pdf`);
  fs.writeFileSync(sheetPath, Buffer.from(sheet.cheatsheetPdf, 'base64'));
  fs.writeFileSync(listPath, Buffer.from(sheet.checklistPdf, 'base64'));

  const sev = {};
  for (const d of sheet.discrepancies) {
    const k = (d.severity ?? 'unknown').toLowerCase();
    sev[k] = (sev[k] ?? 0) + 1;
  }
  console.log(`  ${sheet.name}`);
  console.log(`    pages ${sheet.pageCount}   blocks ${sheet.blockCount}   discrepancies ${sheet.discrepancies.length} ${JSON.stringify(sev)}`);
  if (sheet.recoveredChecklist) console.log('    ! checklist came from a salvage pass');
  console.log(`    ${sheetPath}`);
}
console.log(`  total ${at()}`);
console.log('─────────────────────────────────────────');
