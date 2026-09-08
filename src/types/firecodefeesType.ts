/* -------------------------------------------------------------------------
 * Fire Code Fees Collection — Summary Accomplishment Report (BFP-QSF-FSED-052E)
 *
 * Mirrors the Fire Safety Compliance contract so the collection module can
 * reuse the same ledger / filter / export plumbing. Amounts are pesos.
 * ---------------------------------------------------------------------- */

/** Establishment sector groups of the FSED Form 5/5 report. */
export type FireCodeSectorKey = "bplo" | "gov" | "peza" | "tieza";

/** Backend sector codes: 1 Business (BPLO), 2 Government, 3 PEZA, 4 Other Economic Zones (TIEZA). */
export const FIRE_CODE_SECTOR_CODE: Record<FireCodeSectorKey, number> = {
  bplo: 1,
  gov: 2,
  peza: 3,
  tieza: 4,
};

/** Mode of issuance codes shared with the compliance module. 96 = MANUAL, 97 = FSIC. */
export const FIRE_CODE_MODE_MANUAL = 96;
export const FIRE_CODE_MODE_FSIC = 97;

/** Every collectible amount column of the report (one leaf per Excel column). */
export interface FireCodeFeeAmounts {
  constructiontaxamount: number;
  realtytaxamount: number;
  premiumtaxamount: number;
  salestaxamount: number;
  proceedstaxamount: number;

  fsifoccupancyamount: number;
  fsifbusinessamount: number;

  storageclearanceamount: number;
  conveyanceclearanceamount: number;

  installbseamount: number;
  installafssamount: number;
  installfdasamount: number;
  installkhssamount: number;
  installtankamount: number;
  installlpgasamount: number;
  installotheramount: number;

  adminfinesamount: number;

  feefireworksamount: number;
  feeelectricalamount: number;
  feefilingfsecamount: number;
  feecertifiedcopyamount: number;
  feefumigationamount: number;
  feefireincidentamount: number;
  feeprotestamount: number;
  feefiredrillamount: number;
  feeappealamount: number;
  feeopenflameamount: number;
  feeseminaramount: number;
  feesoundstageamount: number;
  feeweldingamount: number;
  feeotheramount: number;

  cocfeesamount: number;
}

/** One collected line: a sector + mode of issuance pair with its amounts. */
export interface FireCodeFeeItemClass extends Partial<FireCodeFeeAmounts> {
  itemno?: string;
  /** 1 BPLO, 2 GOV, 3 PEZA, 4 TIEZA. */
  sector: number;
  /** 96 MANUAL, 97 FSIC. */
  fsicmode: number;
}

/** One collection day of a station. */
export interface FireCodeFeeClassModel extends Partial<FireCodeFeeAmounts> {
  feeno: string;
  datecollected: string | Date;
  remarks?: string;
  /** Sector/mode breakdown for the day. */
  feelist: FireCodeFeeItemClass[];
}

/** Station wrapper returned by the ledger endpoint. */
export interface FireCodeFeeModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname?: string;
  logourl: string;
  collectionlist: FireCodeFeeClassModel[];
}

export interface FireCodeFeeParamClass {
  provinceno: string;
  stationnos: string[];
}

export interface FireCodeFeeParams {
  searchkey: string;
  reportyear: number;
  /** 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual. */
  interval: number;
  targetdate: string;
  reportmonth: number[];
  provinces: FireCodeFeeParamClass[];
}

export interface FireCodeFeeLedgerParams {
  parameters?: FireCodeFeeParams;
  pagenumber?: number;
  pagesize?: number;
}

export interface FireCodeFeeDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}

/** UI row: one station for the whole selected period. */
export interface FireCodeFeeLedgerRow {
  key: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logoUrl: string;
  year: number;
  month: number;
  /** Grand total collected across every sector and mode. */
  grandTotal: number;
  /** Sector key -> collected total. */
  sectorTotals: Record<FireCodeSectorKey, number>;
  lastupdated: string;
  records: FireCodeFeeClassModel[];
}
