/**
 * FSIMS domain constants — only region metadata is stored client-side.
 * All other reference data (provinces, cities, stations, categories,
 * occupancy, sectors, application types, FSIS issuance) is loaded from
 * the backend via locationAPI / stationAPI / gentableAPI.
 */

export const REGION_NAME = "MIMAROPA Region";
export const REGION_CODE = "Region IV-B";

/** MIMAROPA region GUID — used as parentcode for all PROVINCE location lookups. */
export const MIMAROPA_REGION_CODE = "a2f126b7-cb86-403a-906b-c41d63fc2e36";

export const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

/** Mode of issuance (`fsicmode`) of a Fire Code Fees collection line. */
export const FIRE_CODE_MODE_MANUAL = 96;
export const FIRE_CODE_MODE_FSIS = 97;

/**
 * FSIMS system identity. `systemno` is the authoritative key returned by the
 * Login API's `member.systemaccess[]`; `systemcode` is kept as a fallback for
 * older responses that omit systemno.
 */
export const FSIMS_SYSTEMNO = "52166724-25eb-4812-b3ea-0bdcbe14ed48";
export const FSIMS_SYSTEMCODE = "FSIMS";

/**
 * FSIMS role codes returned by the Login API.
 * roleno 1 = SUPER, 2 = ADMIN, 3 = PERSONNEL.
 */
export const SUPER = "SUPER";
export const ADMIN = "ADMIN";
export const PERSONNEL = "PERSONNEL";

export type Semester = "1" | "2";

export const MONTHS: { value: number; name: string; short: string }[] = [
  { value: 1, name: "January", short: "JAN" },
  { value: 2, name: "February", short: "FEB" },
  { value: 3, name: "March", short: "MAR" },
  { value: 4, name: "April", short: "APR" },
  { value: 5, name: "May", short: "MAY" },
  { value: 6, name: "June", short: "JUN" },
  { value: 7, name: "July", short: "JUL" },
  { value: 8, name: "August", short: "AUG" },
  { value: 9, name: "September", short: "SEP" },
  { value: 10, name: "October", short: "OCT" },
  { value: 11, name: "November", short: "NOV" },
  { value: 12, name: "December", short: "DEC" },
];

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
export const HALVES = ["1st Half", "2nd Half"] as const;

/* ------------------------------------------------------------------ */
/* Target Reference — GOVERNMENT SECTOR constants                     */
/* ------------------------------------------------------------------ */
/**
 * Permanent `sectorno` values from the backend GOVERNMENT SECTOR table.
 * These IDs are fixed and MUST be used across the entire Target Reference
 * module (Ledger, Matrix, Add/Edit form, Export, Preview, Reports).
 *
 * OGA (115) is intentionally excluded from Add/Edit forms.
 */
export const SECTOR_NO = {
  BPLO: 111,
  GOV: 112,
  PEZA: 113,
  TIEZA: 114,
} as const;

export type SectorKey = "bplo" | "gov" | "peza" | "tieza";

export interface SectorConstant {
  /** Backend `sectorno` — never changes. */
  detno: number;
  /** Backend `sectorcode`. */
  recordcode: "BPLO" | "GOV" | "PEZA" | "TIEZA";
  /** Display label. */
  description: string;
  /** UI bucket key used by helpers/matrix. */
  key: SectorKey;
  tablename: "GOVERNMENT SECTOR";
  sortorder: number;
}

/** Sectors shown in Target Reference Add/Edit (OGA excluded). */
export const SECTORS: SectorConstant[] = [
  {
    detno: SECTOR_NO.BPLO,
    recordcode: "BPLO",
    description: "BPLO",
    key: "bplo",
    tablename: "GOVERNMENT SECTOR",
    sortorder: 1,
  },
  {
    detno: SECTOR_NO.GOV,
    recordcode: "GOV",
    description: "GOVT",
    key: "gov",
    tablename: "GOVERNMENT SECTOR",
    sortorder: 2,
  },
  {
    detno: SECTOR_NO.PEZA,
    recordcode: "PEZA",
    description: "PEZA",
    key: "peza",
    tablename: "GOVERNMENT SECTOR",
    sortorder: 3,
  },
  {
    detno: SECTOR_NO.TIEZA,
    recordcode: "TIEZA",
    description: "TIEZA",
    key: "tieza",
    tablename: "GOVERNMENT SECTOR",
    sortorder: 4,
  },
];

/** Map backend `sectorcode` -> UI bucket key. Unknown codes return null. */
export function sectorKeyFromCode(code: string | undefined | null): SectorKey | null {
  const c = (code ?? "").toUpperCase().trim();
  if (c === "BPLO") return "bplo";
  if (c === "GOV" || c === "GOVERNMENT") return "gov";
  if (c === "PEZA") return "peza";
  if (c === "TIEZA") return "tieza";
  return null;
}

/** Map backend `sectorno` -> UI bucket key. Unknown numbers return null. */
export function sectorKeyFromNo(no: number | undefined | null): SectorKey | null {
  switch (Number(no)) {
    case SECTOR_NO.BPLO:
      return "bplo";
    case SECTOR_NO.GOV:
      return "gov";
    case SECTOR_NO.PEZA:
      return "peza";
    case SECTOR_NO.TIEZA:
      return "tieza";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Fire Code Fees — report column model                               */
/* ------------------------------------------------------------------ */
/**
 * Column model of the Summary Accomplishment Report on Fire Code Fees
 * Collection (BFP-QSF-FSED-052E Rev.01). Crown = the grouped header,
 * leaves = the individual amount columns underneath it.
 */

export interface FeeCol {
  key: string;
  label: string;
}

export interface FeeGroup {
  label: string;
  /** BFP account code printed under the crown on the paper form. */
  code?: string;
  cols: FeeCol[];
}

export const FEE_GROUPS: FeeGroup[] = [
  {
    label: "Fire Code Construction Tax",
    code: "628-BFP-01",
    cols: [{ key: "constructiontaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Realty Tax",
    code: "628-BFP-02",
    cols: [{ key: "realtytaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Premium Tax",
    code: "628-BFP-03",
    cols: [{ key: "premiumtaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Sales Tax",
    code: "628-BFP-04",
    cols: [{ key: "salestaxamount", label: "Amount" }],
  },
  {
    label: "Fire Code Proceeds Tax",
    code: "628-BFP-05",
    cols: [{ key: "proceedstaxamount", label: "Amount" }],
  },
  {
    label: "Fire Safety Inspection Fee",
    code: "628-BFP-06",
    cols: [
      { key: "fsifoccupancyamount", label: "Occupancy" },
      { key: "fsifbusinessamount", label: "Business" },
    ],
  },
  {
    label: "Storage Clearance Fee",
    code: "628-BFP-07",
    cols: [{ key: "storageclearanceamount", label: "Amount" }],
  },
  {
    label: "Conveyance Clearance Fee",
    code: "628-BFP-08",
    cols: [{ key: "conveyanceclearanceamount", label: "Amount" }],
  },
  {
    label: "Installation Clearance Fee",
    code: "628-BFP-09",
    cols: [
      { key: "installbseamount", label: "Building Service Equipment" },
      { key: "installafssamount", label: "AFSS" },
      { key: "installfdasamount", label: "FDAS" },
      { key: "installkhssamount", label: "KHSS" },
      { key: "installtankamount", label: "Flammable & Combustible Liquids Storage Tanks" },
      { key: "installlpgasamount", label: "LPGAS System" },
      { key: "installotheramount", label: "Other Installation Clearance" },
    ],
  },
  {
    label: "Fire Code Administrative Fines",
    code: "628-BFP-10",
    cols: [{ key: "adminfinesamount", label: "Amount" }],
  },
  {
    label: "Other Fees",
    code: "628-BFP-11-a",
    cols: [
      { key: "feefireworksamount", label: "Fireworks Display" },
      { key: "feeelectricalamount", label: "Electrical Installation" },
      { key: "feefilingfsecamount", label: "Filing Fees for FSEC" },
      { key: "feecertifiedcopyamount", label: "Certified True Copy" },
      { key: "feefumigationamount", label: "Fumigation / Fogging" },
      { key: "feefireincidentamount", label: "Fire Incident Clearance" },
      { key: "feeprotestamount", label: "Protest Fee" },
      { key: "feefiredrillamount", label: "Fire Drill" },
      { key: "feeappealamount", label: "Appeal Fee" },
      { key: "feeopenflameamount", label: "Open Flame" },
      { key: "feeseminaramount", label: "Fire Prevention & Safety Seminar" },
      { key: "feesoundstageamount", label: "Soundstage & Production Facilities" },
      { key: "feeweldingamount", label: "Welding, Cutting & Hotworks" },
      { key: "feeotheramount", label: "Other Fees" },
    ],
  },
  {
    label: "Certificate of Competency (COC) Fees",
    code: "628-BFP-11-b",
    cols: [{ key: "cocfeesamount", label: "Amount" }],
  },
];

/**
 * First `detno` of the backend "FIRE CODE FEES CATEGORY" gentable. The lookup
 * is contiguous and sorted 1..32, so column index + this base = `feecateg`.
 * The live `detno` values are still read from the API at runtime.
 */
export const FIRE_CODE_FEE_CATEG_BASE = 541;

/** One flat report column, carrying its fee category code (`feecateg`). */
export interface FeeColumn extends FeeCol {
  /** `feecateg` of this column (gentable `detno`). */
  categ: number;
  /** BFP account code of the crown this column sits under. */
  code: string;
  groupLabel: string;
}

/** Flat list of every report column, in report order. */
export const FEE_COLUMNS: FeeColumn[] = FEE_GROUPS.flatMap((g) =>
  g.cols.map((c) => ({
    key: c.key,
    label: c.label,
    code: g.code ?? "",
    groupLabel: g.label,
  })),
).map((c, i) => ({ ...c, categ: FIRE_CODE_FEE_CATEG_BASE + i }));

/** Fee category codes (`feecateg`) of every report column, in report order. */
export const FEE_CATEGS: number[] = FEE_COLUMNS.map((c) => c.categ);

export type FireCodeSectorKey = SectorKey;

/** The four establishment sectors of the report, in printed order. */
export const FEE_SECTORS: { key: FireCodeSectorKey; code: number; label: string; title: string }[] =
  [
    { key: "bplo", code: SECTOR_NO.BPLO, label: "BPLO", title: "BPLO (Business Establishments)" },
    { key: "gov", code: SECTOR_NO.GOV, label: "GOV", title: "GOV (Government Buildings)" },
    { key: "peza", code: SECTOR_NO.PEZA, label: "PEZA", title: "PEZA (PEZA Establishments)" },
    { key: "tieza", code: SECTOR_NO.TIEZA, label: "TIEZA", title: "TIEZA (Other Economic Zones)" },
  ];

/** Sector code (`sectorno`) → sector key of the report. */
export const SECTOR_BY_CODE = new Map<number, FireCodeSectorKey>(
  FEE_SECTORS.map((s) => [s.code, s.key]),
);

/** Modes of issuance shown as the two amount columns of every fee category. */
export const FIRE_CODE_MODES = [
  { code: FIRE_CODE_MODE_MANUAL, label: "MANUAL" },
  { code: FIRE_CODE_MODE_FSIS, label: "FSIS" },
] as const;

/**
 * `dateaccomplish` of a reporting month — the LAST day of that month, sent as
 * a plain local date-time string so no timezone conversion can shift the day.
 */
export function lastDayOfMonthISO(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00`;
}
