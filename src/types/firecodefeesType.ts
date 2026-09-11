/**
 * FSISFeeCollection contracts — field names match the API payload EXACTLY
 * (all lowercase, no aliasing and no mapping layer).
 */

/* ------------------------------------------------------------------ */
/* Create                                                             */
/* ------------------------------------------------------------------ */

export interface FSISFeeCollectionClassDTO {
  accomplishno: string;
  fsicmode: number;
  feecateg: number;
  collectedamount: number;
  sectorno: number;
}

export interface FSISFeeCollectionClass {
  feeno: string;
  /** Local date-time string, e.g. "2026-08-31T00:00:00". */
  dateaccomplish: string;
  isaccomplished: boolean;
  remarks: string;
  fsisfeecollectionList: FSISFeeCollectionClassDTO[];
}

export interface FSISFeeCollectionDTO {
  stationno: string;
  encodedby: string;
  fsisfeeList: FSISFeeCollectionClass[];
}

/* ------------------------------------------------------------------ */
/* Ledger request                                                     */
/* ------------------------------------------------------------------ */

export interface FSISFeeCollectionParamClass {
  Provinceno: string;
  Stationnos: string[];
}

export interface FSISFeeCollectionParams {
  Searchkey: string;
  Reportyear: number;
  Reportmonth: number[];
  Interval: number;
  Feeparentno: number[];
  Provinces: FSISFeeCollectionParamClass[];
}

export interface FSISFeeCollectionProvinceStationSelectionClass {
  Provinceno: string;
  Stationnos: string[];
}

export interface ExportFSISFeeCollectionDTO {
  Reportyear: number;
  Provinces: FSISFeeCollectionProvinceStationSelectionClass[];
}

/* ------------------------------------------------------------------ */
/* Detail / ledger response                                           */
/* ------------------------------------------------------------------ */

// Parameters specifically for detail endpoints (by year)
// Parameters specifically for detail-by-date endpoint (single month)
export interface FSISFeeCollectionDetailByDateParams {
  Stationno: string;
  Reportyear: number;
  Reportmonth: number;
  Feeparentno: number[];
}

export interface FSISFeeCollectionDetailParams {
  Stationno: string;
  Reportyear: number;
   Feeparentno: number[];
}

export interface FSISFeeCollectionLedgerParams {
  parameters?: FSISFeeCollectionParams;
  pagenumber?: number;
  pagesize?: number;
}

export interface FSISFeeAccomDetailModel {
  accomplishno: string;
  feeno: string;
  sectorno?: number;
  fsicmode: number;
  feecateg: number;
  Feeparentno: string;
  feeparentcode: string;
  Feeparentname: string;
  collectedamount: number;
}

export interface FSISFeeCollectionSectorDetailModel {
  sectorno: number;
  accomfeelist: FSISFeeAccomDetailModel[];
}

export interface FSISFeeCollectionDetailModel {
  feeno: string;
  stationno: string;
  dateaccomplish: string;
  sectorlist: FSISFeeCollectionSectorDetailModel[];
}

export interface FSISStationFeeDetailModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  feedetaillist: FSISFeeCollectionDetailModel[];
}

/* Delete */
export interface FSISFeeCollectionDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}
