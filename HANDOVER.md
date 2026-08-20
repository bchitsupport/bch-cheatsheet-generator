# Handover

Built by Joshua Ahwai for BCH Mechanical, 2026. This is what someone picking it
up needs to know, including the reasoning behind decisions that would otherwise
look arbitrary.

---

## What it does

Upload a project's mechanical specifications — a whole manual, one division, or a
folder of sections — and it produces a cheat sheet per trade (plumbing, sheet
metal, hydronic piping) plus a discrepancy log for each. It is written for
estimators first: what governs quantity, material and scope leads.

---

## Running it

```bash
npm install
npm run dev          # development, http://localhost:3000
npm run build && npm start   # production
```

`.env.local` needs, at minimum:

```
ANTHROPIC_API_KEY=sk-ant-...
ACCESS_CONTROL=network-only
```

See `.env.local.example` for everything else, including the Microsoft Entra
sign-in settings if that is ever wanted instead of network-only access.

**On a deployed server the app refuses to serve any non-local host unless one of
those two access-control choices is set.** That is deliberate. It stops an
unfinished setup sitting open on the network with a tool that spends money and
reads confidential bid documents.

### The server needs

- Node.js 20+
- Google Chrome or Edge installed (PDF rendering drives a real browser)
- Outbound HTTPS to `api.anthropic.com`, `fonts.googleapis.com`,
  `fonts.gstatic.com` — without the font hosts, documents render in the wrong
  typefaces and nothing warns you

### Run it as a service, not from a terminal

`npm start` in a shell dies when that session closes and does not come back after
a reboot — the tool works until the first restart and then quietly does not.

On Ubuntu, a systemd unit:

```ini
# /etc/systemd/system/cheatsheets.service
[Unit]
Description=BCH cheat sheet generator
After=network.target

[Service]
WorkingDirectory=/opt/cheatsheets
ExecStart=/usr/bin/npm start
Restart=always
Environment=PORT=3000
EnvironmentFile=/opt/cheatsheets/.env.local
User=cheatsheets

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now cheatsheets
```

On Windows, NSSM or a scheduled task set to run at startup does the same job.

A run takes 15–45 minutes, so `Restart=always` matters: a crash mid-build should
bring the service back rather than leave the site down until somebody notices.

---

## How it works, and why

### One call per spec section, not one per division

The first version read a whole division in a single pass. That was not a
context-size problem — measured on a real Division 23 book, the 48,000-character
testing-and-balancing section and the 42,000-character water treatment section
were both sitting in the model's context and were simply never used. The sheet
headed CHEMICAL TREATMENT did not cite the chemical treatment spec.

So each section is read on its own (`lib/data-blocks.ts`), producing a structured
"data block", and the sheets are composed from those blocks
(`generateSheetFromBlocks` in `lib/anthropic.ts`). No call ever sees more than one
section, so there is no point past which coverage falls away.

Measured against single-pass on the same books: **31 discrepancies against 20 on
piping, 38 against 28 on sheet metal**, both in fewer pages.

Blocks are built once per book and every sheet composes from the same set. That
is what makes reading a whole division for two trades affordable, and why two
sheets from one upload agree with each other about anything they share.

### The sheet outline is fixed; its sources are not

`lib/upload-lists.ts` holds a fixed outline per trade — the sections, their
titles, their order. **Do not make this dynamic.** An earlier version let the
model design the outline each run, and two generations from identical PDFs came
back with different section counts and content filed in different places. The
fixed outline is what makes two sheets comparable.

What *is* discovered per job is which spec sections feed which outline section
(`lib/section-router.ts`). Hardcoded section numbers broke three ways on one real
job: domestic water piping was 22 11 16 rather than 22 11 19, the fuel system was
oil rather than gas, and two sections carried `.13` suffixes.

### Splitting a combined book

`lib/spec-splitter.ts`. Every page of a spec book carries its section in the
running header, so pages are attributed individually rather than boundaries being
guessed. Verified against four books from four offices; 48/48 sections recovered
exactly on the two that could be checked against ground truth.

Three number conventions appear in the wild and all three parse: `22 05 29`,
`230000`, `23 0700`. Where a book states its own section length ("Page 3 of 11"),
that is checked against the detected range — it caught a 106-page controls
section swallowed by its neighbour, and 25 pages of commissioning spec from an
entirely different project bound into a book by mistake.

**If a new office's book splits badly**, run `npm run split -- <file.pdf>` first.
It costs nothing, takes seconds, and tells you whether the format is understood
before anyone spends money on it.

### Only Divisions 22 and 23 are read

`READ_DIVISIONS` in `lib/section-router.ts`. A full project manual runs to
thousands of pages across twenty divisions; reading everything a classifier
called "possibly relevant" cost about $30 a sheet against $5 for the mechanical
divisions alone, for carpet and lighting sections that earn no place on a
fitter's sheet.

Sections outside those divisions that bear on the work are not discarded — they
are named to the model as context, and the review screen lists them with a price
each so a user can have any of them read in full.

---

## What it costs

Measured on Opus 5 at high effort, Carrollwood Division 22, 19 sections:

| | |
| --- | --- |
| Reading the sections | ~$3.60 |
| Writing one sheet | ~$2.30 |
| **One complete sheet + its log** | **~$6** |

At five sheets a week that is roughly **$1,600 a year**.

Output is about 80% of the bill — input is cheap by comparison. If cost ever needs
reducing, the lever is how much the model writes, not caching or input size.

**There is no spend cap in the app**, by decision: a cap that halts a build
halfway wastes everything already spent on it. The estimate shown before a run is
the guard. A monthly limit can be set on the Anthropic account itself as a
backstop.

---

## Known problems

**Sheet metal page-break defect.** One page comes out 77–81% full instead of
~95%. Section 14 is a two-column grid and Chromium will not split those across
pages, so it moves whole. Cosmetic, no content lost, seen on three books. Fixing
it means changing grid page-break behaviour across every sheet and regression
testing all three divisions — worth a quiet hour, not a rushed one.

**The block cache is unverified.** `.block-cache/` should let a failed compose
reuse the reading phase instead of redoing it ($2.30 instead of $6). It was built
but never proven to hit — credits ran out before the test. Check the log line
after any run: `[blocks] ... read=N reused=M`. If `reused` is always 0 on a
repeated job, the cache keys are not stable and it is doing nothing.

**`out/` and `.block-cache/` grow without limit.** Both hold content derived from
client specifications. On a long-lived server they need a cleanup policy. Neither
is committed.

**Past Jobs is browser-local.** `localStorage`, so it is per-machine and
per-person and vanishes when browser data is cleared. Not a shared history.

---

## Things that will look wrong but are not

- **`/api/generate` and `run-division.mjs` still exist** and use the old
  single-pass path. Kept deliberately as a fallback and as the only way to
  reproduce a single-pass baseline for comparison.
- **`/api/save` writes files to disk on request.** Development only — it returns
  404 in production, verified. It exists so a browser-driven test can be
  inspected with the same tools as a command-line one.
- **`force-dynamic` on the root layout.** The access-control banner depends on an
  environment variable read at runtime; prerendered, the layout baked in whatever
  the variable was during `npm run build`, and the banner never appeared. Nothing
  here benefits from being static.
- **The word "field" survives in `FIELD TESTING & BALANCING`.** That is a
  technical term — testing done on site rather than at the factory — not a label
  for the audience. The audience wording was removed; this was kept on purpose.

---

## The Claude skill was retired

See `docs/retired-skill.md`. Short version: it had become a different product
wearing the same name, and two estimators pricing the same job from the two tools
would have got materially different answers. **Do not rebuild it from git
history** — build it from whatever the website does at that time, and measure the
two against the same specs before giving it to anyone.

---

## Useful commands

```bash
npm run split -- <file.pdf>        # what sections are in a book? free, seconds
npm run build:sheets -- <dir>      # scan only: what is in an upload, a few cents
npm run build:sheets -- <dir> --build out/x --trades plumbing
npm run measure -- <sheet.pdf>     # page fill; flags a page under ~90%
npm run check:fonts                # every character resolves to a webfont?
npm run check:layout               # page-break rules still intact?
npm run typecheck
```

`PROJECT_NAME` must be set for anything that builds. The scripts refuse to run
without it rather than banner the wrong job — an earlier version had a project
hardcoded and produced a week of sheets carrying the wrong name.

---

## If something breaks

**"Your credit balance is too low"** — top up at console.anthropic.com. Not a
code fault.

**A run reports no error but produces no sheets** — the dev server rebuilt
mid-run and the request hit a stale deployment. Restart it. The scripts now catch
this and say so.

**A long run dies with `terminated`, `ECONNRESET` or `overloaded`** — transient,
and `withRetry` in `lib/anthropic.ts` handles all of them with backoff. If a new
name for the same fault appears, add it to that pattern; the list has grown twice
already.

**Sheets look thin in the later sections** — that was the failure the two-phase
design fixed. If it reappears, check that `/api/build` is being used rather than
the old `/api/generate` path.
