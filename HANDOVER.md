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

`lib/spec-splitter.ts`. Most spec books carry the section in a running header on
every page, so pages are attributed individually rather than boundaries being
guessed. That is the reliable path and it reports `method: running-header`.
Verified against five books from five offices; 48/48 sections recovered exactly
on the two that could be checked against ground truth, and those two are the
regression test — run them after any change to this file:

```bash
npm run split -- --verify "<folder of single-section PDFs>"
```

The file names carry the true section numbers and page counts, so the split has a
known right answer. Two of the five books have no running header; see below.

Three number conventions appear in the wild and all three parse: `22 05 29`,
`230000`, `23 0700`. Where a book states its own section length ("Page 3 of 11"),
that is checked against the detected range — it caught a 106-page controls
section swallowed by its neighbour, and 25 pages of commissioning spec from an
entirely different project bound into a book by mistake.

**If a new office's book splits badly**, run `npm run split -- <file.pdf>` first.
It costs nothing, takes seconds, and tells you whether the format is understood
before anyone spends money on it.

#### Books with no running header

Some books have none, and then boundaries come from the `SECTION 22 05 00 -
TITLE` line that opens each section, with following pages inheriting it. The
result says `method: section-lines` and deserves a human glance, because two
things go wrong on that path that cannot go wrong on the other.

**A contents page looks exactly like a running header.** A book that prints a
list of its own sections gives every entry the shape `22 05 00 - Common Work
Results for Plumbing`, and the splitter used to take the first one as the page's
identity. Five contents pages became five one-page sections on a 216-page manual,
and one of them took the number `22 05 00` — colliding with the real Common Work
Results for Plumbing 125 pages later. So a page whose lines are mostly
number-and-title, with no `SECTION` line of its own, is treated as contents: it
names no section, joins none, and contributes no text. The threshold is a ratio,
not a count, because real spec pages carry up to seventeen cross-references
written the same way. Measured over five books, genuine pages peak at 0.30 and
contents pages run 0.45 to 0.83.

**A section starts partway down a page.** These books run continuously, so the
first page attributed to a section usually opens with the tail of its
predecessor. Nothing corrects the text for this yet — but the classifier is now
shown the excerpt starting at the section's own `SECTION` heading, because taking
the first 900 characters described the wrong section entirely: `DOMESTIC WATER
PIPING` was excerpted as pipe insulation, `COMMERCIAL WATER CLOSETS` as water
heater flue venting.

**A warning that fires on everything is not a warning.** Each section can carry
"no page in this run is numbered within its section, so its extent is inferred".
On a book with no page numbering at all that fired on 117 sections of 117, which
tells a reader exactly as much as firing on none, while the banner naming the
method already says it once in the right place. It is now emitted only where it
discriminates — where the book numbers its pages somewhere and this section is
missing them. On the 1611-page book that is 7 sections of 163, and those seven
are worth opening. Apply the same test to any per-section warning added later.

### A section is identified by position, never by its number

A book can name the same number in two places — a divider page, a heading caught
mid-page, a section genuinely split across the book — so the number is not a key,
and treating it as one fails silently and badly.

It failed three ways at once on one manual. The classifier's replies were keyed
by number, so a contents page's classification stood in for the real section's.
The review screen looked each row's pages up by number and showed two `22 05 00`
rows both reading "pages 5-5" for a section really at 130. And the pointer list
was selected by number while the rows it filtered were positional, so every
occurrence of a repeated number was listed — one book showed the same pointer
twice, out of order, because three rows shared one React key.

The classifier is therefore given a `ref` per section and must return it, and
every page, text, cost and block lookup in `/api/build` and `/api/blocks` goes by
index. `buildManifest` returns exactly one entry per section it was given, in
order, and `planReading` documents that its `sources` argument must be
index-aligned with it. **If you add a step that looks a section up by number,
that is the bug coming back.**

### Absence and ignorance are different answers

A trade with too few sections of its own reports as not present. That claim is
made on the review screen and again in the coverage line printed on every
checklist, so it has to be true.

It was not. When a batch of classifications failed to parse, its sections fell
through to "supporting everywhere", which counts toward no trade — and a book
specifying nine plumbing sections reported PLUMBING as not detected, with nothing
on screen to say the tool had simply failed to look. Unclassified sections are
now counted per division and reported as such, `TradePresence.uncertain` marks
the difference, and `describeCoverage` will not write "no plumbing sections were
found" about a division it could not classify.

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


### The block cache works — within one caveat

`.block-cache/` holds each section's data block, so a run that dies while writing
sheets does not pay to read the book again. Measured on two sections, second run
immediately after the first:

```
[blocks] sections=2 read=2 reused=0 in=5230 out=6591   60,115ms
[blocks] sections=2 read=0 reused=2 in=0    out=0      13,655ms
```

Zero tokens the second time. On a full division that is the difference between
$2.30 and $6 for a retry.

**The caveat is in the key.** It hashes the model, the system prompt, the section
text — and the section's `targets` and `supportingFor`, which come from the
classifier rather than from the book. The classifier is a model call and does
vary between runs: two scans of the same manual gave 9 and then 10 primary
sections for plumbing. A section whose targets come back different gets a
different key and is read again.

So a hit is not guaranteed by identical input, only made likely by it. That is
the right trade — a block built for one set of targets should not be served for
another — but it means the cache helps a retry most when the retry follows
quickly and the classification lands the same way. **Check the log line after any
repeated run:** `[blocks] ... read=N reused=M`. If `reused` is 0 on a job you
have just run, compare the two manifests before assuming the cache is broken;
the likelier culprit is that the classifier moved.

---

## Known problems

**A body line can still be read as a section heading.** `SECTION_LINE` is
anchored to the start of a line and case-sensitive, which keeps ordinary
cross-references out — "as specified in Section 01 25 00" does not match. But a
line that genuinely begins `SECTION 03 30 00 ...` mid-paragraph does, and text
extraction breaks lines on vertical position rather than on sentences. On the
216-page manual that produced three one-page fragments: `03 30 00` at pages 58
and 60, `23 09 00` at 177, each carrying the tail of whatever preceded it and a
summary reading "Continuation of ...".

They are no longer dangerous — each occurrence is classified on its own now, so a
fragment cannot answer for the real section, and the real `03 30 00` and
`23 09 00` are intact. But `23 09 00` is a controls section, and the fragment
sits beside it in the list looking like scope. Tightening the pattern is a
regex change that affects every book, so do it against `npm run split`, which is
free, and check all five books before and after rather than only the one that
prompted it.

**Ticking a repeated section reads every copy of it.** The "read this in full"
checkboxes send section numbers, so ticking `03 30 00` marks all three of its
occurrences to be read while the `+$0.05` shown counts only one. Rare, and it
needs a decision rather than a patch: a section genuinely split across two places
probably *should* be read whole, in which case the estimate is what is wrong. The
pointer list itself is correct — one row per section.

**"10 primary" can sit above "9 sections of this trade's own scope."** Not a
defect. A section outside Division 22 can still be plumbing scope and be read as
primary — natural-gas distribution at `33 51 00` is, on one job — but presence is
counted only from sections carrying the trade's own division number, since that
is the one thing that does not vary between offices. Without that filter a
Division 23 book claimed a plumbing sheet on the strength of shared hangers and
identification.

**Sheet metal page-break defect.** One page comes out 77–81% full instead of
~95%. Section 14 is a two-column grid and Chromium will not split those across
pages, so it moves whole. Cosmetic, no content lost, seen on three books. Fixing
it means changing grid page-break behaviour across every sheet and regression
testing all three divisions — worth a quiet hour, not a rushed one.

**`out/` and `.block-cache/` grow without limit.** Both hold content derived from
client specifications. On a long-lived server they need a cleanup policy. Neither
is committed.

**Past Jobs is browser-local.** `localStorage`, so it is per-machine and
per-person and vanishes when browser data is cleared. Not a shared history.

---

## Things that will look wrong but are not

- **`.gitignore` anchors `/build/` and `/dist/` with a leading slash.** That
  slash is load-bearing. Unanchored, git matches `build/` at any depth, and it
  matched `app/api/build/` — so `route.ts`, the two-phase pipeline the whole app
  runs through, was silently untracked for months and never appeared in
  `git status`. A fresh clone had no `/api/build` at all. Do not remove the
  slash, and if you add an ignore rule for a build output, anchor it.
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
