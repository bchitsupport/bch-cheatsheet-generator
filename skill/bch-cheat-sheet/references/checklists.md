# Required outputs — three artifacts, every time

Every build produces the PDF **plus three checklists**, written to files alongside
the PDF so they can be saved with the submittal record. Do not deliver them only
as chat prose — the reviewer needs something to attach and sign.

Write them to one file: `<sheet-name>-Checklist.md`.

| # | Checklist | Answers |
|---|---|---|
| 1 | **Coverage** | Did every spec article get accounted for? |
| 2 | **Build** | Did the file render correctly? |
| 3 | **Discrepancy log** | What's wrong or missing in the spec itself? |

On a revision round, replace Coverage with the **Revision verification** checklist
(format at the bottom).

---

## 1. Coverage checklist

The reviewer's tool. One row per spec article that carries field content — where it
landed, or why it didn't. This is what lets someone confirm nothing important was
dropped without re-reading the whole spec.

```
## Coverage — [spec section number and title]

| Spec § | Requirement | Sheet section | Status |
|---|---|---|---|
| §2.6.C | Water-based joint sealant | 03 Sealants | On sheet |
| §3.9.B | Supply duct pressure/seal/leakage | 01 Duct Schedule | On sheet |
| §1.4 | Action submittals | — | Excluded — submittal procedure |
| §3.7 | Duct cleaning methodology | 08 Testing (summary only) | Partial — detail left to spec |
| §4.8 | Concealed exhaust insulation | 05 Insulation | **Flagged — GAP #7** |
```

Status is one of: `On sheet` · `Partial` · `Excluded — <reason>` ·
`Flagged — <log #>`.

**Every article in the section appears exactly once.** An article that is pure
boilerplate still gets a row with `Excluded`. A blank is indistinguishable from an
oversight.

---

## 2. Build checklist

Mechanical verification of the render. Machine-checkable, so actually run the
checks — never assert them.

```
## Build

| Check | Method | Result |
|---|---|---|
| Page count | pdfinfo | N pages |
| Special glyphs render | grep extracted text for ½ ¼ ¾ ≤ ≥ ° § ⚠ × − | counts; 0 replacement chars |
| No split tables | rasterize and view every page | pass / fail |
| No orphaned section heads | rasterize and view every page | pass / fail |
| No clipped or overflowing cells | rasterize and view every page | pass / fail |
| No revision label | text search "rev" | none found |
| Preparer line present | text search | ✓ |
| Disclaimer present (banner + footer) | text search | ✓ |
| Restricted markings not carried over | text search project security/legal notices | none found |
| Page fill | last content y per page | p1 N% · p2 N% ... |

**Pagination:** p1 [sections] · p2 [sections] · ...
```

Rasterize and *look at* every page. Text extraction will not catch a badge clipped
at a column edge or a value overflowing its cell — both have happened on real
builds.

**Restricted markings matter.** Spec sections often carry security or public-records
notices in every page header. Those must not survive into the cheat sheet. Check
explicitly.

---

## 3. Discrepancy log

The highest-value output. Turns spec ambiguity into RFIs before buyout instead of
change orders after. For estimating it doubles as a risk register.

```
## Discrepancy log — [sheet] — [project] — [date]

| # | Type | Where | Issue | Recommended resolution | Impact |
|---|---|---|---|---|---|
| 1 | CONFLICT | §3.2.B vs §3.9 | ... | ... | cost — see note |

**Sheet currently shows:** [what was put on the sheet pending resolution, per open item]
```

Types: `OVERLAP` · `GAP` · `CONFLICT` · `AMBIGUOUS` · `STALE`
(defined in `data-block-schema.md`).

**Impact** is what the reader acts on. "No cost or schedule impact" signals a
clarification and gets answered faster. Where there is impact, say which kind and
why — "Seal Class A is more sealing than B; if the bid was priced off §3.2.B that
is a delta" is useful; "may affect cost" is not.

**Any value on the sheet that is not literally in the spec** — supplied from code,
industry practice, an approved submittal, or a consolidation of rows — appears here
with its basis. Never let a supplied value pass as a spec value.

If nothing was found, say so explicitly. An absent log reads like a skipped step.

---

## Revision verification checklist

Used instead of Coverage when updating an existing sheet. Walk the user's numbered
items in their order, one row each, and confirm each landed — plus anything that
moved as a consequence.

```
## Revision checklist — [sheet] — [date]

| # | Requested change | Status |
|---|---|---|
| 1 | [restate their item] | ✓ + what it now reads |

**Consequential changes** (not requested, made to keep the layout intact):
- [what and why, so the user can veto]

**Build re-checks:** [the Build table above]
```

Restate each item in the user's own terms, not yours — they need to match it
against what they asked for without translating.

---

## What not to claim

Do not write that the sheet has been verified against the specification.

When content is extracted section by section across separate passes, the finished
sheet cannot be reliably re-checked against source text no longer in context. Report
what was checked and leave spec verification to a named human.

Every delivered sheet carries a named preparer and a named reviewer with a date.
"The AI made it" is not a defense anyone wants to give when a fitter installs from a
wrong value.
