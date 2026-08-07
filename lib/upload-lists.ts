export type DivisionId = 'plumbing' | 'sheetmetal' | 'hydronic';

export interface SpecSection {
  /** CSI number, space-separated, exactly as it appears in spec headers. */
  number: string;
  title: string;
}

export interface Division {
  id: DivisionId;
  /** Card label. */
  name: string;
  /** Goes in the banner .ptitle. */
  bannerTitle: string;
  /** Goes in the banner .psub after "FIELD CHEAT SHEET · ". */
  divisionLabel: string;
  /** Short form for the footer, e.g. "DIV 22". */
  divisionShort: string;
  blurb: string;
  icon: 'wrench' | 'fan' | 'pipe';
  /** Tier 1 — required before Generate unlocks. */
  tier1: SpecSection[];
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
    blurb: 'Domestic water, sanitary, storm, gas, fixtures',
    icon: 'wrench',
    tier1: [
      { number: '22 11 19', title: 'Domestic Water Piping' },
      { number: '22 13 16', title: 'Sanitary Waste and Vent Piping' },
      { number: '22 05 29', title: 'Hangers and Supports' },
      { number: '22 07 00', title: 'Plumbing Insulation' },
      { number: '22 05 23', title: 'General-Duty Valves' },
      { number: '22 40 00', title: 'Plumbing Fixtures' },
      { number: '22 05 53', title: 'Identification' },
      { number: '22 70 00', title: 'Natural Gas' },
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
