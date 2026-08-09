# BCH Cheat Sheet Generator

Turns construction specification PDFs into BCH Mechanical field cheat sheets.
Upload the spec sections for one division, fill in the project info, and get back
a styled cheat-sheet PDF plus a verification checklist PDF.

Internal tool — no accounts, no database.

---

## Running it locally

You need **Node.js 20 or newer**.

```bash
npm install
```

Then create `.env.local` (copy `.env.local.example`) and put your key in it:

```
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open <http://localhost:3000>.

PDF rendering locally uses whichever Chromium-based browser it finds — Chrome
first, then Edge (always present on Windows). If neither is found, set
`LOCAL_CHROME_PATH` in `.env.local`.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New → Project**, import the repo. Framework preset is detected
   as Next.js; no build settings to change.
3. **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` for
   Production, Preview, and Development.
4. Deploy.

### Function timeout — measured, not guessed

`app/api/generate/route.ts` sets `maxDuration = 300`, which is **Hobby's default
and its hard maximum**. Pro allows up to 800s, but you must also raise that
constant — it has to be a literal, so it cannot be read from an env var.

A full Division 23 job (10 sections, ~185,000 characters) was timed end to end on
identical input:

| `ANTHROPIC_EFFORT` | Duration | Sheet pages | Discrepancies found | Fits Hobby (300s) |
|---|---|---|---|---|
| `medium` | 243s | 4 | 7 | yes, ~57s spare |
| `high` (default) | 495s | 5 | 11 | no |

So on Hobby, a full Division 23 run needs `ANTHROPIC_EFFORT=medium`. The cost is
real: `high` found 57% more discrepancies on the same specs, and discrepancies are
the point of the checklist.

**On Pro**, set `ANTHROPIC_EFFORT=high` (or leave it unset) and change
`maxDuration` to `800` in `app/api/generate/route.ts`. Don't set 800 while on
Hobby — a `maxDuration` above the plan limit fails the deployment.

Division 22 is much smaller and fits comfortably either way.

The route streams NDJSON progress frames, so a timeout surfaces as a clear error
naming the elapsed seconds rather than hanging. If the elapsed time is very close
to the platform ceiling, that is what you are hitting.

---

## How it works

```
Browser                        Server
───────                        ──────
drop PDFs  ──── multipart ───▶ POST /api/extract
                                 pdf-parse → text + page-1 CSI number
           ◀─── JSON ──────────  per-file text, section number, match status

Generate   ──── JSON ────────▶ POST /api/generate   (NDJSON stream back)
                                 1. select matched sections, warn on the rest
                                 2. Anthropic API → cheat sheet HTML
                                                  + checklist HTML
                                                  + discrepancies JSON
                                 3. Chromium (puppeteer-core) → two PDFs
           ◀─── {type:"step"} ─  progress frames throughout
           ◀─── {type:"done"} ─  both PDFs as base64 + summary
```

Extraction is a separate call so the required-sections checklist fills in the
moment files are dropped, and so the PDFs are only uploaded once — `/api/generate`
receives the already-extracted text as JSON.

---

## Layout

```
app/
  layout.tsx              header + sidebar shell
  page.tsx                "New Sheet" — the tool
  past-jobs/page.tsx      localStorage history table
  how-to-use/page.tsx     per-division upload guide
  about/page.tsx
  api/
    extract/route.ts      PDF → text + CSI section number
    generate/route.ts     model call + PDF rendering, streams progress
components/
  Sidebar, DivisionSelector, ProjectForm, UploadZone,
  GenerateButton, ProgressSteps, ResultsPanel, DiscrepancyLog
lib/
  template.ts             the house CSS + component patterns (system prompt)
  anthropic.ts            system prompt assembly, API call, response parsing
  pdf-extract.ts          pdf-parse wrapper, keeps pages separate
  pdf-render.ts           HTML → PDF (sparticuz on Vercel, local Chrome in dev)
  section-matcher.ts      CSI number regex + division matching
  upload-lists.ts         the three divisions and their Tier 1 sections
  past-jobs.ts            localStorage + base64 download helpers
  types.ts
assets/
  BCH-Cheat-Sheet-TEMPLATE.html   the source template, for reference
```

### Page breaks — the one rule that must not be reverted

`table.g` uses `break-inside: auto`, **not** `avoid`, with `tr { break-inside: avoid }`
and `thead { display: table-header-group }` alongside it.

`avoid` looks like the safe choice and the original build spec asked for it. It
isn't. A table taller than the space left on the page cannot honour it, so Chromium
moves the *whole* table to the next page and leaves the remainder blank. Measured
on a real Division 23 sheet: page 1 ran 72% full (209pt lost), and the checklist's
page 1 ran 39% full (452pt lost). After the change: 98–99%.

The intent behind the old rule survives — rows never split, and a continued table
repeats its column headers.

`npm run check:layout` asserts these rules and **runs automatically before
`npm run build`**, so a regression fails the build rather than shipping. If you
ever need to change the page-break behaviour deliberately, update
`scripts/check-page-breaks.mjs` in the same commit.

> The `bch-cheat-sheet` **skill** is separate software built from the same
> template and still carries this bug. See [docs/skill-page-break-patch.md](docs/skill-page-break-patch.md).

### Where the format lives

`lib/template.ts` holds the CSS and the component patterns, both injected into
the system prompt. `TEMPLATE_CSS` is copied verbatim from
`assets/BCH-Cheat-Sheet-TEMPLATE.html` with **one deliberate change**: the
template's final `.sec { break-inside: avoid }` rule is dropped, per the build
spec's page-break rules. `table.g` and `.callout` keep theirs.

On the reference template this makes no difference — it renders to 4 pages with
or without the rule (verified). It matters on longer sheets, where a
break-protected section that doesn't fit the remaining space gets pushed whole
onto a fresh page and leaves the previous one half empty.

To change how sheets look, edit `lib/template.ts` — not the model prompt.

### Fonts

The template names DejaVu and Liberation faces, which exist on a Linux
workstation but not on headless Chromium or Windows. `FONT_PATCH` in
`lib/template.ts` is injected into `<head>` at render time and maps the three CSS
font variables onto metric-compatible Google Fonts (Arimo for Liberation Sans,
Archivo Narrow for the condensed face, Roboto Mono for the mono face), so the
PDF measures the same everywhere.

---

## Configuration

| Variable | Required | Default | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — | |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-5` | Sonnet tier, current model ID |
| `ANTHROPIC_EFFORT` | no | `high` | `low`/`medium`/`high`/`xhigh`/`max` — higher reads the specs more thoroughly, costs more tokens, takes longer |
| `LOCAL_CHROME_PATH` | no | auto-detect | Local dev only; ignored on Vercel |

---

## Troubleshooting

**`Cannot find module './873.js'`** (or any similar missing-chunk runtime error).
The output directory is in a mixed state — usually from a `next build` that ran
while `next dev` was up, so the build replaced chunks the browser already held.
`next.config.mjs` gives dev its own `.next-dev` directory specifically to stop
this, so it should not recur. If it ever does:

```bash
npm run dev
```

after deleting the output directories — stop the dev server, remove `.next` and
`.next-dev`, then start it again.

**`ANTHROPIC_API_KEY is not set`** in the progress panel. `.env.local` is missing
or has no key. Next only reads `.env.local` at startup, so restart the dev server
after creating it.

**`No local Chrome or Edge found`.** Install Google Chrome, or point
`LOCAL_CHROME_PATH` at any Chromium-based browser. Only affects local dev — Vercel
uses `@sparticuz/chromium`.

---

## Known limits

- **Scanned PDFs produce nothing.** `pdf-parse` reads embedded text, not images.
  A scanned section is flagged per-file in the upload zone and skipped. Run OCR
  first.
- **Past Jobs are per-browser.** Two PDFs as base64 run roughly 500 KB–1 MB per
  job against a ~5 MB localStorage budget, so the history is capped at 10 and
  drops the oldest entries if the quota is hit. A database is Phase 2.
- **~150,000 characters of spec text** is the point past which coverage of the
  later sections starts to thin. The app warns and generates anyway.
- **Desktop-first.** The sidebar does not collapse on mobile.

---

Designed and developed by Joshua Ahwai, BCH Mechanical, 2026.
