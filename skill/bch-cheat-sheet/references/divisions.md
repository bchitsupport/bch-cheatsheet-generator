# Sheet taxonomy and upload lists

One sheet per trade. Division 23 is split into two sheets because pipefitters and
sheet metal workers are different crews with different foremen, the two scopes are
usually bid and taken off separately, and Division 23 as one sheet runs 10-14 pages
— which stops being a cheat sheet.

Shared sections appear on **both** Division 23 sheets, each carrying only its own
trade's rows. Duplicate the rows; do not cross-reference. A fitter should never
have to find the other sheet.

---

## How to tell the user what to upload

**Never ask for the whole division.** A 40-section division is mostly submittal,
warranty, and quality-assurance boilerplate; feeding it all in crowds out the
content that matters and precision drops.

**Upload by CSI section, never by page range.** Splitting at "page 100" cuts tables
in half. Spec books are normally stored as individual section PDFs — in Procore the
user multi-selects and downloads. Chat allows up to 20 files, so a full Tier 1
batch fits in one pass.

Give the user the Tier 1 list for their sheet and tell them to skip the rest. Do
not make them decide which sections matter.

**Check the revision column before every build.** If a section shows a higher
revision than the rest of the division, it was reissued — confirm the uploaded copy
is current. A sheet built from a superseded section is worse than no sheet.

---

## SHEET 1 — PLUMBING (Division 22)

**Banner:** `PLUMBING` / `FIELD CHEAT SHEET · DIVISION 22`

| Sec | Title | Spec sections |
|---|---|---|
| 01 | Pipe Material — by System & Location | 22 11 19, 22 13 16, 22 70 00 |
| 02 | Joints & Connections | 22 11 19, 22 13 16 |
| 03 | Hanger & Support Matrix | 22 05 29 + MSS SP-58 |
| 04 | Insulation Matrix | 22 07 00 |
| 05 | Drainage — Slopes, Cleanouts & Drains | 22 13 16, 22 13 19 |
| 06 | Valves & Specialties | 22 05 23, 22 11 19 |
| 07 | Fixtures & Mounting Heights | 22 40 00 |
| 08 | Identification & Labeling | 22 05 53 |
| 09 | Testing & Sterilization | 22 11 19, 22 13 16 |
| 10 | Natural Gas Systems | 22 70 00 + NFPA 54 |

Reference build: TPA Airside D / CCBS, 4 pages. Fuel gas piping lives in Division
22 on this project — keep it off both Division 23 sheets.

---

## SHEET 2 — HYDRONIC & MECHANICAL PIPING (Division 23, piping trade)

**Banner:** `HYDRONIC & MECHANICAL PIPING` / `FIELD CHEAT SHEET · DIVISION 23`

### Upload — Tier 1

`23 21 13` Hydronic Piping · `23 21 13.13` Underground Hydronic Piping ·
`23 21 16` Hydronic Piping Specialties · `23 05 23` General-Duty Valves ·
`23 05 29` Hangers and Support · `23 07 19` HVAC Piping Insulation ·
`23 05 53` Identification · `23 23 00` Refrigerant Piping

### Upload — Tier 2

`23 05 48` Vibration Controls · `23 05 17` Sleeves and Sleeve Seals ·
`23 05 19` Meters and Gauges · `23 21 23` Hydronic Pumps ·
`23 25 13` Water Treatment Closed-Loop · `23 25 16` Water Treatment Open-Loop ·
`23 25 33` Makeup-Water Filtration

### Upload — Tier 3 (skim; extract install requirements only)

`23 00 10` Basic Mechanical Requirements — may carry project-wide install rules
that override individual sections · `23 01 01` LEED — often carries VOC limits on
adhesives and sealants, which changes what gets bought · equipment sections
`23 52 16` `23 57 00` `23 64 16` `23 64 16.01` `23 64 26` `23 65 00` — see
Equipment Setting below

### Skip

`23 05 13` motors · `23 05 14` VFDs · `23 08 00` commissioning ·
`23 09 00` and `23 09 23` controls (delegated scope)

### Section order

| Sec | Title | Spec sections |
|---|---|---|
| 01 | Pipe Material — by System & Service | 23 21 13, 23 21 13.13, 23 23 00 |
| 02 | Joints & Connections | 23 21 13, 23 23 00 |
| 03 | Hanger & Support Matrix *(piping rows)* | 23 05 29 + MSS SP-58 |
| 04 | Insulation Matrix *(pipe insulation)* | 23 07 19 |
| 05 | Valves | 23 05 23 |
| 06 | Hydronic Specialties — air/dirt separation, expansion, makeup | 23 21 16, 23 25 33 |
| 07 | Pumps & Equipment Connections | 23 21 23, 23 52 16, 23 57 00, 23 64 xx, 23 65 00 |
| 08 | Vibration Isolation | 23 05 48 |
| 09 | Sleeves, Penetrations, Meters & Gauges | 23 05 17, 23 05 19 |
| 10 | Identification & Labeling *(piping rows)* | 23 05 53 |
| 11 | Testing, Flushing & Water Treatment | 23 21 13, 23 25 13, 23 25 16 |

**No steam on the TPA project** — no 23 22 xx sections exist. Drop steam and
condensate rows unless a future project has them.

**Spine colors:** HWS/HWR heating water = amber · CHWS/CHWR chilled water = blue ·
CWS/CWR condenser water = green · R refrigerant = gold · CD condensate = blue

---

## SHEET 3 — SHEET METAL & AIR DISTRIBUTION (Division 23, air trade)

**Banner:** `SHEET METAL & AIR DISTRIBUTION` / `FIELD CHEAT SHEET · DIVISION 23`

### Upload — Tier 1

`23 31 13` Metal Ducts · `23 33 00` Air Duct Accessories ·
`23 07 13` Duct Insulation · `23 37 13` Grilles, Registers and Diffusers ·
`23 36 00` Air Terminal Units · `23 34 23` HVAC Power Ventilators ·
`23 05 53` Identification · `23 51 00` Breechings, Chimneys and Stacks ·
`23 51 23` Gas Vents

### Upload — Tier 2

`23 05 29` Hangers and Support · `23 05 48` Vibration Controls ·
`23 05 93` Testing, Adjusting and Balancing · `23 73 13` Modular Indoor
Central-Station AHUs · `23 72 00` Air-to-Air Energy Recovery ·
`23 81 23` CRAC Units · `23 81 26` Split-System Air Conditioners ·
`23 82 19` Fan Coil Units

### Upload — Tier 3 (skim)

`23 00 10` Basic Mechanical Requirements · `23 01 01` LEED — duct sealant and
adhesive VOC limits land directly on this sheet

### Skip

`23 05 13` motors · `23 05 14` VFDs · `23 08 00` commissioning ·
`23 09 00` and `23 09 23` controls · all piping-only sections

### Section order

| Sec | Title | Spec sections |
|---|---|---|
| 01 | Duct Material & Gauge — by System & Pressure Class | 23 31 13 + SMACNA |
| 02 | Duct Construction — seams, joints, reinforcement, fittings | 23 31 13 + SMACNA |
| 03 | Duct Hangers & Supports | 23 31 13, 23 05 29 + SMACNA |
| 04 | Duct Insulation & Liner | 23 07 13 |
| 05 | Duct Accessories & Fire/Smoke Dampers | 23 33 00 + NFPA 90A |
| 06 | Fans & Power Ventilators | 23 34 23 |
| 07 | Air Terminal Units | 23 36 00 |
| 08 | Grilles, Registers & Diffusers | 23 37 13 |
| 09 | Equipment Setting & Air-Side Connections | 23 73 13, 23 72 00, 23 81 23, 23 81 26, 23 82 19, 23 05 48 |
| 10 | Breechings, Chimneys, Stacks & Gas Vents | 23 51 00, 23 51 23 |
| 11 | Identification & Labeling *(duct rows)* | 23 05 53 |
| 12 | Leakage Testing & Balancing | 23 05 93 + SMACNA leakage class |

**Where duct support actually lives.** On the TPA project `23 05 29` is titled
*Hangers and Support for HVAC Piping and Equipment* — piping and equipment, not
duct. Duct hanger and support requirements are therefore probably inside
`23 31 13`, or deferred to SMACNA. Check both before building §03, and log a GAP if
neither states them. Pull equipment support rows from `23 05 29`.

**Gauge tables are the core of this sheet.** Duct gauge by dimension and pressure
class is what both field and estimating reach for. Give it the most room and label
both axes explicitly — never inline `48"=18ga` strings in a single cell. Same fix
that was applied to the Division 22 hanger spacing table.

**Breechings, stacks and gas vents belong here, not on the piping sheet** — they are
fabricated sheet metal, not pipefitting, even though they serve the boilers.

**Spine colors:** SA supply = blue · RA return = green · EA exhaust = amber ·
OA outside air = charcoal · GEA/KEF grease and kitchen exhaust = gold ·
FLUE/vent = charcoal

---

## Sections that appear on both Division 23 sheets

| Section | Piping sheet carries | Sheet metal sheet carries |
|---|---|---|
| 23 05 29 hangers | rod size, spacing by pipe material and size | equipment support; duct support if stated here |
| 23 07 13 / 23 07 19 insulation | pipe insulation thickness by service and size | duct wrap and liner thickness by location |
| 23 05 53 identification | pipe label colors, valve tags, marker spacing | duct label requirements, marker spacing |
| 23 05 48 vibration | pipe and pump isolation | fan, AHU and equipment isolation |
| 23 05 93 testing | flow tolerances, test ports | duct leakage class, TAB requirements |

---

## Equipment setting

Where the contractor sets the major equipment (chillers, boilers, cooling towers,
AHUs) rather than only connecting it, the equipment sections carry real field
content: rigging and access routes, housekeeping pad requirements, service and code
clearances, isolation type and deflection, connection arrangement and orientation,
filter and coil pull space.

Put those requirements on the sheet whose trade makes the connection — piping
connections on Sheet 2, air-side connections and filter access on Sheet 3. Leave
performance data, capacities, and selection criteria off both; that is a submittal
concern, not a field one.
