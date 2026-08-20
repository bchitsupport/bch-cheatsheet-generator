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

## Making it live

**Nothing here has ever been deployed.** The tool has only ever run on the
laptop it was written on. Everything in this section is reasoned from how the app
behaves rather than from a server that has run it, so expect one round of
surprises on the first attempt. The traps most likely to cause them are called
out as they come up — a competent Linux or Node administrator should not need the
author, but should read this whole section before starting rather than following
it a step at a time.

### Who does what

**Whoever is handing it over:** transfer the repository and confirm somebody
accepts it — a pending transfer looks identical to a completed one from the
sender's side. Hand the API key over separately, never through the repository.

**BCH, before any of the technical work:** name someone who owns this. A tool
that spends money per use and has no owner stops being maintained the first time
it breaks, and the failure is quiet.

### 1. An Anthropic API key

This is the blocker. Without it the application starts, serves its pages, and
can do nothing at all.

It must be BCH's own key on a BCH-owned account, not a personal one. While
setting the account up, **set a monthly spend limit on it**. There is
deliberately no spend cap in the application — a cap that halts a build halfway
wastes everything already spent on it — so the account limit is the only
backstop that exists. See *What it costs* for the numbers to pick a limit from.

### 2. The machine

- **Node.js 20 or newer.** `package-lock.json` is committed, so use `npm ci`
  rather than `npm install` and the dependency versions are reproducible.
- **Google Chrome.** PDF rendering drives a real browser through `puppeteer-core`.
  On a server, install Chrome from Google's apt repository — it lands at
  `/usr/bin/google-chrome-stable`, which the app checks for, and it pulls in the
  system libraries headless Chrome needs. A minimal VM image will not have those
  libraries otherwise, and the failure is an opaque shared-library error rather
  than anything about PDFs.

  **The snap trap.** `apt install chromium-browser` on current Ubuntu installs a
  snap whose binary is at `/snap/bin/chromium`. That path is *not* in the list
  the app searches, so rendering fails with "No local Chrome or Edge found" on a
  machine that visibly has Chromium installed. Either install Google Chrome
  proper, or set `LOCAL_CHROME_PATH` in `.env.local` to the real binary. The
  comment in `.env.local.example` describes that variable as being for local
  development; on a self-hosted server it is a legitimate escape hatch.
- **Outbound HTTPS** to `api.anthropic.com`, `fonts.googleapis.com` and
  `fonts.gstatic.com`. Without the font hosts, documents render in the wrong
  typefaces and **nothing warns you** — the sheets simply come out looking wrong.
  `npm run check:fonts` is the test for this and it needs no API credit.
- **Size.** 2 vCPU and 4 GB RAM — that part is an estimate, and Chromium plus a
  1600-page PDF being parsed are the two things that need the headroom. Disk is
  measured: `node_modules` is 516 MB and the production build another 148 MB, so
  a deployed copy is around 700 MB before it does any work. Allow 10 GB and it
  will be a long time before anything needs attention.

  Working files grow slowly. A data block is about 14 KB and a finished sheet
  with its checklist about 800 KB, so a job on a 25-section book leaves roughly
  1 MB behind between `.block-cache/` and whatever is downloaded. At five sheets
  a week that is on the order of 250 MB a year — real, but not urgent. See
  *Ongoing ownership* below.

### 3. Install

```bash
git clone <the repository> /opt/cheatsheets
cd /opt/cheatsheets
npm ci
cp .env.local.example .env.local
```

Edit `.env.local` — at minimum `ANTHROPIC_API_KEY` and `ACCESS_CONTROL`. Every
other variable is documented in that file, including the Entra sign-in block.

The file holds an API key, so it should be owned by the service account and
readable only by it:

```bash
chown cheatsheets:cheatsheets .env.local && chmod 600 .env.local
```

Then build:

```bash
npm run build
```

### 4. Choose the access model

`ACCESS_CONTROL=network-only` means reaching the site at all requires being on
the LAN or the VPN, with no sign-in. The alternative is Microsoft Entra ID,
configured with the variables in `.env.local.example`.

**The app refuses to serve any non-local host until one of the two is set.** That
is deliberate, not a bug to work around: it stops an unfinished setup sitting
open on the network with a tool that spends money and reads confidential bid
documents. If the site returns a refusal after deployment, this is why.

### 5. If it sits behind a reverse proxy, raise the timeouts

**This will break the tool if it is missed, and the symptom does not point at the
cause.** A build streams NDJSON for the entire run — 15 to 45 minutes — over one
HTTP connection that is deliberately never buffered. Nginx's `proxy_read_timeout`
defaults to 60 seconds, and Apache's `ProxyTimeout` likewise. At that default the
connection is cut mid-run, the browser reports that the server stopped
responding, and the money for everything read up to that point is spent with no
sheets produced.

On nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
    proxy_cache off;
}
```

`proxy_buffering off` matters as much as the timeout: with buffering on, the
progress events are held back and the page looks frozen for the whole run.

Serving it directly on port 3000 with no proxy avoids all of this, and for a
LAN-only tool that is a perfectly reasonable choice. Whichever way, open the port
to the LAN in the firewall.

### 6. Run it as a service, not from a terminal

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

### 7. Prove it works, cheaply, in this order

Do not test by building a sheet. Each step below costs more than the last, and
each one proves something the next depends on.

```bash
npm run check:fonts     # webfonts reachable — free
npm run check:layout    # page-break rules intact — free
npm run split -- "<a real spec book.pdf>"   # does this book parse? free, seconds
```

If the split reports sections with sensible page ranges, the hard part works.
Then use the website: upload the same book and **scan** it, which stops at the
review screen and costs around $0.35 on a large manual. Only when the review
screen looks right should anyone press Build.

The first real build is also the first test of the reverse-proxy timeout, so
watch it rather than walking away.

### 8. Ongoing ownership

- **Spend.** There is no cap in the app. The monthly limit on the Anthropic
  account is the backstop; somebody should be looking at the bill.
- **Disk.** `out/` and `.block-cache/` grow without limit and hold content
  derived from client specifications. Both are safe to delete when no run is in
  progress — the cache only costs a re-read if it is cleared, and `out/` is only
  written by the command-line scripts and the development-only save route. The
  growth is slow (see *The machine* above), so a periodic clear-out is enough;
  what matters more is that the content is client material sitting on a server,
  which is a retention question rather than a disk one.
- **Past Jobs is not a shared record.** It is browser `localStorage`: per
  machine, per person, and gone when browser data is cleared. If BCH expects a
  company history of every sheet ever produced, that does not exist and nobody
  should discover it at a bad moment.

### 9. Updating it later

```bash
cd /opt/cheatsheets
git pull
npm ci
npm run build
sudo systemctl restart cheatsheets
```

Rebuild before restarting, not after: `npm start` serves whatever is in `.next`,
so restarting without building serves the previous version and looks like the
update silently failed.

---

## Running it on your own machine

For a server, follow *Making it live* above instead — this is the developer
quick-start.

```bash
npm ci
npm run dev          # development, http://localhost:3000
npm run build && npm start   # production build, served locally
```

`.env.local` needs, at minimum:

```
ANTHROPIC_API_KEY=sk-ant-...
ACCESS_CONTROL=network-only
```

See `.env.local.example` for everything else, including the Microsoft Entra
sign-in settings if that is ever wanted instead of network-only access, and the
machine requirements in *Making it live* for Chrome and the outbound hosts.

**On a deployed server the app refuses to serve any non-local host unless one of
those two access-control choices is set.** That is deliberate. It stops an
unfinished setup sitting open on the network with a tool that spends money and
reads confidential bid documents. Localhost is exempt, which is why development
needs no such setting.

**`next dev` and `next build` write to different directories** (`.next-dev` and
`.next`), so a build cannot pull the chunks out from under a running dev server.
But `npm start` serves `.next`, so if you have only ever run `npm run dev`, run
`npm run build` before `npm start` or you will serve a stale build.


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

That rule is also what lets a build skip the classifier. Both stages post to the
same route with the same files, so pressing Build used to repeat the split and
the classification the review screen had just shown — a second charge and several
more minutes for an answer already on the user's screen. The client posts the
reviewed manifest back and `reuseManifest` reconstitutes it.

The split is still redone, because the section text has to come from somewhere
and splitting costs nothing. It is also the check: a positional manifest is only
valid against a split that produced the same sections in the same order, so
`reuseManifest` verifies the count, every section number at every index, every
role and every primary's targets before accepting any of it. Anything that does
not line up returns null and the route classifies again and says so. Reading one
section against its neighbour's classification would be far worse than paying
twice.

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

A scan is separate and much cheaper — one small-model call per thirty sections,
about **$0.35** on a 216-page project manual and less on a single division. It is
the guard before the money: it reports what is in the upload and what a build
would cost, and stops. **A build no longer repeats it** — the reviewed manifest is
posted back rather than worked out again, so the classification is paid for once
per upload.

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
pages, so it moves whole. Cosmetic, no content lost. Seen on three books and
explicitly not on a fourth — a Division 23 book produced six sheet metal pages at
97–99% fill — so it depends on where section 14 happens to land and will not
reproduce on demand. Measure the sheet that showed it rather than any sheet.
Fixing it means changing grid page-break behaviour across every sheet and
regression testing all three divisions — worth a quiet hour, not a rushed one.

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
- **The review screen opens with its two long lists folded shut.** The section
  table and the pointer list are reference, not the decision, and open by default
  they buried the three trade checkboxes and pushed the build button several
  screens down. The counts sit on each closed summary, so nothing is hidden —
  "16 shown · 101 supporting hidden" means exactly that, and the supporting rows
  are one more click away inside.
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
npm run split -- <file.pdf>            # what sections are in a book? free, seconds
npm run split -- --verify <dir>        # regression test: split a folder of single
                                       # section PDFs, check against their names
npm run build:sheets -- <dir>          # scan only: what is in an upload
npm run build:sheets -- <dir> --build out/x --trades plumbing
npm run blocks -- <dir> <outDir>       # reading phase only, no sheets — the way to
                                       # exercise the block cache without composing
npm run measure -- <sheet.pdf>         # page fill; flags a page under ~90%
npm run check:fonts                    # every character resolves to a webfont?
npm run check:layout                   # page-break rules still intact?
npm run typecheck
```

The two `--verify` folders are the splitter regression test, and they have a known
right answer: 19/19 and 29/29 sections with exact page ranges. Run both after any
change to `lib/spec-splitter.ts`, and split every book you have before and after —
page ranges moving on a book you were not thinking about is the failure that
matters.

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

**The page emptied itself in the middle of a run** — in development, saving a file
that will not hot-reload cleanly makes Next do a full reload, and a full reload
throws away the uploaded files, the manifest and the progress card while the
server carries on spending. The run finishes and its output goes nowhere. Do not
edit code while a build is running, and if you must, expect to lose the screen
rather than the money.

**Two dev servers, and the tool behaves like an older version of itself** — Next
takes the next free port when 3000 is busy, so a forgotten server keeps answering
on 3000 while the one you just started is on 3001. It has caused an afternoon of
confusion more than once. `netstat -ano | findstr :300` lists them; kill the
strays and keep one.

**A long run dies with `terminated`, `ECONNRESET` or `overloaded`** — transient,
and `withRetry` in `lib/anthropic.ts` handles all of them with backoff. If a new
name for the same fault appears, add it to that pattern; the list has grown twice
already.

**Sheets look thin in the later sections** — that was the failure the two-phase
design fixed. If it reappears, check that `/api/build` is being used rather than
the old `/api/generate` path.
