# The Claude skill was retired, August 2026

`skill/bch-cheat-sheet/` and `scripts/build-skill.mjs` were removed. Anyone with
the skill installed on their Claude account should delete it.

## Why

It was not deleted for being bad. It was deleted because it had become a
**different product wearing the same name**, and that is worse than having no
second option:

|                    | Skill                          | Website                         |
| ------------------ | ------------------------------ | ------------------------------- |
| Reading            | one pass over the whole upload | one call per spec section       |
| Discrepancies      | never measured                 | 50–60% more than a single pass  |
| Severity           | undefined — model's judgement  | ranked by cost of getting it wrong |
| Log format         | free paragraph                 | Affects / Problem / Sheet shows / Do this |
| Medical gas        | no section                     | its own section                 |
| Upload             | individual sections, attachment limits | whole manual, no limit  |
| Written for        | field crews                    | estimators first                |

The failure that mattered: two estimators pricing the same job, one using the
skill and one the website, would get materially different discrepancy logs and no
way to know why.

## Why it was not updated instead

The website's advantage is architectural — one call per section, readings reused
across sheets, a division filter over a 1,600-page manual. None of that fits a
skill that runs as a single conversation against per-conversation attachment
limits. Porting the wording would have made it *look* current while leaving it a
generation behind on the thing that actually changed.

It had also never run end to end. The distributed zip was built with PowerShell's
`Compress-Archive`, which writes backslash path separators; Claude rejects that
with "Zip file contains path with invalid characters". Nobody could install it.

## If a no-server option is ever needed again

Do not rebuild it from this history. Build it from whatever the website does at
that time, and measure it against the website on the same specs before giving it
to anyone — the gap here opened up because nobody compared the two.
