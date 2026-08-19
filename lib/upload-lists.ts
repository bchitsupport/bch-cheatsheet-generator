export type DivisionId = 'plumbing' | 'sheetmetal' | 'hydronic';

export interface SpecSection {
  /** CSI number, space-separated, exactly as it appears in spec headers. */
  number: string;
  title: string;
}

export interface OutlineSection {
  /** Goes in .sec-t, uppercase, exactly as written. */
  title: string;
  /** CSI numbers this section draws from — rendered into .sec-s. */
  sources: string[];
  /** What belongs here, so content lands in the same place every run. */
  covers: string;
}

export interface Division {
  id: DivisionId;
  /** Card label. */
  name: string;
  /** Goes in the banner .ptitle. */
  bannerTitle: string;
  /** Goes in the banner .psub after "CHEAT SHEET · ". */
  divisionLabel: string;
  /** Short form for the footer, e.g. "DIV 22". */
  divisionShort: string;
  blurb: string;
  icon: 'wrench' | 'fan' | 'pipe';
  /** Tier 1 — required before Generate unlocks. */
  tier1: SpecSection[];
  /**
   * The fixed sheet outline. Sections are numbered by position, so the same
   * division always produces the same sheet skeleton in the same order.
   *
   * Without this the model designed the outline from scratch on every run, and
   * two generations from identical PDFs came back with different section counts,
   * different titles, and content filed in different places. Exact wording still
   * varies run to run — current models have no temperature control, so that is
   * not fixable — but the structure no longer does, which is what makes two
   * sheets comparable and lets a fitter learn where things live.
   */
  outline: OutlineSection[];
  /** Sections commonly bundled with the division that the sheet does not use. */
  skip: { section: string; why: string }[];
}

export const DIVISIONS: Division[] = [
  {
    id: 'plumbing',
    name: 'PLUMBING',
    bannerTitle: 'PLUMBING',
    divisionLabel: 'DIVISION 22',
    divisionShort: 'DIV 22',
    blurb: 'Domestic water, sanitary, storm, fuel gas, medical gas, fixtures',
    icon: 'wrench',
    /**
     * Offices number Division 22 differently. Some put domestic water piping in
     * 22 11 19; others use 22 11 16 for the piping and 22 11 19 for specialties.
     * Both are listed so the pipe-material spec is primary either way — on the
     * Carrollwood CEP set, listing only 22 11 19 made the actual pipe-material
     * section (22 11 16) supporting and the sheet cited the wrong source.
     *
     * Fuel is likewise not always natural gas: a central energy plant may run
     * fuel oil instead. Both are primary; whichever the job has is the one the
     * sheet builds from.
     */
    tier1: [
      { number: '22 11 16', title: 'Domestic Water Piping' },
      { number: '22 11 19', title: 'Domestic Water Piping / Specialties' },
      { number: '22 13 16', title: 'Sanitary Waste and Vent Piping' },
      { number: '22 14 13', title: 'Storm Drainage Piping' },
      { number: '22 05 29', title: 'Hangers and Supports' },
      { number: '22 07 00', title: 'Plumbing Insulation' },
      { number: '22 05 23', title: 'General-Duty Valves' },
      { number: '22 40 00', title: 'Plumbing Fixtures' },
      { number: '22 05 53', title: 'Identification' },
      { number: '22 70 00', title: 'Natural Gas' },
      { number: '22 64 11', title: 'Facility Fuel Oil Piping' },
      // BCH self-performs medical gas, and on a healthcare job it is a large
      // part of the plumbing scope with rules that behave like nothing else in
      // the division. Numbering varies: 22 60 00 in some books, 22 61/62/63 in
      // others, so all the common forms are listed.
      { number: '22 60 00', title: 'Medical Gas Piping' },
      { number: '22 60 13', title: 'Medical Gas Startup and Certification' },
      { number: '22 61 00', title: 'Compressed Air — Healthcare' },
      { number: '22 62 19', title: 'Medical Vacuum Pumps' },
      { number: '22 63 00', title: 'Gas Systems for Healthcare' },
    ],
    // Mirrors the approved Division 22 sheet in assets/BCH-Cheat-Sheet-TEMPLATE.html.
    outline: [
      {
        title: 'PIPE MATERIAL — BY SYSTEM & LOCATION',
        sources: ['22 11 16', '22 11 19', '22 13 16', '22 14 13', '22 70 00', '22 64 11'],
        covers:
          'One row per system (CW, HW, HWR, S, V, ST, CD, GW, OW, G). Columns: above ground concealed, above ground exposed, below ground, notes. Colour spine per system. Cite the section that actually carries the material schedule on this job — the numbering varies by office.',
      },
      {
        title: 'JOINTS & CONNECTIONS',
        sources: ['22 11 16', '22 11 19', '22 13 16', '22 14 13'],
        covers: 'Per material: joint method and the requirements that govern it.',
      },
      {
        title: 'HANGER & SUPPORT MATRIX',
        sources: ['22 05 29'],
        covers:
          'Rod size by pipe size, max horizontal spacing, vertical support interval, per material. Plus copper isolation and fastener prohibitions.',
      },
      {
        title: 'INSULATION MATRIX',
        sources: ['22 07 00'],
        covers:
          'Service and location vs pipe material, size, thickness. Plus what gets insulated and fire ratings.',
      },
      {
        title: 'DRAINAGE — SLOPES, CLEANOUTS & DRAINS',
        sources: ['22 13 16', '22 14 13'],
        covers:
          'Minimum slopes by pipe size, cleanout placement rules, floor drains and backwater valves, underground utility separation. Cover sanitary and storm both, and say which rules differ between them.',
      },
      {
        title: 'VALVES & SPECIALTIES',
        sources: ['22 05 23', '22 11 19'],
        covers:
          'Valve schedule by size and type, backflow preventers, water hammer arresters, installation rules.',
      },
      {
        title: 'FIXTURES & MOUNTING HEIGHTS',
        sources: ['22 40 00'],
        covers: 'Mounting heights standard vs accessible, approved manufacturers.',
      },
      {
        title: 'FUEL SYSTEMS — GAS & FUEL OIL',
        sources: ['22 70 00', '22 64 11', '22 64 13'],
        covers:
          'Whichever fuel system this job actually has. Pipe material by pressure and location, valves, hanger spacing, pressure testing, and the fuel-specific prohibitions. Fuel oil adds tanks, pumps, containment and leak detection — cover those when the job has them. If the job has neither fuel system, say so in one line and keep the section to that line.',
      },
      {
        // Appended rather than slotted in beside the other piped systems: the
        // section numbers are positional, and moving them would relabel every
        // section on every sheet built so far.
        title: 'MEDICAL GAS & VACUUM',
        sources: ['22 60 00', '22 60 13', '22 61 00', '22 62 19', '22 63 00'],
        covers:
          'Medical gas, medical air and vacuum, which BCH self-performs. Tube type and temper by system and size (Type K/L to ASTM B819, cleaned and capped for oxygen service). Brazing: filler by joint, whether flux is permitted, and the nitrogen purge required while brazing. Support spacing where it differs from other copper. Valves, zone valve boxes, outlets and alarms. Installer and verifier certification (ASSE 6010 / 6015 / 6030). The verification sequence before a system may be used — initial pressure, standing pressure, cross-connection and purity — belongs here rather than in TESTING, because it is a gated sequence a system must pass in order, not a pressure test. Say plainly which requirements come from NFPA 99 rather than the spec. If the job has no medical gas, say so in one line and keep the section to that line.',
      },
      {
        title: 'IDENTIFICATION & LABELING',
        sources: ['22 05 53'],
        covers:
          'Pipe label colours, label spacing, valve tags, underground warning tape colour code. Cover every system on this sheet, including fuel and medical gas.',
      },
      {
        title: 'TESTING & STERILIZATION',
        sources: ['22 11 16', '22 11 19', '22 13 16', '22 14 13', '22 70 00', '22 64 11'],
        covers:
          'Test medium, pressure or head, duration, acceptance, and sequencing, for every system on this sheet including fuel. Medical gas verification is not repeated here — it lives in its own section.',
      },
    ],
    skip: [
      {
        section: '22 05 00 Common Work Results for Plumbing',
        why: 'Administrative boilerplate — submittals, coordination, closeout. Nothing a fitter installs.',
      },
      {
        section: '22 05 19 Meters and Gages',
        why: 'Instrumentation schedule; carried on the drawings, not needed for takeoff or install.',
      },
      {
        section: '22 08 00 / 22 05 93 Commissioning & Testing Procedures',
        why: 'Process documents. The test pressures and durations that matter already live in the piping sections.',
      },
      {
        section: '22 30 00 Plumbing Equipment',
        why: 'Water heaters and pumps are scheduled on the drawings — upload only if the schedule is missing.',
      },
    ],
  },
  {
    id: 'sheetmetal',
    name: 'SHEET METAL & AIR DISTRIBUTION',
    bannerTitle: 'SHEET METAL & AIR DISTRIBUTION',
    divisionLabel: 'DIVISION 23',
    divisionShort: 'DIV 23',
    blurb: 'Ducts, accessories, diffusers, terminal units, vents',
    icon: 'fan',
    tier1: [
      { number: '23 31 13', title: 'Metal Ducts' },
      { number: '23 33 00', title: 'Air Duct Accessories' },
      { number: '23 07 13', title: 'Duct Insulation' },
      { number: '23 37 13', title: 'Grilles, Registers and Diffusers' },
      { number: '23 36 00', title: 'Air Terminal Units' },
      { number: '23 34 23', title: 'HVAC Power Ventilators' },
      { number: '23 05 53', title: 'Identification for HVAC' },
      { number: '23 51 00', title: 'Breechings, Chimneys and Stacks' },
      { number: '23 51 23', title: 'Gas Vents' },
      { number: '23 05 48', title: 'Vibration Controls' },
      // Measured on the Carrollwood CEP set: as supporting sections these never
      // reached the sheet. FIELD TESTING cited only the duct spec while the
      // 48,000-character TAB section went uncited, and the fan section was built
      // without the fan spec. They belong to the air side and drive real
      // sections of the outline, so they are primary.
      { number: '23 05 93', title: 'Testing, Adjusting and Balancing' },
      { number: '23 34 16', title: 'Centrifugal HVAC Fans' },
    ],
    outline: [
      {
        title: 'DUCT MATERIALS & CONSTRUCTION',
        sources: ['23 31 13'],
        covers:
          'Material vs governing standard vs coating/finish vs where used. Double-wall construction. Any size thresholds the spec states in its own words.',
      },
      {
        title: 'JOINTS, SEAMS & SEALANTS',
        sources: ['23 31 13'],
        covers:
          'Sealant and gasket types with pressure class, service temp and notes. State the SMACNA deferral once in a callout — never a table of figure numbers.',
      },
      {
        title: 'DUCT PRESSURE, SEAL & LEAKAGE CLASS SCHEDULE',
        sources: ['23 31 13'],
        covers:
          'Service and connection vs pressure class, seal class, leakage class. Flag any conflict between a seal-class matrix and the duct schedule.',
      },
      {
        title: 'HANGERS & SUPPORTS',
        sources: ['23 31 13', '23 33 00', '23 36 00'],
        covers:
          'Hanger rod material by environment, spacing rules, vertical support, building attachment, flex duct support.',
      },
      {
        title: 'VIBRATION ISOLATION',
        sources: ['23 05 48'],
        covers:
          'Equipment isolator schedule, isolator type legend, connection isolation, corrosion protection.',
      },
      {
        title: 'DUCT INSULATION',
        sources: ['23 07 13'],
        covers:
          'Location and service vs insulation type and thickness/density. Surface burning. Pin spacing and vapour stops. What is not insulated.',
      },
      {
        title: 'AIR DUCT ACCESSORIES — DAMPERS',
        sources: ['23 33 00'],
        covers:
          'Damper type vs frame/blade construction, ratings, leakage class. Damper-to-duct material matching rule.',
      },
      {
        title: 'FLEX DUCT, CONNECTORS, TURNING VANES & ACCESS DOORS',
        sources: ['23 33 00'],
        covers:
          'Flex duct limits, connector fabric, turning vanes, access door size by function, hinge/lock count, access door locations.',
      },
      {
        title: 'AIR TERMINAL UNITS',
        sources: ['23 36 00'],
        covers:
          'Casing, liner, volume damper, hydronic coil, actuator, operating range, connections, labelling. If no terminal-unit section was issued for this job, say so in one line and keep the section to that line.',
      },
      {
        title: 'HVAC POWER VENTILATORS & FANS',
        sources: ['23 34 23', '23 34 16'],
        covers:
          'Fan type vs housing/wheel vs drive vs notes, covering both power ventilators and any separately specified centrifugal fans. Mounting, vibration isolation base, and field QC.',
      },
      {
        title: 'GRILLES, REGISTERS & DIFFUSERS',
        sources: ['23 37 13'],
        covers: 'Type vs material/finish vs face style vs mounting.',
      },
      {
        title: 'BREECHINGS, CHIMNEYS, STACKS & GAS VENTS',
        sources: ['23 51 00', '23 51 23'],
        covers:
          'Material and construction, clearances and termination, slope and drainage, sealant by flue-gas temperature. If neither section was issued for this job, say so in one line and keep the section to that line — do not pad it from insulation or duct sections.',
      },
      {
        title: 'IDENTIFICATION & LABELING',
        sources: ['23 05 53'],
        covers:
          'Label type vs spec, pipe/duct label colours, placement and spacing rules, valve tags.',
      },
      {
        title: 'FIELD TESTING & BALANCING',
        sources: ['23 31 13', '23 05 93'],
        covers:
          'Duct leakage test percentages by category, test method and sequencing, cleanliness and fan field checks. Plus the TAB requirements the sheet metal crew has to build for: tolerances on measured vs design airflow, required test ports and access, damper positions at balance, and what must be complete before balancing starts.',
      },
    ],
    skip: [
      {
        section: '23 05 00 Common Work Results for HVAC',
        why: 'Administrative boilerplate. Nothing that changes a duct fitting or a hanger.',
      },
      {
        section: '23 05 93 Testing, Adjusting and Balancing',
        why: 'TAB scope belongs to the balancing contractor; the duct sections carry the leakage classes you install to.',
      },
      {
        section: '23 09 00 Instrumentation and Control',
        why: 'Controls scope. Damper actuators appear in 23 33 00 where they affect the install.',
      },
      {
        section: '23 40 00 HVAC Air Cleaning Devices',
        why: 'Filter media schedule — carried on the equipment schedules, not a sheet-metal decision.',
      },
    ],
  },
  {
    id: 'hydronic',
    name: 'HYDRONIC & MECHANICAL PIPING',
    bannerTitle: 'HYDRONIC & MECHANICAL PIPING',
    divisionLabel: 'DIVISION 23',
    divisionShort: 'DIV 23',
    blurb: 'Chilled/hot water, specialties, valves, refrigerant',
    icon: 'pipe',
    tier1: [
      { number: '23 21 13', title: 'Hydronic Piping' },
      { number: '23 21 13.13', title: 'Underground Hydronic Piping' },
      { number: '23 21 16', title: 'Hydronic Piping Specialties' },
      { number: '23 05 23', title: 'General-Duty Valves for HVAC' },
      { number: '23 05 29', title: 'Hangers and Supports for HVAC' },
      { number: '23 07 19', title: 'HVAC Piping Insulation' },
      { number: '23 05 53', title: 'Identification for HVAC' },
      { number: '23 23 00', title: 'Refrigerant Piping' },
      // Measured on the Carrollwood CEP set: as supporting sections these never
      // reached the sheet. The outline has a section titled CHEMICAL TREATMENT
      // that cited only the piping spec while the 42,000-character water
      // treatment section went uncited. Pumps set the connection, strainer and
      // isolation requirements the pipe fitter actually builds to.
      { number: '23 25 00', title: 'HVAC Water Treatment' },
      { number: '23 21 23', title: 'Hydronic Pumps' },
    ],
    outline: [
      {
        title: 'PIPE MATERIAL — BY SYSTEM & SIZE',
        sources: ['23 21 13', '23 23 00'],
        covers:
          'One row per system (CHWS/R, HWS/R, CWS/R, refrigerant, condensate). Material by size range, above and below ground. Colour spine per system.',
      },
      {
        title: 'JOINTS & CONNECTIONS',
        sources: ['23 21 13', '23 23 00'],
        covers:
          'Per material: joint method, size thresholds that change it, and requirements. Dielectric isolation at dissimilar metals.',
      },
      {
        title: 'HANGER & SUPPORT MATRIX',
        sources: ['23 05 29'],
        covers:
          'Rod size by pipe size, max horizontal spacing, vertical support interval, per material. Insulated pipe shields and copper isolation.',
      },
      {
        title: 'INSULATION MATRIX',
        sources: ['23 07 19'],
        covers:
          'Service vs pipe size vs thickness. Jacketing, vapour barrier, and what is left uninsulated.',
      },
      {
        title: 'VALVES — GENERAL DUTY',
        sources: ['23 05 23'],
        covers:
          'Valve schedule by size, type, body material and class. Installation orientation and isolation rules.',
      },
      {
        title: 'HYDRONIC SPECIALTIES',
        sources: ['23 21 16'],
        covers:
          'Air separators, expansion tanks, strainers, balancing valves, gauges and thermometers — with placement rules.',
      },
      {
        title: 'UNDERGROUND HYDRONIC PIPING',
        sources: ['23 21 13.13'],
        covers:
          'Carrier and casing, insulation, burial depth, warning tape, thrust and anchoring, leak detection.',
      },
      {
        title: 'REFRIGERANT PIPING',
        sources: ['23 23 00'],
        covers:
          'Tube type and temper, joints, line sizing constraints, supports, and required accessories. If no refrigerant piping section was issued for this job, say so in one line and keep the section to that line.',
      },
      {
        title: 'IDENTIFICATION & LABELING',
        sources: ['23 05 53'],
        covers:
          'Pipe label colours and spacing, valve tags, equipment labels, underground warning tape.',
      },
      {
        title: 'TESTING, FLUSHING & CHEMICAL TREATMENT',
        sources: ['23 21 13', '23 23 00', '23 25 00'],
        covers:
          'Test medium, pressure, duration and acceptance per system. Flushing and cleaning sequence before insulation. Then the chemical treatment the fitter has to accommodate: cleaning and passivation sequence, who charges the system and when, and the pot feeders, test ports, coupon racks and isolation the piping must include.',
      },
    ],
    skip: [
      {
        section: '23 05 00 Common Work Results for HVAC',
        why: 'Administrative boilerplate.',
      },
      {
        section: '23 25 00 HVAC Water Treatment',
        why: 'Chemical treatment scope. Does not change pipe, fitting, or hanger selection.',
      },
      {
        section: '23 21 23 Hydronic Pumps',
        why: 'Pumps are scheduled on the drawings; the piping specialties section covers the connection details.',
      },
      {
        section: '23 64 00 / 23 65 00 Chillers & Cooling Towers',
        why: 'Equipment sections. Upload only if you need connection sizes not shown on the schedules.',
      },
    ],
  },
];

export function getDivision(id: DivisionId): Division {
  const d = DIVISIONS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown division: ${id}`);
  return d;
}

export function isDivisionId(v: unknown): v is DivisionId {
  return typeof v === 'string' && DIVISIONS.some((d) => d.id === v);
}
