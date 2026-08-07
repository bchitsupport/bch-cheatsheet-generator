# Paste-ready message for updating the `bch-cheat-sheet` skill

Open a **new Claude conversation** that has the `bch-cheat-sheet` skill installed,
and paste everything below the line. It tells Claude exactly what to change and why.

If Claude says it can't edit the skill files directly, ask it to output the three
corrected files in full and replace them in your skill folder by hand, then reinstall.

---

Update the `bch-cheat-sheet` skill. It has a page-break bug that leaves large blank
areas at the bottom of generated pages. Make these three edits and nothing else.

**Background — why this is wrong, so you don't "fix" it back:**

The skill currently puts `break-inside: avoid` on tables. That looks safe but is
not: when a table is taller than the space left on the page, CSS cannot honour
"don't split me", so Chromium moves the **entire table** to the next page and
leaves the rest of the current page blank.

This was measured on real output. A Division 23 sheet had page 1 only 72% full
(209pt wasted) and its checklist page 1 only 39% full (452pt wasted). After the
change below, the same documents run 98-99% full.

The original reasoning was "a split table is a defect, whitespace is not." That
was correct only because a split table used to lose its column headers, making the
continuation unreadable. `display: table-header-group` repeats the header on the
continuation page, which removes that cost entirely. With the downside gone, the
whitespace buys nothing. Division 22 rarely showed it because its tables are
short; Division 23 is built from long matrices, which is why it surfaced there.

---

## Edit 1 — `assets/template.html`

Find this line:

```css
table.g{ width:100%; border-collapse:collapse; background:#fff; border:0.75pt solid var(--bd); table-layout:fixed; break-inside:avoid; }
```

Replace it with these three lines:

```css
table.g{ width:100%; border-collapse:collapse; background:#fff; border:0.75pt solid var(--bd); table-layout:fixed; break-inside:auto; }
table.g thead{ display:table-header-group; }
table.g tr{ break-inside:avoid; }
```

Then **delete** these two lines entirely:

```css
.g2,.g13{ break-inside:avoid; }
.stack>*{ break-inside:avoid; }
```

(These two make the side-by-side blocks atomic as well, so a two-column block of
tall tables jumps a whole page. They also contradict `references/design-spec.md`,
which already says not to use `break-inside: avoid` on `.g2`, `.g13`, or
`.stack > *` — the template never matched its own spec.)

Leave `.callout{ ... break-inside:avoid; }` and `.avoid{ break-inside:avoid; }`
exactly as they are. Callouts are short DO-NOT lists and must never split.

## Edit 2 — `SKILL.md`

Find this passage:

> A split table is a defect. An orphaned section heading is a defect. Whitespace is
> not.
>
> **Let sections flow; keep tables and callouts atomic.** Do NOT put
> `break-inside: avoid` on `.sec` — that makes whole sections jump to the next page
> and leaves large holes. Instead keep `break-inside: avoid` only on `table.g` and
> `.callout`. A section heading at the bottom of a page with its table starting at
> the top of the next is clean and readable. A half-empty page is not. This rule
> works for both small sections (they stay on one page naturally) and large ones
> (they break cleanly between their sub-blocks).

Replace it with:

> An orphaned section heading is a defect. A row split down the middle is a defect.
> A table continuing onto the next page under a repeated header is not — and it is
> certainly not worth a half-empty page to avoid.
>
> **Let sections and long tables flow; keep rows and callouts atomic.** Do NOT put
> `break-inside: avoid` on `.sec`, `table.g`, `.g2`, `.g13`, or `.stack > *`. Any
> block taller than the space left on the page cannot honour it, so the whole block
> jumps to the next page and strands a half-empty one behind it. Use instead:
> `table.g { break-inside: auto }` so a long table splits at a row boundary,
> `table.g tr { break-inside: avoid }` so no row splits mid-content, and
> `table.g thead { display: table-header-group }` so the column headers repeat on
> the continuation page. Keep `break-inside: avoid` on `.callout` only, plus
> `break-after: avoid` on `.sec-head`. A section heading at the bottom of a page
> with its table starting at the top of the next is clean and readable; a
> half-empty page is not. Long tables are fine — prefer one 30-row table over
> three padded 10-row tables.

## Edit 3 — `references/design-spec.md`

Find this sentence:

> **Page-break control:** keep `break-inside: avoid` only on `table.g` and
> `.callout`, and `break-after: avoid` on `.sec-head`.

Replace it with:

> **Page-break control:** keep `break-inside: avoid` only on `.callout` and on
> `table.g tr`, plus `break-after: avoid` on `.sec-head`. Set
> `table.g { break-inside: auto }` and
> `table.g thead { display: table-header-group }` so a long table splits at a row
> boundary with its headers repeating on the continuation page.

Leave the sentence that follows it ("Do NOT use it on `.sec`, `.g2`, `.g13`, or
`.stack > *`…") unchanged — it was always correct.

---

## How to verify the fix

Generate a Division 23 sheet with the updated skill and check the page fill. Every
page except the last should be above about 90%. A page in the 30-70% range means
something still refuses to split.

If you have the cheat-sheet app checked out, it ships a measuring tool:

```bash
npm run measure -- "path/to/generated-sheet.pdf"
```
