# Data block schema — Phase 2 output format

A data block is the plain-markdown intermediate between a spec section and the
styled sheet. One block per spec section. Output them in chat so the user can
save them.

**Why blocks instead of going straight to the sheet:** a 384-page division won't
fit in one pass with any quality. Blocks are small enough to paste into a fresh
conversation, small enough for a human to check against the spec, and when a spec
is revised only the affected block gets rebuilt.

---

## Format

````
## DATA BLOCK — [spec number] [spec title]
**Sheet:** [PLUMBING | HYDRONIC PIPING | SHEET METAL]
**Target section:** [section number and title on the sheet]
**Source:** [spec section number, revision/date if shown]

### TABLE: [table name]
| Col 1 | Col 2 | Col 3 |
|---|---|---|
| value | value | value |

- source: §[paragraph]
- mono: [which columns render in mono font]
- spine: [system → color, if the table carries system spines]

### NOTE: [where it attaches — under which table, or section-level]
[note text]
- source: §[paragraph]

### CALLOUT: [heading] — [RED | NEUTRAL]
- [bullet]
- [bullet]
- source: §[paragraph]

### DISCREPANCIES
- [type] §[paragraph] vs §[paragraph] — [what conflicts] — [recommended resolution]

### EXCLUDED
- [what was in the spec section but deliberately left off, and why]
````

---

## Rules

**One row per distinct requirement.** If three pressure ranges all resolve to
welded black steel, that's one row reading "all pressures" — with the
consolidation noted under EXCLUDED so the reviewer can see it was deliberate.

**Every table and note carries a `source:` line.** A value with no traceable
paragraph doesn't belong on a field sheet.

**Mark mono columns.** Dimensions, pressures, and standards designations render in
mono on the sheet. Flag them here so Phase 3 doesn't have to re-decide.

**Never fill a gap with a guess.** If the spec is silent, that's a DISCREPANCIES
entry. If code or industry practice fills it, say which and log it — the sheet
will show it as a supplied value, not a spec value.

**EXCLUDED is not optional.** It's how a reviewer confirms nothing important was
dropped. List consolidations, submittal/warranty boilerplate skipped, and
anything judged out of scope.

---

## Discrepancy types

| Type | Meaning |
|---|---|
| `OVERLAP` | Two paragraphs both cover the same size, pressure, or condition with different answers |
| `GAP` | A range or condition the spec never addresses |
| `CONFLICT` | Spec contradicts drawings, another spec section, or a referenced standard |
| `AMBIGUOUS` | One reading is possible but not certain |
| `STALE` | Spec references a superseded standard, discontinued product, or obsolete method |

---

## Worked example

````
## DATA BLOCK — 22 11 19 Domestic Water Piping Specialties
**Sheet:** PLUMBING
**Target section:** 06 Valves & Specialties
**Source:** 22 11 19, Rev 01

### TABLE: Backflow Preventers
| Type | Size | Body |
|---|---|---|
| Reduced Pressure (RP) — ASSE 1013 | ¾"–3" | Bronze |
| Reduced Pressure (RP) — ASSE 1013 | 4"–6" | Iron, epoxy-coated waterway |

- source: §2.8.A, §2.8.B
- mono: Size; ASSE designations
- spine: none

### DISCREPANCIES
- OVERLAP §2.8.A vs §2.8.B — 4" appears in both ranges (A: ¾"–4" bronze;
  B: 4"–6" iron). No code resolves it: ASSE 1013 and AWWA C511 are performance
  standards, silent on body material. Industry practice does — bronze RP bodies
  stop at 2" (a few lines to 3"); 2½"+ are flanged epoxy-coated iron. Basis-of-
  design Watts 909 has no 4" bronze variant. §2.8.B also says flanged, and a 4"
  would be flanged. RECOMMEND: iron per §2.8.B; RFI to confirm §2.8.A should
  read ¾"–3". Sheet shows ¾"–3" bronze pending confirmation.

### EXCLUDED
- §2.8.C-E testing and certification procedures — not field-install content
````
