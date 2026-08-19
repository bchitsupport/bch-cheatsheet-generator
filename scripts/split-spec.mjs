/**
 * Split a combined specification book into sections and report what was found.
 *
 *   npm run dev                                          # in another terminal
 *   node scripts/split-spec.mjs "C:\path\to\Division 22.pdf"
 *   node scripts/split-spec.mjs --verify "C:\path\to\section-pdfs"
 *
 * --verify concatenates a folder of single-section PDFs into one book, splits
 * it, and checks the result against the folder itself: the file names carry the
 * true section numbers and page counts, so the split has a known right answer.
 * That is the only way to test this without a real combined book to hand.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const args = process.argv.slice(2);
const verify = args.includes('--verify');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('usage: node scripts/split-spec.mjs [--verify] <file.pdf | dir>');
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

const form = new FormData();
for (const name of files) {
  const buf = fs.readFileSync(path.join(dir, name));
  form.append('files', new Blob([buf], { type: 'application/pdf' }), name);
}

console.log(`Splitting ${files.length} file(s)...\n`);
const res = await fetch(`${BASE}/api/split`, { method: 'POST', body: form });
const result = await res.json();

if (!res.ok) {
  console.error(`FAILED: ${result.error}`);
  process.exit(1);
}

console.log(`method: ${result.method}   pages: ${result.pageCount}   sections: ${result.sections.length}`);
if (result.furnitureRemoved) {
  const pct = ((result.furnitureRemoved / (result.furnitureRemoved + totalChars(result))) * 100).toFixed(1);
  console.log(`page furniture stripped: ${result.furnitureRemoved.toLocaleString()} chars (${pct}% of raw)`);
}
console.log();

for (const s of result.sections) {
  console.log(
    `  ${s.sectionNumber.padEnd(12)} p${String(s.startPage).padStart(3)}-${String(s.endPage).padEnd(3)} ` +
      `${String(s.pageCount).padStart(3)}p ${s.charCount.toLocaleString().padStart(8)} ch  ` +
      `${(s.title ?? '(no title line)').slice(0, 46)}`,
  );
  for (const w of s.warnings) console.log(`               ! ${w}`);
}

for (const w of result.warnings) console.log(`\n! ${w}`);

if (!verify) process.exit(0);

// ---- ground truth from the folder itself
console.log(`\n${'─'.repeat(70)}\nVERIFY against the source files\n${'─'.repeat(70)}`);

const truth = result.sources.map((src) => {
  const m = src.fileName.match(/(\d{2} \d{2} \d{2}(?:\.\d{2})?)/);
  return { number: m?.[1] ?? null, pageCount: src.pageCount, fileName: src.fileName };
});

let wrong = 0;
for (const t of truth) {
  const found = result.sections.filter((s) => s.sectionNumber === t.number);
  if (t.number === null) {
    console.log(`  ?      ${t.fileName} — no CSI number in the file name, skipped`);
    continue;
  }
  if (found.length === 0) {
    console.log(`  MISS   ${t.number} — not detected at all`);
    wrong++;
  } else if (found.length > 1) {
    console.log(`  SPLIT  ${t.number} — detected as ${found.length} separate runs`);
    wrong++;
  } else if (found[0].pageCount !== t.pageCount) {
    console.log(
      `  PAGES  ${t.number} — detected ${found[0].pageCount}p, file has ${t.pageCount}p`,
    );
    wrong++;
  }
}

const extra = result.sections.filter((s) => !truth.some((t) => t.number === s.sectionNumber));
for (const s of extra) {
  console.log(`  EXTRA  ${s.sectionNumber} — detected but no source file has that number`);
  wrong++;
}

console.log(
  wrong === 0
    ? `\nPASS — ${result.sections.length}/${truth.length} sections recovered with exact page ranges.`
    : `\nFAIL — ${wrong} discrepancies against the source files.`,
);
process.exit(wrong === 0 ? 0 : 1);

function totalChars(r) {
  return r.sections.reduce((n, s) => n + s.charCount, 0);
}
