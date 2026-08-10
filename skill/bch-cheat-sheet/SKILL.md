---
name: bch-cheat-sheet
description: Builds BCH Mechanical field cheat sheets — dense 3-5 page PDF quick-reference sheets generated from CSI construction specification sections, in BCH's approved house format. Use this skill whenever someone pastes or uploads spec sections (Division 22 plumbing, Division 23 HVAC/hydronic/sheet metal, or any CSI division) and wants a cheat sheet, field reference, quick-reference sheet, spec summary, or takeoff reference — and also whenever they mention updating, revising, or adding a section to an existing BCH cheat sheet, or ask to extract requirements from a spec for field or estimating use. Trigger it even if they don't say the words "cheat sheet."
---

# BCH Mechanical Field Cheat Sheet

Turns CSI specification sections into a dense, printable field reference in BCH's
approved house format. Two audiences: **field crews and PMs** (what to install)
and **estimating** (what drives cost).

The format is fixed and was approved on the Division 22 plumbing sheet. Do not
redesign it. `assets/template.html` carries the exact CSS — use it verbatim.

---

## Which sheet am I building?

One sheet per trade, never one sheet per division. Division 23 is split.

| Sheet | Division | Spec sections |
|---|---|---|
| PLUMBING | 22 | see `references/divisions.md` |
| HYDRONIC & MECHANICAL PIPING | 23 (piping) | see `references/divisions.md` |
| SHEET METAL & AIR DISTRIBUTION | 23 (air) | see `references/divisions.md` |

Read `references/divisions.md` before starting. It lists which spec sections feed
which sheet, the standard section order for each, and how shared sections
(hangers, insulation, identification) get split between the two Division 23
sheets.

If the user hasn't said which sheet they want, ask before doing anything else.

---

## The three-phase build

Never try to read a whole division in one pass. Spec books run 100-400+ pages
and quality collapses when boilerplate crowds out the parts that matter.

### Phase 1 — Scope

**Check for a delegated-design clause first.** If Part 1 defers construction to a
referenced standard (SMACNA for duct, MSS for pipe support), the spec will not
contain the tables you expect — duct gauge, seam type, reinforcement, and hanger
sizing may all be absent. In that case the sheet's core table becomes the
project's *schedule* (pressure class, seal class, leakage class, service), and
the sheet says plainly where the missing values come from. Do not reproduce the
referenced standard's tables; BCH holds those.

**Confirm the legend drawing.** System abbreviations must come from the project's
mechanical or plumbing legend drawing, not from spec prose. If no legend has been
provided, label the key panel as unverified and log it.

Confirm with the user:
- Which sheet (from the table above)
- Project name, project sub-line, legend/abbreviation drawing number
- Preparer name, title, email
- Which spec sections they have

Split the spec **by CSI section, never by page count**. Splitting at "page 100"
cuts tables in half. Most spec books are issued as individual section files or
have bookmarks.

**The section order in `references/divisions.md` is binding, not a suggestion.**
Use exactly those sections, with those titles, in that order, numbered 01, 02,
03… Do not add, rename, reorder, merge or split them, and do not invent an
outline that fits the specs you happened to receive.

This matters because two builds from the same specs must produce the same sheet.
When the outline is chosen fresh each time, the same project comes back with
different section counts and content filed in different places, and nobody can
compare two sheets or learn where to look. Exact wording will still vary between
builds — that is unavoidable — but the skeleton must not.

**A section with no supporting content still gets built.** Emit the section head,
put a single line in it reading "Not covered by the sections provided — see
discrepancy log," and log a GAP naming the CSI section that would have supplied
it. Silently dropping a section hides the hole; showing it empty is what tells
the reader to go find the missing spec.

### Phase 2 — Extract (one pass per section group)

For each spec section, output a **data block** — plain markdown tables and notes,
not the styled sheet. Follow the schema in
`references/data-block-schema.md` exactly.

Also output that section's **discrepancy log** entries (see below).

Data blocks are the durable artifact. They're small, a human can check them
against the spec, and when a spec is revised only the affected block is rebuilt.
Tell the user to save them.

### Phase 3 — Assemble and render

In a fresh conversation with all data blocks pasted in:

1. Copy `assets/template.html` to the working directory. **Never retype the CSS.**
2. Fill the placeholders and drop content into the component patterns already in
   the template body.
3. Render with `scripts/render.sh`.
4. Rasterize every page and **look at them** before delivering. Check for split
   tables, orphaned section headings, clipped cells, and text overflowing a
   column.
5. Produce both checklists (`references/checklists.md`).
6. Deliver the PDF plus both checklists.

---

## Content rules

These came out of the Division 22 build and are not negotiable.

**Include** anything that changes what a fitter installs or orders, or what an
estimator prices: materials by system and location, joint methods, hanger sizes
and spacing, insulation thicknesses, slopes, test pressures and durations,
mounting heights, valve construction, labeling, prohibitions.

**Exclude** submittal procedures, warranty language, quality-assurance boilerplate,
delivery/storage clauses, and anything the product simply comes with.

**When two documents conflict, the more stringent requirement wins** — and the
conflict goes in the discrepancy log regardless.

**Consolidate rows that resolve to the same answer.** If three pressure ranges all
require welded black steel, that is one row reading "all pressures," not three.

**Every value stays traceable.** If you can't point to the spec paragraph it came
from, it doesn't go on the sheet.

**Watch for delegated design.** Many Division 23 sections defer construction to an
industry standard instead of stating values — 23 31 13 defers sheet metal
thickness, seam and joint type, reinforcement, and hanger sizing entirely to
SMACNA. When that happens the expected table does not exist in the spec. Say so on
the sheet, name the standard and the parameter that selects from it (pressure
class, pipe size), and do not reproduce the standard's tables as if they were spec
values.

**Never build a table whose data column is cross-references.** This is the trap
that delegated design sets. A seven-row table reading `Fig. 2-1` / `Fig. 2-2` /
`Fig. 3-1` down one column — with a second column repeating "Same basis" — looks
like information and carries none. Nobody can install from a figure number without
that book open.

State the deferral **once, in a callout**: name the standard, name the parameter
that selects within it, and then give the thresholds the spec *does* state in its
own words. Those thresholds are the actionable part:

> **DEFERS TO SMACNA.** Sheet metal thickness, joint/seam type, reinforcement and
> hanger sizing all defer to SMACNA *HVAC Duct Construction Standards – Metal and
> Flexible*, selected by **duct static-pressure class** (see the Duct Schedule).
> Thresholds the spec states directly: round transverse joints >60″ dia = flanged;
> longitudinal seams >90″ dia = butt-welded; flat-oval >72″ major dim = butt-welded.

The same applies to any "see paragraph X" or "per Table Y" column. If a column
would be nothing but pointers, delete the column and write the pointer once.

**Strip restricted markings.** Spec pages often carry security or public-records
notices in every header. None of it belongs on the cheat sheet — check the
rendered output.

**Never invent a value to fill a gap.** A missing requirement is a discrepancy log
entry, not a guess. If industry practice or code fills the gap, say so explicitly
on the sheet and log it.

---

## Formatting rules

Full measured values are in `references/design-spec.md` — read it only if
something needs re-deriving. Day to day, these are the rules that matter:

- **Mono font** for anything a fitter reads as a value: dimensions, pressures,
  standards designations (`ASTM A53`, `10 ft`, `100 psig`, `§3.8`).
- **Bold** the value in a table cell; the label stays regular.
- **Red text** for a rule people get wrong in the field. Use it sparingly — three
  or four per sheet. It stops working when it's everywhere.
- **Red callout** = prohibitions and hard sequencing ("DO NOT", "SEQUENCE").
  **Neutral callout** = reference information. Callout headings go *inside* the box.
- **Spine colors** group systems visually. Same system, same color, every sheet.
- **Spell abbreviations out** where they're ambiguous — "Class 125" not "Cl 125".
- **Never put a revision label** on the sheet — not in the banner, not in the
  footer. The preparer line stays.
- Keep the "verify against full spec & drawings" line in the banner and the
  footer disclaimer. They are not decoration; the sheet is a reference, not a
  contract document.

Target 3-5 pages. If it runs longer, the scope is wrong — consolidate rows or
check whether the sheet should be split.

---

## Page breaks

The template's CSS makes grids, stack children, tables, and callouts atomic, and
keeps section heads with what follows. Chromium does not fragment grid
containers, so **the grid is the atomic unit, not the section**.

**If a block is too tall to fit in the space left on a page, it strands that
space.** The fix is to split the section, not to shrink type or padding. On the
Division 23 sheet metal build, §02 was one grid holding construction thresholds,
elbows, and sealants — too tall to follow §01, leaving a third of page 1 empty.
Splitting sealants into its own section filled the page. Watch for this whenever
a page ends below about 70% and the next section is a large grid.

If a section leaves a large hole, do not fix it by shrinking type or padding —
those values are measured and shared across all sheets. Instead move a
half-width block up into an empty grid cell, or reconsider whether two sections
should share a page. Reading order must stay intact.

An orphaned section heading is a defect. A row split down the middle is a defect.
A table continuing onto the next page under a repeated header is not — and it is
certainly not worth a half-empty page to avoid.

Let sections and long tables flow; keep rows and callouts atomic. Do NOT put
`break-inside: avoid` on `.sec`, `table.g`, `.g2`, `.g13`, or `.stack > *`. Any
block taller than the space left on the page cannot honour it, so the whole
block jumps to the next page and strands a half-empty one behind it. Use instead:
`table.g { break-inside: auto }` so a long table splits at a row boundary,
`table.g tr { break-inside: avoid }` so no row splits mid-content, and
`table.g thead { display: table-header-group }` so the column headers repeat on
the continuation page. Keep `break-inside: avoid` on `.callout` only, plus
`break-after: avoid` on `.sec-head`. A section heading at the bottom of a page
with its table starting at the top of the next is clean and readable; a
half-empty page is not. Long tables are fine — prefer one 30-row table over
three padded 10-row tables.

---

## Required outputs — every single time

1. **The PDF.**
2. **`<sheet-name>-Checklist.md`** — a file, not chat prose, carrying all three
   checklists from `references/checklists.md`:
   - **Coverage** — every spec article mapped to where it landed, or why it didn't
     (on a revision round, the Revision verification checklist replaces this)
   - **Build** — page count, glyph rendering, split tables, orphaned heads, clipped
     cells, restricted markings, page fill
   - **Discrepancy log** — every conflict, gap, overlap and ambiguity in the spec,
     with paragraph references, a recommended resolution, and impact

Deliver the checklist file alongside the PDF so it can be saved with the submittal
record and signed by a reviewer. Summarize the discrepancies in chat; the full
tables live in the file. Produce all three every time, even on a small build, and
state plainly when a log is empty.

The discrepancy log is the highest-value output. It is what turns spec ambiguity
into RFIs before buyout instead of change orders after. For estimating it doubles
as a risk register. Never skip it, even when it's empty — say it's empty.

**Do not claim the sheet has been verified against the spec.** When content was
extracted in separate passes, you cannot reliably re-check the finished sheet
against source text you no longer have. Say what you did check (the build
checklist) and leave the spec verification to a named human reviewer.

---

## Files

- `assets/template.html` — master template. Copy it; never retype the CSS.
- `references/divisions.md` — which spec sections feed which sheet, plus the
  standard section order for each of the three sheets.
- `references/data-block-schema.md` — Phase 2 extraction format.
- `references/checklists.md` — build checklist and discrepancy log formats.
- `references/design-spec.md` — every measured design value, for repair only.
- `scripts/render.sh` — HTML to PDF.

---

*Format and method developed by Joshua Ahwai, Assistant Project Manager Intern,
BCH Mechanical — 2026, from the TPA Airside D / CCBS Division 22 sheet.*
