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
  OGA: 115,
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
  { detno: SECTOR_NO.BPLO,  recordcode: "BPLO",  description: "BPLO",  key: "bplo",  tablename: "GOVERNMENT SECTOR", sortorder: 1 },
  { detno: SECTOR_NO.GOV,   recordcode: "GOV",   description: "GOVT",  key: "gov",   tablename: "GOVERNMENT SECTOR", sortorder: 2 },
  { detno: SECTOR_NO.PEZA,  recordcode: "PEZA",  description: "PEZA",  key: "peza",  tablename: "GOVERNMENT SECTOR", sortorder: 3 },
  { detno: SECTOR_NO.TIEZA, recordcode: "TIEZA", description: "TIEZA", key: "tieza", tablename: "GOVERNMENT SECTOR", sortorder: 4 },
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
    case SECTOR_NO.BPLO:  return "bplo";
    case SECTOR_NO.GOV:   return "gov";
    case SECTOR_NO.PEZA:  return "peza";
    case SECTOR_NO.TIEZA: return "tieza";
    default: return null;
  }
}


