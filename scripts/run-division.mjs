/**
 * Run a whole division through the real API routes and report what came out.
 *
 * The pipeline is otherwise only reachable through the browser, which makes it
 * awkward to produce a baseline — to compare against the skill route, or against
 * a previous build after a prompt change. This drives the same two endpoints the
 * page does, so the numbers it prints are the numbers a user would get.
 *
 *   npm run dev                                    # in another terminal
 *   node scripts/run-division.mjs plumbing "C:\path\to\specs" out/div22
 *
 * Costs real API usage — roughly $1.81 for a full division on Opus.
 */
import fs from 'node:fs';
import path from 'node:path';

const [divisionId, specDir, outDir = 'out'] = process.argv.slice(2);
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';

if (!divisionId || !specDir) {
  console.error('usage: node scripts/run-division.mjs <division> <specDir> [outDir]');
  console.error('  PROJECT_NAME must be set; PROJECT_SUB, LEGEND_DRAWING, PREPARER_* optional.');
  process.exit(1);
}

if (!process.env.PROJECT_NAME) {
  console.error('PROJECT_NAME is not set — refusing to run rather than banner the wrong job.');
  process.exit(1);
}

try {
  await fetch(BASE, { signal: AbortSignal.timeout(3000) });
} catch {
  console.error(`No dev server at ${BASE}. Start one with:  npm run dev`);
  process.exit(1);
}

// ---- 1. extract
const pdfs = fs.readdirSync(specDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort();
if (pdfs.length === 0) {
  console.error(`No PDFs in ${specDir}`);
  process.exit(1);
}

const form = new FormData();
form.set('division', divisionId);
for (const name of pdfs) {
  const buf = fs.readFileSync(path.join(specDir, name));
  form.append('files', new Blob([buf], { type: 'application/pdf' }), name);
}

console.log(`Extracting ${pdfs.length} PDFs...\n`);
const extractRes = await fetch(`${BASE}/api/extract`, { method: 'POST', body: form });
const extracted = await extractRes.json();
if (!extractRes.ok) {
  console.error(`extract failed: ${extracted.error}`);
  process.exit(1);
}

// A section that is not on the division's list is still part of the division and
// can govern this trade's work — shared hangers, division-wide test pressures. It
// goes in as supporting context rather than being dropped, unless --primary-only.
const primaryOnly = process.argv.includes('--primary-only');

let totalChars = 0;
let totalPages = 0;
for (const f of extracted.files) {
  const role = f.error ? 'ERR    ' : f.matchedSection ? 'primary' : primaryOnly ? 'skipped' : 'support';
  console.log(
    `  ${role} ${(f.sectionNumber ?? '??????').padEnd(9)}` +
      `${String(f.pageCount).padStart(3)}p ${f.charCount.toLocaleString().padStart(8)} chars  ${f.fileName}`,
  );
  if (f.error) continue;
  if (f.matchedSection || !primaryOnly) {
    totalChars += f.charCount;
    totalPages += f.pageCount;
  }
}

const primary = extracted.files.filter((f) => f.matchedSection);
const supporting = extracted.files.filter((f) => !f.error && !f.matchedSection && f.text?.trim());

if (primary.length === 0) {
  console.error('\nNo uploaded section is on this division\'s list — nothing to build from.');
  process.exit(1);
}

console.log(
  `\n${primary.length} primary` +
    (primaryOnly ? '' : ` + ${supporting.length} supporting`) +
    ` · ${totalPages} pages · ${totalChars.toLocaleString()} chars`,
);
if (process.argv.includes('--extract-only')) {
  console.log('\n--extract-only: stopping before the model call. Nothing was spent.');
  process.exit(0);
}

console.log('Generating — this takes several minutes.\n');

// ---- 2. generate
const startedAt = Date.now();
const genRes = await fetch(`${BASE}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    division: divisionId,
    files: extracted.files,
    // Never hardcode a project here. These were fixed to a Tampa job for months
    // and every Carrollwood sheet came out carrying the wrong name in the banner.
    project: {
      projectName: process.env.PROJECT_NAME ?? '',
      projectSub: process.env.PROJECT_SUB ?? '',
      preparerName: process.env.PREPARER_NAME ?? 'Joshua Ahwai',
      preparerTitle: process.env.PREPARER_TITLE ?? 'Assistant Project Manager Intern',
      preparerEmail: process.env.PREPARER_EMAIL ?? 'joshua.ahwai@bchmechanical.com',
      legendDrawing: process.env.LEGEND_DRAWING ?? '',
    },
  }),
});

const reader = genRes.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let result = null;
let failure = null;

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);

    if (event.type === 'step') console.log(`  [${elapsed(startedAt)}] ${event.step}`);
    else if (event.type === 'warning') console.log(`  [${elapsed(startedAt)}] WARNING: ${event.message}`);
    else if (event.type === 'error') failure = event.message;
    else if (event.type === 'done') result = event.result;
  }
}

if (failure || !result) {
  console.error(`\nFAILED: ${failure ?? 'stream closed with no result'}`);
  process.exit(1);
}

// ---- 3. report
fs.mkdirSync(outDir, { recursive: true });
const sheetPath = path.join(outDir, `${divisionId}-cheat-sheet.pdf`);
const listPath = path.join(outDir, `${divisionId}-checklist.pdf`);
fs.writeFileSync(sheetPath, Buffer.from(result.cheatsheetPdf, 'base64'));
fs.writeFileSync(listPath, Buffer.from(result.checklistPdf, 'base64'));

const bySeverity = {};
for (const d of result.discrepancies) {
  const key = (d.severity ?? 'unknown').toLowerCase();
  bySeverity[key] = (bySeverity[key] ?? 0) + 1;
}

console.log('\n─────────────────────────────────────────');
console.log(`  sections read    ${result.sectionCount}`);
console.log(`  sheet pages      ${result.pageCount}`);
console.log(`  discrepancies    ${result.discrepancies.length}`);
for (const [sev, n] of Object.entries(bySeverity).sort()) {
  console.log(`      ${sev.padEnd(12)} ${n}`);
}
console.log(`  wall clock       ${elapsed(startedAt)}`);
console.log('─────────────────────────────────────────');
console.log(`\n  ${sheetPath}\n  ${listPath}`);

function elapsed(from) {
  const s = (Date.now() - from) / 1000;
  return `${s.toFixed(0)}s`.padStart(4);
}
