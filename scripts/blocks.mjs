/**
 * Phase 1: read every section of an upload into its own data block.
 *
 *   npm run dev                                    # in another terminal
 *   node scripts/blocks.mjs "C:\path\to\spec-pdfs" out/blocks-div23
 *
 * Writes one markdown file per section plus a summary, so the blocks can be read
 * against the spec by a person. Costs real API usage — one call per section.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000';
const [target, outDir = 'out/blocks'] = process.argv.slice(2);

if (!target) {
  console.error('usage: node scripts/blocks.mjs <file.pdf | dir> [outDir]');
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
  form.append(
    'files',
    new Blob([fs.readFileSync(path.join(dir, name))], { type: 'application/pdf' }),
    name,
  );
}
if (process.env.ANTHROPIC_MODEL) form.set('model', process.env.ANTHROPIC_MODEL);

const startedAt = Date.now();
const el = () => `${((Date.now() - startedAt) / 1000).toFixed(0)}s`.padStart(5);

console.log(`Reading ${files.length} file(s)...\n`);
const res = await fetch(`${BASE}/api/blocks`, { method: 'POST', body: form });

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let blocks = null;
let failure = null;
let model = 'unknown';

// Published $ per million tokens. Reporting Opus rates for a Sonnet run — which
// this did on its first outing — overstates the cost by two thirds.
const RATES = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
};

for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';

  for (const line of lines) {
    if (!line.trim()) continue;
    const e = JSON.parse(line);
    if (e.type === 'split') console.log(`[${el()}] split: ${e.sections} sections, ${e.pageCount} pages`);
    else if (e.type === 'manifest') {
      for (const t of e.trades) {
        console.log(`[${el()}] ${t.present ? 'BUILD' : 'skip '} ${t.name} — ${t.primaryCount} primary`);
      }
      for (const w of e.warnings) console.log(`[${el()}] ! ${w}`);
    } else if (e.type === 'start') console.log(`[${el()}] extracting ${e.total} blocks...\n`);
    else if (e.type === 'progress') {
      console.log(`[${el()}] ${String(e.done).padStart(2)}/${e.total}  ${e.sectionNumber}`);
    } else if (e.type === 'done') {
      blocks = e.blocks;
      model = e.model;
    }
    else if (e.type === 'error') failure = e.message;
  }
}

if (failure || !blocks) {
  console.error(`\nFAILED: ${failure ?? 'stream closed with no result'}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
let inTok = 0;
let outTok = 0;
let chars = 0;
const failed = [];
const truncated = [];

for (const b of blocks) {
  if (b.error) {
    failed.push(`${b.sectionNumber}: ${b.error}`);
    continue;
  }
  if (b.truncated) truncated.push(b.sectionNumber);
  inTok += b.inputTokens;
  outTok += b.outputTokens;
  chars += b.markdown.length;
  fs.writeFileSync(
    path.join(outDir, `${b.sectionNumber.replace(/[ .]/g, '-')}.md`),
    b.markdown,
  );
}

const combined = blocks.filter((b) => !b.error).map((b) => b.markdown).join('\n\n---\n\n');
fs.writeFileSync(path.join(outDir, '_all-blocks.md'), combined);

console.log('\n─────────────────────────────────────────');
console.log(`  blocks written   ${blocks.length - failed.length} / ${blocks.length}`);
console.log(`  block text       ${chars.toLocaleString()} chars`);
console.log(`  input tokens     ${inTok.toLocaleString()}`);
console.log(`  output tokens    ${outTok.toLocaleString()}`);
const rate = RATES[model];
console.log(`  model            ${model}`);
console.log(
  rate
    ? `  est. cost        $${((inTok * rate.input + outTok * rate.output) / 1e6).toFixed(2)}`
    : '  est. cost        (unknown rates for this model)',
);
console.log(`  wall clock       ${el()}`);
console.log('─────────────────────────────────────────');
if (truncated.length) console.log(`\n! truncated: ${truncated.join(', ')}`);
for (const f of failed) console.log(`! FAILED ${f}`);
console.log(`\n  ${path.join(outDir, '_all-blocks.md')}`);
