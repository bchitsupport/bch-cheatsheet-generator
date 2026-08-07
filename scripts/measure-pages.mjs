#!/usr/bin/env node
/**
 * How full is each page of a generated PDF?
 *
 * The app's page-break rules are enforced by scripts/check-page-breaks.mjs, but
 * that only guards this repo. Use this on any BCH sheet — including one produced
 * by the `bch-cheat-sheet` skill — to check the output is actually filling pages.
 *
 *   npm run measure -- "C:\path\to\TPA-DIV-23-Cheat-Sheet.pdf"
 *
 * Healthy: every page except the last is above ~90%. A page in the 30-70% range
 * means something below it refused to split and jumped whole to the next page —
 * almost always `break-inside: avoid` on a tall table.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: npm run measure -- <file.pdf> [more.pdf ...]');
  process.exit(2);
}

// pdf-parse ships pdf.js 1.10, which rejects some valid Chromium output. It is
// good enough for page geometry, which is all we need here.
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const MARGIN = 28.5; // matches @page margin in lib/template.ts
const PAGE_H = 792; // US Letter, points
const BAND = PAGE_H - MARGIN * 2;

for (const file of files) {
  const pageLows = [];

  const collect = async (pageData) => {
    const tc = await pageData.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    });
    const ys = tc.items.filter((i) => i.str && i.str.trim()).map((i) => i.transform[5]);
    pageLows.push(ys.length ? Math.min(...ys) : PAGE_H);
    return '';
  };

  let total = 0;
  try {
    const r = await pdfParse(readFileSync(file), { pagerender: collect });
    total = r.numpages;
  } catch (e) {
    console.error(`\n${file}\n  could not read: ${e.message ?? e}`);
    continue;
  }

  console.log(`\n${file.split(/[\\/]/).pop()}  —  ${total} pages`);
  console.log('  page   used   ');
  console.log('  ' + '-'.repeat(40));

  let wasted = 0;
  let worst = 100;
  pageLows.forEach((low, i) => {
    const unused = Math.max(0, low - MARGIN);
    const used = ((BAND - unused) / BAND) * 100;
    const isLast = i === pageLows.length - 1;
    if (!isLast) {
      wasted += unused;
      worst = Math.min(worst, used);
    }
    const bar = '#'.repeat(Math.round(used / 5)).padEnd(20, '.');
    console.log(
      `  ${String(i + 1).padEnd(6)} ${used.toFixed(0).padStart(3)}%  ${bar}${isLast ? '  (last)' : ''}`,
    );
  });

  console.log('  ' + '-'.repeat(40));
  if (pageLows.length < 2) {
    console.log('  single page — nothing to judge');
  } else if (worst >= 85) {
    console.log(`  GOOD — worst non-final page ${worst.toFixed(0)}% full, ${wasted.toFixed(0)}pt wasted`);
  } else {
    console.log(
      `  PROBLEM — a page is only ${worst.toFixed(0)}% full (${wasted.toFixed(0)}pt wasted).\n` +
        '  Something taller than the remaining space refused to split. Check for\n' +
        '  `break-inside: avoid` on tables or grid containers.',
    );
  }
}
