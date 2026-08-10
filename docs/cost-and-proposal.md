# What this costs to run — notes for a proposal

Written for the conversation with BCH about adopting the tool. Every figure here
comes from measured runs on a real Division 23 job, not estimates.

---

## Why there is an API cost at all

The tool's output is a judgment, not a transformation. Producing a line like

> §3.2.B assigns Seal Class B or C by location and pressure; the Duct Schedule
> (§3.9) lists Seal Class A as the minimum for every duct type. Resolved to
> Class A (more stringent) throughout — see Discrepancy D-01.

requires reading two parts of a specification, noticing they disagree, deciding
which governs, and recording the decision. There is no rule-based substitute for
that. Remove the model and the tool becomes a PDF converter that produces nothing.

So the cost is not overhead attached to the product — it *is* the product.

## Measured cost per sheet

One full Division 23 job: 10 spec sections, ~185,000 characters of spec text.
Actual token usage at full strength: **81,377 input, 56,205 output**.

| Configuration | Per sheet | Discrepancies found | Duration |
|---|---|---|---|
| **Opus 5, high effort** (best quality) | **$1.81** | 23 | ~9 min |
| Sonnet 5, medium effort | $0.46 | 9 | ~5 min |
| Opus 5 via Batch API (50% off, async) | $0.91 | 23 | up to 1 hr |

Division 22 sheets are smaller and cost less.

## Annual cost at realistic volume

| Sheets per year | Opus 5 (best) | Sonnet 5 (economy) |
|---|---|---|
| 25 | $45 | $12 |
| 50 | $91 | $23 |
| 100 | $181 | $46 |
| 200 | $362 | $92 |

**At full strength, on 100 sheets a year, the tool costs about $180.**

Hosting is free (Vercel Hobby) or $20/month (Vercel Pro, only needed if sheets
must be generated through the website rather than locally).

## The comparison that matters

The cost side is settled and small. The value side depends on numbers only BCH
can supply:

- How long does a PM currently spend reading a division's specs and pulling out
  what the field needs?
- What is that person's loaded hourly cost?
- How many jobs per year would use a sheet?

`(hours saved per sheet) x (loaded rate) x (sheets per year)` against roughly
`$2 per sheet` is the whole argument. Fill in the left side honestly — including
that the tool does not replace reading the spec, it front-loads it.

The second half of the value is harder to quantify and probably larger: the
discrepancy log surfaces conflicts *before* they are built. One caught
seal-class or joint-type conflict on an airport job is worth more than a decade
of the tool's running cost.

## Ways to lower the cost, in order of usefulness

1. **Use Sonnet 5 instead of Opus 5** — 4x cheaper, but finds meaningfully fewer
   discrepancies (9 vs 23 on the same specs). Reasonable for Division 22, a poor
   trade for a complex Division 23 job.
2. **Batch API** — 50% off for work that can wait. Sheets are not urgent; a job
   submitted at the end of the day and collected the next morning would halve the
   cost. Not currently implemented.
3. **Prompt caching** — already implemented. The ~11,000-token house template is
   cached across runs rather than re-billed each time.
4. **Lower effort** — cuts cost and time, cuts discrepancy coverage with it. The
   deployed site already runs at `medium` because of its 300s time limit.

## Practical points for adoption

- **The company should own the API account, not an individual.** An Anthropic
  organization account with company billing, and API keys issued from it. A key
  on a personal account creates a single point of failure and a messy handover.
- **Set a monthly spend limit** in the Anthropic console. At these volumes a cap
  of $50/month is generous and makes runaway cost impossible.
- **Rotate keys on a schedule**, and use separate keys for local development and
  the deployed site so either can be revoked without affecting the other.
- **Spec documents are sent to Anthropic's API for processing.** They are not
  used for training on commercial API traffic, but confirm this against BCH's
  own client confidentiality obligations before uploading anyone else's specs.

## What the tool does not do

Worth saying plainly in any proposal, so expectations are right:

- It is a field reference, not a contract document. It does not replace the spec
  or the drawings.
- It reads only what is uploaded. It does not read drawings.
- Values can be wrong, stale, or incomplete — particularly where a section defers
  to a standard or to a drawing. The checklist exists precisely because the sheet
  should be checked before anyone builds from it.
