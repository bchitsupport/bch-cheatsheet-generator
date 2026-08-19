# BCH Cheat Sheet — Claude Skill

Turns construction specification sections into a BCH field cheat sheet in the
approved house format, plus a verification checklist and discrepancy log.

This is the **skill** version: it runs inside Claude, so there is nothing to
host, no server, and no API billing. Anyone at BCH with a Claude account can use
it.

---

## What you need

**A Claude account with Skills support** (Pro, Max, Team, or Enterprise). The
free tier does not support custom skills.

That is the whole cost. Usage comes out of the Claude subscription BCH already
pays for — there is no separate per-sheet charge.

## Installing it

1. Download **`bch-cheat-sheet.zip`** (in this folder).
2. Open Claude → **Settings** → **Capabilities** → **Skills**.
3. Choose **Upload skill** and select the zip.
4. It appears in your skill list as **bch-cheat-sheet**.

Each person who wants to build sheets installs it once on their own account.

> The exact menu wording moves around as Claude updates. If you can't find it,
> search Claude's settings for "Skills" — you're looking for the option to upload
> a custom skill from a file.

## Using it

Start a new Claude conversation and upload the spec sections you want covered —
**individual CSI section PDFs**, not a whole spec book. Then say something like:

> Build a BCH sheet metal cheat sheet from these. Project is Tampa International
> Airport, Airside D / CCBS. Prepared by Joshua Ahwai, Assistant Project Manager
> Intern, joshua.ahwai@bchmechanical.com. Legend drawing AD-M001.

Claude will confirm the scope, tell you if anything essential is missing, then
build the sheet and the checklist.

**Which sections to upload** is listed per division inside the skill
(`references/divisions.md`), and Claude will tell you if you've missed one.

## Read the checklist before anyone builds from the sheet

Every build produces two documents. The cheat sheet is the field reference. The
**checklist** is the audit trail: which sections were read, every conflict, gap
and ambiguity found in the specs, and how each conflict was resolved.

The high-severity entries are the point. A sheet is only as trustworthy as the
checklist that came with it.

## What it is not

- **A contract document.** It does not replace or amend the specification or the
  drawings. Verify against both.
- **A drawings reader.** It reads only the spec sections you upload.
- **Infallible.** Values can be wrong or incomplete, especially where a section
  defers to a standard or to a drawing. That is what the discrepancy log is for.

---

## Skill vs. the web app

There is also a web app version of this tool. Same house format, same rules.

| | Skill (this) | Web app |
|---|---|---|
| Cost | Covered by a Claude subscription | ~$2 per sheet in API usage |
| Setup | Upload a zip | Hosting + an API key |
| Upload PDFs | Attach to a chat | Drag and drop |
| Section matching | Claude checks against the list | Automatic, with a live checklist |
| Output | HTML + PDF in the conversation | Two PDFs, one click each |
| History | Your chat history | Past Jobs page |

The skill is the right thing to hand people today. The app is better once it is
worth someone owning the hosting and the API account.

---

## Rebuilding the zip

After changing anything under `bch-cheat-sheet/`:

```bash
npm run build:skill
```

**Do not repackage it with PowerShell's `Compress-Archive`.** On Windows it writes
`bch-cheat-sheet\SKILL.md` into the archive instead of `bch-cheat-sheet/SKILL.md`.
The ZIP spec requires forward slashes, so Claude rejects the upload with *"Zip
file contains path with invalid characters"* — and nothing catches it until
someone tries to install it. `npm run build:skill` uses `tar` and then reads the
archive's central directory back to prove the paths are right.

## Maintaining it

The skill and the app were built from the same house template and have drifted
apart before — which is how a page-break bug reached production output. If the
format changes, change it in one place and copy to the other. The app's
`lib/template.ts` is the source of truth, and its `npm run check:layout` guards
the page-break rules that matter.

To check any generated sheet's page usage:

```bash
npm run measure -- "path/to/sheet.pdf"
```

Every page except the last should be above about 90%. Anything in the 30–70%
range means something refused to split across a page break.
