/**
 * FSIS Inventory — DTOs and view models for the Monthly Monitoring workflow.
 *
 * DB reality: `tblfsisinventory` stores one row per (station, date). The UI,
 * however, is organized by (station, month, year). All monthly / quarterly /
 * semester / annual / province totals are computed on the fly — never stored.
 */

/** Single daily record — 1:1 with a row in `tblfsisinventory`. */
export interface DailyInventoryDTO {
  inventoryno: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  cityno: string;
  cityname: string;
  provinceno: string;
  provincename: string;
  /** ISO date `yyyy-mm-dd`. */
  dateinspected: string;

  // Inspection
  insp_during: number;
  insp_after: number;
  insp_bplo: number;
  insp_gov: number;
  insp_peza: number;
  insp_tieza: number;

  // FSEC
  fsec_building: number;
  fsec_gov: number;
  fsec_peza: number;
  fsec_tieza: number;

  // FSIC
  fsic_occupancy: number;
  fsic_bplo_new: number;
  fsic_bplo_renewal: number;
  fsic_gov: number;
  fsic_peza: number;
  fsic_tieza: number;

  // Notices
  not_nod: number;
  not_ntc: number;
  not_ntcv: number;
  not_abatement: number;
  not_closure: number;

  remarks: string;
  encodedby: string;
  encodedbyname: string;
  lastupdated: string; // ISO
  deletedat: string | null;
}

/** Field group keys per category (used by matrix / editor / view). */
export type InventoryCategory =
  | "INSPECTION"
  | "FSEC"
  | "FSIC"
  | "NOTICES"
  | "OVERALL";

/** Aggregated bucket totals across every field in one category. */
export interface CategoryBucket {
  inspection: number;
  fsec: number;
  fsic: number;
  notices: number;
}

export interface MonthlyInventoryRowBreakdown {
  inspection: Record<string, number>;
  fsec: Record<string, number>;
  fsic: Record<string, number>;
  notices: Record<string, number>;
}

/** One row in the Monthly Inventory Ledger. */
export interface MonthlyInventoryRow {
  key: string; // `${stationno}|${year}|${month}`
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logoUrl?: string;
  year: number;
  month: number;
  daysEncoded: number;
  daysInMonth: number;
  totals: CategoryBucket;
  breakdown: MonthlyInventoryRowBreakdown;
  lastupdated: string;
}

/** Search / filter parameters. */
export interface InventorySearchParams {
  year: number;
  month?: number | null;
  provinceno?: string;
  stationno?: string;
  searchkey?: string;
}

/** Save payload for the daily encode form. */
export type DailyInventoryUpsertDTO = Omit<
  DailyInventoryDTO,
  "inventoryno" | "lastupdated" | "deletedat"
>;

/** Matrix row: one station within a province, keyed by month. */
export interface MatrixStationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  logoUrl: string;
  /** Per-month field bucket keyed by month (1-12). */
  months: Record<number, Record<string, number>>;
}

export interface MatrixProvinceGroup {
  province: string;
  provinceno: string;
  stations: MatrixStationRow[];
  provincialTotal: Record<number, Record<string, number>>;
}

/** Envelope-shaped mock response so replacing this layer with `apiGet`
 *  requires zero UI changes.  Mirrors `unwrap<T>` in `@/lib/api-envelope`. */
export interface MockApiResponse<T> {
  data: {
    statusCode: number;
    isSuccess: boolean;
    errorMessages: string;
    draw: number;
    recordsTotal: number;
    recordsFiltered: number;
    pageNumber: number;
    pageSize: number;
    totalPages: number;
    data: T;
  };
}