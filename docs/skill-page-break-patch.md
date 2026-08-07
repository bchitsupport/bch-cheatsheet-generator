# Patch: page-break rules in the `bch-cheat-sheet` skill

The skill and this app were built from the same house template, so they carry the
same page-break bug. **This app is fixed** (`lib/template.ts`, guarded by
`npm run check:layout`). The skill is separate software and still has it — in a
stronger form.

Anyone generating a sheet **through the skill** rather than through this app will
still get half-empty pages until these three files change.

---

## The measurement

`break-inside: avoid` on a table cannot be honoured when the table is taller than
the space left on the page. Chromium's only option is to move the **whole table**
to the next page, leaving the remainder of the current one blank.

| Document | Page 1 fill | Wasted |
|---|---|---|
| Real Division 23 sheet (via this app, before fix) | 72% | 209pt |
| Its checklist | 39% | 452pt |
| Isolated repro, tall table | — | 352pt per occurrence |
| **After the fix** | **98–99%** | **13pt** |

The skill's `template.html` is worse than this app's was, because it *also* sets
`break-inside: avoid` on `.g2, .g13` and `.stack > *`, which makes the
two-column blocks atomic as well.

Note this contradicts the skill's own `references/design-spec.md`, which says not
to use it on `.g2`, `.g13`, or `.stack > *`. The template and the design spec
already disagree with each other.

---

## 1. `assets/template.html`

**Line 95 — replace:**

```css
table.g{ width:100%; border-collapse:collapse; background:#fff; border:0.75pt solid var(--bd); table-layout:fixed; break-inside:avoid; }
```

**with:**

```css
table.g{ width:100%; border-collapse:collapse; background:#fff; border:0.75pt solid var(--bd); table-layout:fixed; break-inside:auto; }
table.g thead{ display:table-header-group; }
table.g tr{ break-inside:avoid; }
```

**Lines 163–164 — delete both:**

```css
.g2,.g13{ break-inside:avoid; }
.stack>*{ break-inside:avoid; }
```

**Leave unchanged:** `.callout` (line 132) and `.avoid` (line 162). Callouts are
short DO-NOT lists and should never split.

---

## 2. `SKILL.md` (around lines 175–184)

**Replace:**

> A split table is a defect. An orphaned section heading is a defect. Whitespace is
> not.
>
> **Let sections flow; keep tables and callouts atomic.** Do NOT put
> `break-inside: avoid` on `.sec` — that makes whole sections jump to the next page
> and leaves large holes. Instead keep `break-inside: avoid` only on `table.g` and
> `.callout`.

**with:**

> An orphaned section heading is a defect. A row split down the middle is a defect.
> A table continuing onto the next page under a repeated header is not — and
> neither is it worth a half-empty page to avoid.
>
> **Let sections and long tables flow; keep rows and callouts atomic.** Do NOT put
> `break-inside: avoid` on `.sec`, `table.g`, `.g2`, `.g13`, or `.stack > *`. Any
> block taller than the space left on the page cannot honour it, so the whole
> block jumps and strands a half-empty page behind it. Instead:
> `table.g { break-inside: auto }` so a long table splits at a row boundary,
> `table.g tr { break-inside: avoid }` so no row splits mid-content, and
> `table.g thead { display: table-header-group }` so the column headers repeat on
> the continuation page. Keep `break-inside: avoid` on `.callout` only, and
> `break-after: avoid` on `.sec-head`.

---

## 3. `references/design-spec.md` (around line 88)

**Replace:**

> **Page-break control:** keep `break-inside: avoid` only on `table.g` and
> `.callout`, and `break-after: avoid` on `.sec-head`.

**with:**

> **Page-break control:** keep `break-inside: avoid` only on `.callout` and on
> `table.g tr`, plus `break-after: avoid` on `.sec-head`. Set
> `table.g { break-inside: auto }` and `table.g thead { display: table-header-group }`
> so long tables split at a row boundary with their headers repeating.

The existing sentence after it — "Do NOT use it on `.sec`, `.g2`, `.g13`, or
`.stack > *`" — is already correct and should stay. The template just never
matched it.

---

## Why the tradeoff flipped

The skill's original rule was a deliberate choice: never split a table, accept the
whitespace. That is defensible when a split table loses its header, because the
continuation becomes unreadable.

`display: table-header-group` removes that cost — the header repeats, so a
continued table reads correctly. With the downside gone, the whitespace is no
longer buying anything.

Division 22 sheets rarely showed the problem because their tables are short.
Division 23 sheets are built from long matrices, which is why it surfaced there
first.

---

## Where this needs to be applied

The copy on this machine lives under a per-session path:

```
%APPDATA%\Claude\local-agent-mode-sessions\skills-plugin\<uuid>\<uuid>\skills\bch-cheat-sheet\
```

Editing that copy fixes the current session only. For the fix to survive, apply
these changes wherever the skill is authored and published, then reinstall.

## Verifying a fix

Generate a Division 23 sheet and measure page fill — every page except the last
should be above ~90%. This repo's `npm run check:layout` asserts the equivalent
rules for the app and runs automatically before `npm run build`.
