# Measured design spec — repair reference only

Every value here was measured off the approved Division 22 sheet (page geometry
via pdfplumber rects, font sizes via embedded char metrics, colors sampled from a
300 dpi raster). `assets/template.html` already implements all of it.

**Read this only if the template is damaged or a value genuinely needs
re-deriving.** Normal builds should copy the template and never touch the CSS.

---

## Page

- Letter, `@page margin: 28.5pt` — content width exactly 555pt
- Sheet background `#fafaf8` on the `.sheet` wrapper (not on `body`)

## Fonts

Set in **pt**, not px — that's what makes output byte-comparable across renders.

| Role | Family | Size |
|---|---|---|
| Headings | DejaVu Sans Condensed Bold | see below |
| Values | DejaVu Sans Mono | 6.9 |
| Body | Liberation Sans | 6.9 |

Sizes: body 6.9 · notes/bullets 7.2 · key labels + badges 7.87 · panel caption 7.5
· table `th` 7.04 · sub-heading 8.62 · block heading 9.0 · panel title 9.75 ·
section title 11.25 · section number 8.25 · SPEC label 7.12 · footer 6.75 ·
banner 19.5 / 16.5 / 9.37 / 7.04

The stacks list Barlow Condensed / IBM Plex Mono / IBM Plex Sans first; those
aren't installed in the render environment and fall back to the DejaVu and
Liberation faces above. That fallback *is* the approved look — don't "fix" it by
installing the named fonts, or output will stop matching the approved sheet.

## Colors

| Token | Hex | Use |
|---|---|---|
| ink | `#1a1d1f` | text, table headers, section badges |
| ink2 | `#3a3f42` | `th` column separators, banner divider |
| muted | `#6b7280` | SPEC labels, small notes, neutral callout spine |
| border | `#b7b3a8` | table and panel outer borders |
| border2 | `#d9d6ce` | cell borders |
| cream | `#f6f5f0` | `tbody tr:nth-child(even)` row stripe |
| cream2 | `#f1efe8` | panel header strip, neutral callout background |
| sheet | `#fafaf8` | page background |
| redbg | `#fbeaea` | red callout background |
| red | `#c1272d` | red callout spine, field-critical text |
| green | `#0e7a43` | spine / badge — domestic water |
| blue | `#1d6fb8` | spine / badge — storm, condensate |
| charcoal | `#33383b` | spine / badge — sanitary, vent |
| amber | `#b45309` | spine / badge — grease, oil waste |
| gold | `#d99a00` | spine / badge — gas |

## Metrics

- Banner padding `10px 15px 9px`; divider `0.75pt` `#3a3f42`
- Color strip: 5 equal segments, `5.25pt` tall, green/blue/charcoal/amber/gold
- Section rule `1.5pt` solid ink, `7px` above it, `6px` below
- Section number badge `20.25 × 12.75pt`, radius 2, padding `3px 7px`
- `th` padding `2px 4.5px` · `td` padding `2px 4.5px` · line-height `1.25`
  — a single-line row measures exactly **15.0pt**. If rows come out 15.75pt the
  `td` padding drifted to 2.5px.
- System spines `3pt`
- Badges: `min-width 16px`, padding `2px 5px`, line-height `11px`

## Column widths (Division 22 reference)

- §01 pipe material: 18 / 19.5 / 19.5 / 19.5 / 23.5
- §03 hanger matrix: 13.8 / 8 / 5.4 / 14 / 31.3 / 27.5
- §04 insulation: grid `1.3fr 1fr`, table 45 / 23 / 8.5 / 23.5
- §05-§08: grid `1fr 1fr`, gap `6.75pt`
- §09 testing: 22 / 22 / 28 / 28
- §10: grid `1.3fr 1fr`

## Known traps

**Label cells containing a badge must be `display:block` with the badge inline**
(`margin-left:5px; vertical-align:-2px`) — see `.svc`. Flex clips wide badges at
the column edge when the label wraps.

**Rowspan cells whose sub-values don't line up with the parent rows** get a nested
`table.mini` with `padding:0` on the parent `td`, and the labels go in the parent
`th` row via `colspan`. Never a second dark header bar inside a cell.

**No cross-reference columns.** A column whose cells are all pointers into another
document (`Fig. 2-1`, `per Table 5-2`, `see §3.9`) is not data. Delete the column,
state the pointer once in a callout naming the standard and the parameter that
selects within it, and keep only the thresholds the spec states in its own words.

**Page-break control:** keep `break-inside: avoid` only on `.callout` and on
`table.g tr`, plus `break-after: avoid` on `.sec-head`. Set
`table.g { break-inside: auto }` and `table.g thead { display: table-header-group }`
so a long table splits at a row boundary with its headers repeating on the
continuation page. Do NOT use it on `.sec`, `.g2`, `.g13`, or `.stack > *` —
those all cause sections to jump whole and leave holes. Sections flow across
page breaks; individual tables and callouts stay intact. This works for both
small (Div 22) and large (Div 23) sections.
Don't shrink type or padding to force a fit — those values are shared across all
sheets and drifting them breaks visual consistency between divisions.

## Render engine

Chromium headless (`scripts/render.sh`). The approved sheet was produced by
Chromium/Skia m141. Other engines — wkhtmltopdf in particular — don't support
flexbox, grid, or CSS variables and will not reproduce this layout.
