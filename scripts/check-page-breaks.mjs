#!/usr/bin/env node
/**
 * Regression guard for the page-break rules in lib/template.ts.
 *
 * Why this exists: `break-inside: avoid` on a table reads like the safe choice,
 * and the original build spec asked for it explicitly. It is not safe. A table
 * taller than the space left on the page cannot honour it, so Chromium moves the
 * whole table to the next page and leaves the remainder blank. Measured on a real
 * Division 23 sheet: page 1 ran 72% full, and the checklist's page 1 ran 39% full.
 *
 * The correct rules let a long table split at a row boundary with its header
 * repeating. This script fails the build if anyone reinstates the old rule —
 * including a future model that "helpfully" adds it back to the template.
 *
 * Run: npm run check:layout   (also runs automatically before `npm run build`)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'lib/template.ts'), 'utf8');

function cssBlock(name) {
  const m = src.match(new RegExp(`export const ${name} = String\\.raw\`([\\s\\S]*?)\`\\.trim\\(\\);`));
  if (!m) throw new Error(`Could not find ${name} in lib/template.ts`);
  return m[1];
}

/** Collapse whitespace so declarations match regardless of formatting. */
const norm = (s) => s.replace(/\s+/g, ' ');

const failures = [];
const check = (cond, message) => { if (!cond) failures.push(message); };

// ---------------------------------------------------------------- sheet CSS
{
  const css = norm(cssBlock('TEMPLATE_CSS'));

  check(
    /table\.g\{[^}]*break-inside: ?auto/.test(css),
    'TEMPLATE_CSS: `table.g` must set `break-inside:auto`. With `avoid`, a table ' +
      'taller than the remaining page jumps whole to the next page and strands a ' +
      'half-empty one behind it.',
  );
  check(
    !/table\.g\{[^}]*break-inside: ?avoid/.test(css),
    'TEMPLATE_CSS: `table.g` must NOT set `break-inside:avoid` (this is the bug ' +
      'that caused 209pt of blank space on page 1 of a real sheet).',
  );
  check(
    /table\.g thead\{[^}]*display: ?table-header-group/.test(css),
    'TEMPLATE_CSS: `table.g thead` must set `display:table-header-group`, or a ' +
      'split table continues onto the next page with no column headers.',
  );
  check(
    /table\.g tr\{[^}]*break-inside: ?avoid/.test(css),
    'TEMPLATE_CSS: `table.g tr` must set `break-inside:avoid` so a row never ' +
      'splits across a page.',
  );
  check(
    !/(^|[^-\w])\.sec\{[^}]*break-inside: ?avoid/.test(css),
    'TEMPLATE_CSS: `.sec` must NOT set `break-inside:avoid` — it forces every ' +
      'section onto its own page.',
  );
  check(
    !/\.g2[^{]*\{[^}]*break-inside: ?avoid/.test(css) &&
      !/\.g13[^{]*\{[^}]*break-inside: ?avoid/.test(css),
    'TEMPLATE_CSS: the `.g2` / `.g13` grids must NOT set `break-inside:avoid` — ' +
      'a two-column block of tall tables then jumps a full page.',
  );
  check(
    /\.callout\{[^}]*break-inside: ?avoid/.test(css),
    'TEMPLATE_CSS: `.callout` SHOULD keep `break-inside:avoid` — callouts are ' +
      'short DO-NOT lists that must not split.',
  );
}

// ------------------------------------------------------------ checklist CSS
{
  const css = norm(cssBlock('CHECKLIST_CSS'));

  check(
    /(^|[^.\w])table\{[^}]*break-inside: ?auto/.test(css),
    'CHECKLIST_CSS: `table` must set `break-inside:auto`. The discrepancy log is ' +
      'the tallest table in the document; with `avoid` it pushed checklist page 1 ' +
      'down to 39% full.',
  );
  check(
    /(^|[^.\w])thead\{[^}]*display: ?table-header-group/.test(css),
    'CHECKLIST_CSS: `thead` must set `display:table-header-group`.',
  );
  check(
    /(^|[^.\w])tr\{[^}]*break-inside: ?avoid/.test(css),
    'CHECKLIST_CSS: `tr` must set `break-inside:avoid`.',
  );
}

// ------------------------------------------------- prompt must not re-add it
{
  const prompt = readFileSync(join(root, 'lib/anthropic.ts'), 'utf8');
  const rules = prompt.slice(prompt.indexOf('PAGE BREAKS:'), prompt.indexOf('- Long tables are fine'));
  check(
    /Do NOT add break-inside/.test(rules),
    'lib/anthropic.ts: the PAGE BREAKS section must tell the model not to add its ' +
      'own break-inside declarations, or it will reintroduce the rule inline.',
  );
}

if (failures.length) {
  console.error('\n  Page-break regression check FAILED\n');
  for (const f of failures) console.error(`  • ${f}\n`);
  console.error('  See the header comment in lib/template.ts for the measurements.\n');
  process.exit(1);
}

console.log('Page-break rules OK — long tables split at rows, headers repeat, callouts stay whole.');
