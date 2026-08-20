/**
 * The BCH house cheat-sheet format.
 *
 * TEMPLATE_CSS is copied from BCH-Cheat-Sheet-TEMPLATE.html's <style> block with
 * two deliberate deviations, both about page breaks:
 *
 *   1. `.sec { break-inside:avoid }`  — REMOVED (the template's last rule)
 *   2. `table.g { break-inside:avoid }` → `auto`, plus row-level protection:
 *        table.g thead { display:table-header-group }
 *        table.g tr    { break-inside:avoid }
 *
 * Deviation 2 replaces the build spec's "break-inside:avoid on table.g" rule,
 * because that rule was measurably producing half-empty pages. A table taller
 * than the space left on the page cannot honour `avoid`, so Chromium moves the
 * *entire* table to the next page. Measured on a real 6-page Division 23 sheet:
 * page 1 ran 72% full, losing 209pt. In an isolated repro a tall table wasted
 * 352pt; with the rules above, 13pt.
 *
 * The intent behind the original rule — never split content mid-row, never
 * strand rows under a missing header — is preserved and arguably better served:
 * `tr { break-inside:avoid }` keeps rows atomic, and `table-header-group` repeats
 * the column headers on the continuation page. `.callout` deliberately KEEPS
 * `break-inside:avoid`; callouts are short "DO NOT" lists that should never split.
 *
 * The template file ends with `.avoid{break-inside:avoid} .sec{break-inside:avoid}`.
 * The build spec's PAGE BREAKS rules say explicitly not to break-protect `.sec`,
 * so that rule is dropped; `.avoid` is kept as an opt-in class.
 *
 * On the reference template this changes nothing — it renders to 4 pages either
 * way. It matters on longer sheets, where a break-protected section that doesn't
 * fit in the remaining space gets pushed whole onto a fresh page and leaves the
 * previous one half empty. Protecting tables and callouts individually keeps the
 * things that must not split intact without that cost.
 *
 * Everything else — every value, every color, every point size — is unchanged.
 */
export const TEMPLATE_CSS = String.raw`
@page { size: letter; margin: 28.5pt; }

* { box-sizing: border-box; margin: 0; padding: 0; }

:root{
  --ink:#1a1d1f;
  --ink2:#3a3f42;
  --muted:#6b7280;
  --bd:#b7b3a8;
  --bd2:#d9d6ce;
  --cream:#f6f5f0;
  --cream2:#f1efe8;
  --sheet:#fafaf8;
  --green:#0e7a43;
  --blue:#1d6fb8;
  --char:#33383b;
  --amber:#b45309;
  --gold:#d99a00;
  --red:#c1272d;
  --redbg:#fbeaea;
  --cond:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;
  --mono:"DejaVu Sans Mono",monospace;
  --sans:"Liberation Sans",Arial,sans-serif;
}

html,body{ background:#fff; }
body{
  font-family:var(--sans);
  font-size:6.9pt;
  line-height:1.25;
  color:var(--ink);
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.sheet{ background:var(--sheet); }

.mono{ font-family:var(--mono); }
b,strong{ font-weight:bold; }

/* ============ BANNER ============ */
.banner{ background:var(--ink); color:#fff; padding:10px 15px 9px; }
.brow{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.brand{ font-family:var(--cond); font-weight:bold; font-size:19.5pt; line-height:0.96; letter-spacing:0.2px; }
.addr{ font-family:var(--mono); font-size:7.04pt; line-height:1.385; text-align:right; color:#e8e8e6; white-space:nowrap; }
.bdiv{ height:0.75pt; background:var(--ink2); margin:8px 0 9px; }
.brow2{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
.ptitle{ font-family:var(--cond); font-weight:bold; font-size:16.5pt; line-height:1.0; }
.psub{ font-family:var(--cond); font-weight:bold; font-size:9.37pt; line-height:1.0; letter-spacing:1.6px; color:#e8e8e6; margin-top:2px; }
.meta{ font-family:var(--mono); font-size:7.04pt; line-height:1.385; text-align:right; color:#e8e8e6; white-space:nowrap; }
.meta .m1{ font-weight:bold; color:#fff; }
.meta .m5{ color:#b9b9b5; }

/* ============ COLOR STRIP ============ */
.strip{ display:flex; height:5.25pt; }
.strip i{ flex:1 1 20%; }

/* ============ PANEL ============ */
.panel{ background:#fff; border:0.75pt solid var(--bd); margin-top:10.5pt; }
.panel-h{ background:var(--cream2); border-bottom:0.75pt solid var(--bd); padding:4px 10px; font-family:var(--cond); font-weight:bold; font-size:9.75pt; line-height:1.15; letter-spacing:0.3px; }
.panel-h em{ font-family:var(--cond); font-weight:normal; font-style:normal; font-size:7.5pt; color:var(--muted); letter-spacing:0.3px; }
.panel-b{ padding:6px 10px 6.5px; }

.keys{ display:flex; flex-wrap:wrap; column-gap:16px; row-gap:5px; }
.key{ display:flex; align-items:center; gap:5px; font-size:7.87pt; line-height:1.0; }
.badge{
  display:inline-block; font-family:var(--mono); font-weight:bold; font-size:7.87pt;
  line-height:11px; color:#fff; background:var(--char); border-radius:2px;
  padding:2px 5px; min-width:16px; text-align:center;
}
.b-green{background:var(--green)} .b-blue{background:var(--blue)} .b-char{background:var(--char)}
.b-amber{background:var(--amber)} .b-gold{background:var(--gold)}
.keynote{ font-size:6.9pt; line-height:1.3; margin-top:7px; }

/* ============ SECTION HEAD ============ */
.sec{ margin-top:9px; }
.sec-head{ display:flex; align-items:baseline; border-bottom:1.5pt solid var(--ink); padding-bottom:7px; margin-bottom:6px; break-after:avoid; }
.sec-num{ font-family:var(--mono); font-weight:bold; font-size:8.25pt; line-height:11px; color:#fff; background:var(--ink); border-radius:2px; padding:3px 7px; align-self:center; }
.sec-t{ font-family:var(--cond); font-weight:bold; font-size:11.25pt; line-height:1.0; letter-spacing:0.4px; margin-left:7.5pt; }
.sec-s{ margin-left:auto; font-family:var(--mono); font-size:7.12pt; color:var(--muted); letter-spacing:0.3px; }

/* ============ TABLES ============ */
/* break-inside:auto, not avoid — see the note at the top of this file. A tall
   table that cannot fit the remaining page is split at a row boundary and its
   header repeats, instead of the whole table jumping to the next page. */
table.g{ width:100%; border-collapse:collapse; background:#fff; border:0.75pt solid var(--bd); table-layout:fixed; break-inside:auto; }
table.g thead{ display:table-header-group; }
table.g tr{ break-inside:avoid; }
table.g th{
  background:var(--ink); color:#fff; font-family:var(--cond); font-weight:bold; font-size:7.04pt;
  line-height:1.04; text-align:left; padding:2px 4.5px; letter-spacing:0.3px;
  border-right:0.75pt solid var(--ink2);
}
table.g th:last-child{ border-right:0; }
table.g td{ padding:2px 4.5px; border-right:0.75pt solid var(--bd2); border-top:0.75pt solid var(--bd2); vertical-align:top; }
table.g td:last-child{ border-right:0; }
table.g tbody tr:first-child td{ border-top:0; }
table.g tbody tr:nth-child(even){ background:var(--cream); }
table.g td.mid{ vertical-align:middle; }
.c{ text-align:center; }

/* spine */
.spine{ border-left:3pt solid transparent; }
.s-green{ border-left-color:var(--green) } .s-blue{ border-left-color:var(--blue) }
.s-char{ border-left-color:var(--char) } .s-amber{ border-left-color:var(--amber) }
.s-gold{ border-left-color:var(--gold) }
table.spined{ border-left:0; }

.sysc{ display:flex; align-items:center; gap:5px; }
.sysc b{ font-size:6.9pt; }
.svc{ display:block; }
.svc .badge{ margin-left:5px; vertical-align:-2px; }

/* sub headings */
.sub{ font-family:var(--cond); font-weight:bold; font-size:8.62pt; letter-spacing:0.4px; margin:0 0 3px; line-height:1.1; break-after:avoid; }
.sub em{ font-family:var(--cond); font-weight:normal; font-style:normal; font-size:7.5pt; color:var(--muted); }
.blk{ font-family:var(--cond); font-weight:bold; font-size:9.0pt; letter-spacing:0.4px; margin:0 0 4px; line-height:1.15; }

.note{ font-size:7.2pt; line-height:1.45; margin-top:4px; color:var(--ink); }
.note.sm{ font-size:6.9pt; }
.note .g{ color:var(--muted); }
.tnote{ font-size:6.9pt; line-height:1.4; margin-top:3.5px; color:var(--muted); }

/* callouts */
.callout{ background:var(--cream2); border-left:3pt solid var(--muted); padding:6px 10px 7px; margin-top:8px; break-inside:avoid; }
.callout.red{ background:var(--redbg); border-left-color:var(--red); }
.callout.red .blk{ color:var(--red); }
.callout ul{ list-style:none; }
.callout li{ font-size:7.2pt; line-height:1.5625; padding-left:12px; position:relative; }
.callout li:before{ content:"\2022"; position:absolute; left:3px; }
.callout p{ font-size:7.2pt; line-height:1.45; }

/* grids */
.g2{ display:grid; grid-template-columns:1fr 1fr; gap:6.75pt; align-items:start; }
.g13{ display:grid; grid-template-columns:1.3fr 1fr; gap:6.75pt; align-items:start; }
.stack>*+*{ margin-top:8px; }

/* mini two-column spacing table */
table.mini{ width:100%; border-collapse:collapse; table-layout:fixed; }
table.mini td{
  font-family:var(--mono); font-size:6.9pt; padding:1.5px 4px;
  border-top:0.75pt solid var(--bd2); border-right:0.75pt solid var(--bd2); vertical-align:top;
}
table.mini td:last-child{ border-right:0; }
table.mini tr:first-child td{ border-top:0; }

/* swatches */
.sw{ display:inline-block; width:11.25pt; height:8.25pt; border-radius:1.5px; vertical-align:-1px; margin-right:5px; }
.swrow{ font-size:7.87pt; }

/* footer */
.foot{ display:flex; justify-content:space-between; gap:16px; border-top:0.75pt solid var(--bd); margin-top:10px; padding-top:6px; font-family:var(--mono); font-size:6.75pt; line-height:1.35; color:var(--muted); letter-spacing:0.3px; }
.foot div:last-child{ text-align:right; }

.avoid{ break-inside:avoid; }
`.trim();

/**
 * Structural patterns lifted from the template, annotated so the model copies the
 * markup shape rather than inventing its own.
 */
export const TEMPLATE_PATTERNS = String.raw`
=== DOCUMENT SHELL ===
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{DIVISION_TITLE}} Cheat Sheet &mdash; {{PROJECT_SUB}}</title>
<style>
[THE FULL TEMPLATE CSS ABOVE, VERBATIM]
</style>
</head>
<body>
<div class="sheet">
  [BANNER]
  [COLOR STRIP]
  [KEY PANEL]
  [SECTIONS 01..NN]
  [FOOTER]
</div>
</body>
</html>

=== BANNER (always first; address block is fixed BCH data, never change it) ===
<div class="banner">
  <div class="brow">
    <div class="brand">BCH MECHANICAL,<br>L.L.C.</div>
    <div class="addr">
      6354 118th Avenue North &middot; Largo, FL 33773<br>
      P: 727-546-3561<br>
      F: 727-545-1801<br>
      Toll Free F: 1-866-523-5750
    </div>
  </div>
  <div class="bdiv"></div>
  <div class="brow2">
    <div>
      <div class="ptitle">PLUMBING</div>
      <div class="psub">CHEAT SHEET &middot; DIVISION 22</div>
    </div>
    <div class="meta">
      <div class="m1">{{PROJECT_NAME uppercase}}</div>
      <div>{{PROJECT_SUB}}</div>
      <div>Prepared by {{PREPARER_NAME}} &middot; {{PREPARER_TITLE}}</div>
      <div>{{PREPARER_EMAIL}}</div>
      <div class="m5">Quick-ref &mdash; verify against full spec &amp; drawings</div>
    </div>
  </div>
</div>

=== COLOR STRIP (immediately after the banner, five fixed swatches) ===
<div class="strip">
  <i style="background:#0e7a43"></i><i style="background:#1d6fb8"></i><i style="background:#33383b"></i><i style="background:#b45309"></i><i style="background:#d99a00"></i>
</div>

=== KEY PANEL (system abbreviations; cite the legend drawing in the <em>) ===
<div class="panel avoid">
  <div class="panel-h">SYSTEM ABBREVIATIONS &amp; COLOR KEY <em>&mdash; ABBREVS PER DRAWING {{LEGEND_DRAWING}}</em></div>
  <div class="panel-b">
    <div class="keys">
      <div class="key"><span class="badge b-green">CW</span>Domestic Cold Water</div>
      <div class="key"><span class="badge b-char">S</span>Sanitary Waste</div>
      <div class="key"><span class="badge b-blue">ST</span>Storm Drain</div>
      <div class="key"><span class="badge b-amber">GW</span>Grease Waste</div>
      <div class="key"><span class="badge b-gold">G</span>Natural Gas</div>
    </div>
    <div class="keynote">&#9888; <b>Band colors are for finding sections on this sheet only</b> &mdash; they are not what you install. For actual
    pipe-label &amp; underground-tape colors, see the Identification &amp; Labeling section.</div>
  </div>
</div>

=== SECTION HEAD (sec-s lists the CSI numbers the section draws from) ===
<div class="sec">
  <div class="sec-head"><span class="sec-num">01</span><span class="sec-t">PIPE MATERIAL &mdash; BY SYSTEM &amp; LOCATION</span><span class="sec-s">SPEC 22 11 19 &middot; 22 13 16</span></div>
  ...
</div>

=== SPINED TABLE (color spine on the first cell identifies the system) ===
<table class="g spined">
  <colgroup><col style="width:18%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:19.5%"><col style="width:23.5%"></colgroup>
  <thead><tr><th>SYSTEM</th><th>ABOVE GROUND &mdash;<br>CONCEALED</th><th>ABOVE GROUND &mdash;<br>EXPOSED</th><th>BELOW GROUND</th><th>NOTES</th></tr></thead>
  <tbody>
    <tr>
      <td class="spine s-green mid"><span class="sysc"><span class="badge b-green">CW</span><b>Domestic Cold Water</b></span></td>
      <td>Copper <span class="mono">Type K</span>, hard temper</td>
      <td>Copper <span class="mono">Type K</span>, hard temper</td>
      <td>Copper <span class="mono">Type K</span>, soft drawn</td>
      <td>Exterior CW gets insulated.</td>
    </tr>
    <tr>
      <td class="spine s-char mid"><span class="sysc"><span class="badge b-char">S</span><b>Sanitary Waste</b></span></td>
      <td>Cast iron soil, svc wt, <b>NO-HUB</b></td>
      <td>Cast iron soil, svc wt, <b>NO-HUB</b></td>
      <td>Schedule 40 PVC DWV</td>
      <td style="color:#c1272d"><b>Above-ground P-traps = chrome-plated brass.</b></td>
    </tr>
  </tbody>
</table>

=== PLAIN TABLE (no spine) ===
<table class="g">
  <colgroup><col style="width:24%"><col style="width:38%"><col style="width:38%"></colgroup>
  <thead><tr><th>MATERIAL</th><th>JOINT METHOD</th><th>REQUIREMENTS</th></tr></thead>
  <tbody>
    <tr><td><b>Copper tube</b></td><td>Solder &mdash; <span class="mono">95-5</span> tin-antimony</td><td>Ream after cut, clean/tin ends.</td></tr>
  </tbody>
</table>

=== NESTED MINI TABLE (spacing matrices: rowspan the outer cell, nest table.mini) ===
<tr>
  <td class="spine s-char" rowspan="3">No-Hub CI</td>
  <td class="mono">&le;6"</td><td class="mono"><b>3/8"</b></td>
  <td rowspan="3" colspan="2" style="padding:0">
    <table class="mini"><colgroup><col style="width:30.9%"><col style="width:69.1%"></colgroup>
      <tr><td>All sizes</td><td><b>5 ft</b></td></tr>
    </table>
  </td>
  <td rowspan="3" class="mono">Every story (15 ft max)</td>
</tr>
<tr><td class="mono">8"&ndash;12"</td><td class="mono"><b>1/2"</b></td></tr>
<tr><td class="mono">14"</td><td class="mono"><b>3/4"</b></td></tr>

=== CALLOUTS ===
<div class="callout red">
  <div class="blk">DO NOT</div>
  <ul>
    <li>Install PVC piping in A/C plenums or equipment rooms used as plenums.</li>
    <li>Use PVC P-traps above ground &mdash; chrome-plated brass only.</li>
  </ul>
</div>

<div class="callout">
  <div class="blk">UNDERGROUND UTILITY SEPARATION</div>
  <p>Water &amp; sewer: <span class="mono">10 ft</span> horizontal separation. Min cover <span class="mono">3 ft</span>.</p>
</div>

<div class="callout" style="border-left-color:var(--gold)">
  <div class="blk">WATER HAMMER &amp; AIR</div>
  <p>Arresters per <span class="mono">PDI-WH201</span> at plan locations w/ access panels.</p>
</div>

=== SIDE-BY-SIDE LAYOUTS ===
<div class="g2">                      <!-- two equal columns -->
  <div class="stack"> ... </div>       <!-- stack = vertical gap between children -->
  <div class="stack"> ... </div>
</div>

<div class="g13">                     <!-- 1.3fr : 1fr, table left / callout right -->
  <div> [table + .tnote] </div>
  <div> [callout] </div>
</div>

=== SUB-HEADINGS & NOTES ===
<div class="sub">ROD SIZE &amp; SPACING</div>
<div class="sub">MOUNTING HEIGHTS <em>&mdash; FLOOR TO RIM</em></div>
<div class="note sm"><b>Support:</b> hanger at each valve, strainer &amp; change of direction.</div>
<div class="tnote">Thicknesses shown are minimums per spec &mdash; drawings may require more.</div>

=== COLOR SWATCH ROWS (identification / warning-tape tables) ===
<tr><td class="swrow"><span class="sw" style="background:#1d6fb8"></span>Blue</td><td>Water &amp; associated lines</td></tr>

=== FOOTER (last element inside .sheet) ===
<div class="foot">
  <div>{{PROJECT_SUB}} &middot; {{DIVISION_TITLE}} CHEAT SHEET &middot; {{DIVISION_SHORT}}</div>
  <div>QUICK-REFERENCE &mdash; GOVERNED BY FULL SPECIFICATION &amp; CONTRACT DRAWINGS</div>
</div>

=== BADGE / SPINE COLOR ASSIGNMENT ===
b-green / s-green  potable & domestic water, hydronic supply
b-blue  / s-blue   storm, condensate, chilled water, supply air
b-char  / s-char   sanitary, vent, return air, general steel
b-amber / s-amber  grease/oil waste, stainless, exhaust
b-gold  / s-gold   natural gas, fuel oil, refrigerant
Use the same color for the same system everywhere on the sheet.
`.trim();

/** CSS for the companion checklist document. Same house style, simpler grid. */
export const CHECKLIST_CSS = String.raw`
@page { size: letter; margin: 40pt 42pt; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root{
  --ink:#1a1d1f; --ink2:#3a3f42; --muted:#6b7280; --bd:#b7b3a8; --bd2:#d9d6ce;
  --cream:#f6f5f0; --cream2:#f1efe8; --green:#0e7a43; --blue:#1d6fb8;
  --amber:#b45309; --red:#c1272d; --redbg:#fbeaea;
  --cond:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;
  --mono:"DejaVu Sans Mono",monospace;
  --sans:"Liberation Sans",Arial,sans-serif;
}
html,body{ background:#fff; }
body{ font-family:var(--sans); font-size:8.5pt; line-height:1.4; color:var(--ink);
  -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.mono{ font-family:var(--mono); }

.head{ background:var(--ink); color:#fff; padding:12px 16px; }
.head h1{ font-family:var(--cond); font-weight:bold; font-size:16pt; line-height:1.05; letter-spacing:0.3px; }
.head .sub{ font-family:var(--mono); font-size:8pt; color:#e8e8e6; margin-top:4px; line-height:1.5; }
.strip{ display:flex; height:5pt; }
.strip i{ flex:1 1 20%; }

h2{ font-family:var(--cond); font-weight:bold; font-size:12pt; letter-spacing:0.4px;
  border-bottom:1.5pt solid var(--ink); padding-bottom:5px; margin:18px 0 8px; break-after:avoid; }
h3{ font-family:var(--cond); font-weight:bold; font-size:10pt; letter-spacing:0.3px; margin:12px 0 5px; break-after:avoid; }
p{ margin:5px 0; }

/* Same break rules as the sheet: the discrepancy log is the tallest table in
   the document, and break-inside:avoid was pushing it whole onto a fresh page
   (measured: checklist page 1 only 39% full). Rows stay atomic, header repeats. */
table{ width:100%; border-collapse:collapse; border:0.75pt solid var(--bd); margin-top:6px; break-inside:auto; }
thead{ display:table-header-group; }
tr{ break-inside:avoid; }
th{ background:var(--ink); color:#fff; font-family:var(--cond); font-weight:bold; font-size:8pt;
  text-align:left; padding:4px 6px; letter-spacing:0.3px; border-right:0.75pt solid var(--ink2); }
th:last-child{ border-right:0; }
td{ padding:4px 6px; border-top:0.75pt solid var(--bd2); border-right:0.75pt solid var(--bd2); vertical-align:top; }
td:last-child{ border-right:0; }
tbody tr:nth-child(even){ background:var(--cream); }

.sev{ display:inline-block; font-family:var(--mono); font-weight:bold; font-size:7.5pt; color:#fff;
  border-radius:2px; padding:1.5px 6px; letter-spacing:0.3px; white-space:nowrap; }
.sev-high{ background:var(--red); } .sev-medium{ background:var(--amber); } .sev-low{ background:var(--blue); }

ul{ list-style:none; margin:5px 0; }
li{ padding-left:16px; position:relative; margin:3px 0; }
/* Drawn, not typed. This was U+2610, which no served font subset covers — it
   fell back to Segoe UI Symbol on Windows and to nothing on the serverless
   Chromium build, where 13 checkboxes per checklist came out as tofu. */
li:before{ content:""; position:absolute; left:0; top:0.25em;
  width:0.78em; height:0.78em; box-sizing:border-box; border:0.75pt solid var(--ink); }
ul.plain li:before{ content:"\2022"; left:5px; top:0;
  width:auto; height:auto; border:0; font-family:var(--mono); }

.box{ background:var(--cream2); border-left:3pt solid var(--muted); padding:8px 12px; margin-top:10px; break-inside:avoid; }
.box.red{ background:var(--redbg); border-left-color:var(--red); }
.box h3{ margin-top:0; }

.foot{ border-top:0.75pt solid var(--bd); margin-top:20px; padding-top:8px;
  font-family:var(--mono); font-size:7.5pt; color:var(--muted); display:flex; justify-content:space-between; gap:16px; }
.foot div:last-child{ text-align:right; }
`.trim();

export const CHECKLIST_PATTERNS = String.raw`
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Verification Checklist &amp; Discrepancy Log</title>
<style>[THE CHECKLIST CSS ABOVE, VERBATIM]</style></head>
<body>
  <div class="head">
    <h1>VERIFICATION CHECKLIST &amp; DISCREPANCY LOG</h1>
    <div class="sub">{{PROJECT_NAME}} &middot; {{PROJECT_SUB}}<br>{{DIVISION_TITLE}} &middot; Prepared by {{PREPARER_NAME}}</div>
  </div>
  <div class="strip"><i style="background:#0e7a43"></i><i style="background:#1d6fb8"></i><i style="background:#33383b"></i><i style="background:#b45309"></i><i style="background:#d99a00"></i></div>

  <p style="margin:10px 0 0;color:#6b7280">This upload contained plumbing specifications. No sheet metal &amp; air distribution or hydronic &amp; mechanical piping sections were found in it, so no sheet was built for those trades. If that scope exists on this job, its specification was not part of what was uploaded.</p>

  <h2>1 &middot; DISCREPANCY LOG</h2>
  <p style="margin:4px 0 0;color:#6b7280">High and medium severity, highest first. Read the HIGH entries before pricing or building from the sheet.</p>
  <table>
    <thead><tr><th style="width:7%">#</th><th style="width:10%">SEVERITY</th><th style="width:20%">WHERE</th><th style="width:20%">AFFECTS</th><th>PROBLEM / SHEET SHOWS / DO THIS</th></tr></thead>
    <tbody>
      <tr>
        <td class="mono">D-01</td>
        <td><span class="sev sev-high">HIGH</span></td>
        <td class="mono">22 70 00 §3.3.I<br>vs NFPA 54 §7.3.1</td>
        <td>Outdoor gas piping above 5 psi</td>
        <td><b>Problem —</b> The spec allows threaded joints outdoors at any pressure; NFPA 54 requires welded above 5 psi.<br>
        <b>Sheet shows —</b> Welded above 5 psi, the more stringent of the two.<br>
        <b>Do this —</b> Price welded joints for the outdoor run; confirm with the engineer if the threaded reading was intended.</td>
      </tr>
    </tbody>
  </table>

  <p style="margin:8px 0 0;color:#6b7280">38 low-severity items were logged: loose wording, superseded standard references, and cross-references to sections that were not issued. None changes what is bought or built. The full list is held with this job in the generator.</p>

  <div class="box red">
    <h3>GAPS — NO VALUE FOUND IN THE SPECS</h3>
    <ul class="plain"><li>Item the sheet could not answer, and where to look for it.</li></ul>
  </div>

  <div class="foot">
    <div>{{PROJECT_SUB}} &middot; {{DIVISION_TITLE}}</div>
    <div>COMPANION TO THE CHEAT SHEET &mdash; NOT A CONTRACT DOCUMENT</div>
  </div>
</body>
</html>
`.trim();

/**
 * Injected into <head> right before rendering. The template's font stack names
 * DejaVu / Liberation faces, which exist on a Linux workstation but not on
 * headless Chromium or Windows. These are metric-compatible substitutes:
 * Arimo == Liberation Sans == Arial metrics; Archivo Narrow for the condensed
 * face; Roboto Mono for the monospace face.
 */
/**
 * Google Fonts splits each family into unicode-range subsets and serves none
 * covering arrows (U+2190-21FF), math operators (U+2200-22FF) or geometric and
 * misc symbols (U+25A0-27BF). Spec text is full of `>=`, `<=` and arrows, and the
 * checklist drew its checkbox from U+2610 — so those characters silently fell out
 * of Arimo into whatever the host had: Arial and Segoe UI Symbol on Windows,
 * nothing at all on the serverless Chromium build, where they render as tofu.
 *
 * Noto Sans Math and Noto Sans Symbols 2 are declared after each family so the
 * fallback is itself a webfont — the same glyphs on every host — rather than a
 * system font that differs between a laptop and Vercel.
 *
 * `npm run check:fonts` fails the build if any character still lands on a system
 * face.
 */
export const FONT_PATCH = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;700&family=Arimo:wght@400;700&family=Roboto+Mono:wght@400;700&family=Noto+Sans+Math&family=Noto+Sans+Symbols+2&display=swap" rel="stylesheet">
<style>
:root{
  --sym:"Noto Sans Math","Noto Sans Symbols 2";
  --cond:"Archivo Narrow",var(--sym),"Liberation Sans Narrow","Arial Narrow",Arial,sans-serif;
  --mono:"Roboto Mono",var(--sym),"DejaVu Sans Mono",Consolas,"Courier New",monospace;
  --sans:"Arimo",var(--sym),"Liberation Sans",Arial,Helvetica,sans-serif;
}
</style>
`.trim();
