/**
 * Phase 2: build a sheet from data blocks already on disk.
 *
 *   node scripts/compose.mjs <blocksDir> <division> [outDir]
 *   node scripts/compose.mjs out/blocks-div23 sheetmetal out/v2-sheetmetal
 *
 * Blocks are built once per book; every sheet composes from the same set. So a
 * prompt change costs one call to re-test, not a re-read of the whole division.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const [blocksDir, division, outDir = `out/compose-${division}`] = process.argv.slice(2);

if (!blocksDir || !division) {
  console.error('usage: node scripts/compose.mjs <blocksDir> <division> [outDir]');
  process.exit(1);
}
if (!process.env.PROJECT_NAME) {
  console.error('PROJECT_NAME is not set — refusing to run rather than banner the wrong job.');
  process.exit(1);
}

const files = fs
  .readdirSync(blocksDir)
  .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .sort();

if (files.length === 0) {
  console.error(`No block files in ${blocksDir}`);
  process.exit(1);
}

const blocks = files.map((f) => {
  const markdown = fs.readFileSync(path.join(blocksDir, f), 'utf8');
  const m = markdown.match(/^## DATA BLOCK — (\S+(?: \S+)*?)\s+(.*)$/m);
  return {
    sectionNumber: m?.[1] ?? path.basename(f, '.md').replace(/-/g, ' '),
    title: m?.[2] ?? null,
    markdown,
  };
});

const chars = blocks.reduce((n, b) => n + b.markdown.length, 0);
console.log(`${blocks.length} blocks · ${chars.toLocaleString()} chars → ${division}`);
console.log('Composing — several minutes.\n');

const startedAt = Date.now();
const res = await fetch(`${BASE}/api/compose`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    division,
    blocks,
    project: {
      projectName: process.env.PROJECT_NAME,
      projectSub: process.env.PROJECT_SUB ?? '',
      preparerName: process.env.PREPARER_NAME ?? 'Joshua Ahwai',
      preparerTitle: process.env.PREPARER_TITLE ?? 'Assistant Project Manager Intern',
      preparerEmail: process.env.PREPARER_EMAIL ?? 'joshua.ahwai@bchmechanical.com',
      legendDrawing: process.env.LEGEND_DRAWING ?? '',
    },
  }),
});

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
let r = null;
let failure = null;

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  const lines = buf.split('\n');
  buf = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    const at = `${((Date.now() - startedAt) / 1000).toFixed(0)}s`.padStart(5);
    if (e.type === 'step') console.log(`[${at}] ${e.step}`);
    else if (e.type === 'done') r = e.result;
    else if (e.type === 'error') failure = e.message;
  }
}

if (failure || !r) {
  console.error(`FAILED: ${failure ?? 'stream closed with no result'}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const sheetPath = path.join(outDir, `${division}-cheat-sheet.pdf`);
const listPath = path.join(outDir, `${division}-checklist.pdf`);
fs.writeFileSync(sheetPath, Buffer.from(r.cheatsheetPdf, 'base64'));
fs.writeFileSync(listPath, Buffer.from(r.checklistPdf, 'base64'));

const bySeverity = {};
for (const d of r.discrepancies) {
  const k = (d.severity ?? 'unknown').toLowerCase();
  bySeverity[k] = (bySeverity[k] ?? 0) + 1;
}

console.log('─────────────────────────────────────────');
console.log(`  blocks used      ${r.blockCount}`);
console.log(`  sheet pages      ${r.pageCount}`);
console.log(`  discrepancies    ${r.discrepancies.length}`);
for (const [sev, n] of Object.entries(bySeverity).sort()) {
  console.log(`      ${sev.padEnd(12)} ${n}`);
}
if (r.recoveredChecklist) console.log('  ! checklist came from a salvage pass');
console.log(`  wall clock       ${((Date.now() - startedAt) / 1000).toFixed(0)}s`);
console.log('─────────────────────────────────────────');
console.log(`\n  ${sheetPath}\n  ${listPath}`);
