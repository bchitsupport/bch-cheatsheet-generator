/**
 * Report the real platform font Chromium uses for each character of the sheet.
 *
 * The generated PDFs contain both the intended webfaces and their fallbacks —
 * Arimo *and* Arial, Roboto Mono *and* Consolas — in one document. Mixed faces
 * at small sizes make stems land on different pixel boundaries word to word,
 * which reads as uneven lettering, and the fallback differs by host so output is
 * not reproducible.
 *
 * Indirect checks all lie here: `document.fonts.check()` returns true for a
 * character that matches no declared face (nothing needs loading, so it trivially
 * passes), and pdf.js reports generic classes rather than the embedded face. CDP's
 * CSS.getPlatformFontsForNode reports what actually drew the glyphs.
 *
 *   node scripts/check-fonts.mjs [extra characters to probe]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const src = fs.readFileSync(path.join(root, 'lib', 'template.ts'), 'utf8');
const marker = 'export const FONT_PATCH = `';
const open = src.indexOf(marker);
const end = src.indexOf('`.trim();', open + marker.length);
if (open < 0 || end < 0) {
  console.error('Could not find FONT_PATCH in lib/template.ts');
  process.exit(1);
}
const FONT_PATCH = src.slice(open + marker.length, end).trim();

/**
 * Characters the sheets and checklists actually use: ASCII, the punctuation and
 * symbols that appear in spec text and dimensions, and the comparison operators
 * that are everywhere in specs (measured: 21 `<=` in one Division 23 sheet).
 *
 * Deliberately excludes the single-glyph forms U+2103 and U+2109. No served
 * subset covers them, they never appeared in any measured output, and specs
 * write degrees as `\u00b0C` / `\u00b0F` \u2014 two characters that are both covered.
 */
const PROBE =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' +
  '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' +
  '\u00a7\u00b0\u00b1\u00bd\u00bc\u00be\u00d7\u00f7\u00b7\u2018\u2019\u201c\u201d' +
  '\u2013\u2014\u2026\u2032\u2033\u2192\u2190\u2265\u2264\u2260\u2248\u2205\u2300' +
  '\u2713\u2717\u2610\u2611\u25cf\u25a0\u2022\u03a9\u00b5' +
  (process.argv[2] ?? '');

/**
 * Every family the template loads over the network. A character landing on one
 * of these is fine: the glyph is identical on a laptop and on Vercel. A character
 * landing anywhere else is a system font, which differs by host \u2014 that is the
 * failure this script exists to catch.
 */
const WEBFONTS = [/^Arimo/i, /^Archivo/i, /^Roboto Mono/i, /^Noto Sans Math/i, /^Noto Sans Symbols/i];

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const executablePath = process.env.LOCAL_CHROME_PATH ?? CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome or Edge found. Set LOCAL_CHROME_PATH.');
  process.exit(1);
}

const ROLES = [
  ['--sans', 'Arimo', /^Arimo/i],
  ['--cond', 'Archivo Narrow', /^Archivo/i],
  ['--mono', 'Roboto Mono', /^Roboto Mono/i],
];

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
const netProblems = [];
page.on('requestfailed', (r) => netProblems.push(`${r.failure()?.errorText}  ${r.url()}`));
page.on('response', (r) => {
  if (!r.ok() && /fonts\.(googleapis|gstatic)/.test(r.url())) {
    netProblems.push(`HTTP ${r.status()}  ${r.url()}`);
  }
});

const chars = [...new Set([...PROBE])];
const esc = (c) =>
  c.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const body = ROLES.map(([varName], ri) =>
  chars
    .map((c, ci) => `<span id="p${ri}_${ci}" style="font-family:var(${varName});font-size:40px">${esc(c)}</span>`)
    .join(''),
).join('<hr>');

await page.setContent(
  `<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`.replace(
    '</head>',
    `${FONT_PATCH}\n</head>`,
  ),
  { waitUntil: 'load', timeout: 30_000 },
);
await page.evaluateHandle('document.fonts.ready');

const cdp = await page.createCDPSession();
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');
const { root: domRoot } = await cdp.send('DOM.getDocument', { depth: -1 });

const results = [];
for (let ri = 0; ri < ROLES.length; ri++) {
  const [, label, expected] = ROLES[ri];
  const wrong = [];
  for (let ci = 0; ci < chars.length; ci++) {
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: domRoot.nodeId,
      selector: `#p${ri}_${ci}`,
    });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const used = fonts.filter((f) => f.glyphCount > 0);
    if (used.length === 0) continue;
    const family = used[0].familyName;
    if (expected.test(family)) continue;
    wrong.push({
      ch: chars[ci],
      code: chars[ci].codePointAt(0),
      family,
      system: !WEBFONTS.some((re) => re.test(family)),
    });
  }
  results.push({ label, wrong });
}

await browser.close();

let systemFallbacks = 0;
for (const { label, wrong } of results) {
  console.log(`\n--- ${label} ---`);
  if (wrong.length === 0) {
    console.log('  every probe character drawn in the intended face');
    continue;
  }
  const byFamily = new Map();
  for (const w of wrong) {
    if (!byFamily.has(w.family)) byFamily.set(w.family, []);
    byFamily.get(w.family).push(w);
  }
  for (const [family, items] of byFamily) {
    const isSystem = items[0].system;
    if (isSystem) systemFallbacks += items.length;
    console.log(
      `  ${isSystem ? 'SYSTEM FONT' : 'webfont    '} ${family} — ${items.length} chars:`,
    );
    console.log(
      `    ${items
        .map((i) => `${i.ch} (U+${i.code.toString(16).toUpperCase().padStart(4, '0')})`)
        .join('  ')}`,
    );
  }
}

console.log('\n--- network ---');
console.log(netProblems.length ? netProblems.map((p) => `  ${p}`).join('\n') : '  all font requests succeeded');

if (netProblems.length) {
  console.log('\nFAIL — a font request failed, so the render fell back to system faces.');
  process.exit(1);
}
if (systemFallbacks) {
  console.log(
    `\nFAIL — ${systemFallbacks} character/role combinations land on a system font.\n` +
      'Those glyphs differ between a laptop and the serverless build, where the\n' +
      'font is usually absent entirely and the character renders as tofu.',
  );
  process.exit(1);
}
console.log(
  '\nOK — every character resolves to a webfont, so the two hosts render identically.',
);
