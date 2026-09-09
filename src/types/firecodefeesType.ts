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
  provinceno: string;
  stationnos: string[];
}

export interface FSISFeeCollectionParams {
  searchkey: string;
  reportyear: number;
  reportmonth: number[];
  interval: number;
  provinces: FSISFeeCollectionParamClass[];
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

export interface FSISFeeCollectionDetailByDateParams {
  Stationno: string;
  Reportyear: number;
  Reportmonth: number;
}

export interface FSISFeeCollectionDetailParams {
  Stationno: string;
  Reportyear: number;
}

export interface FSISFeeCollectionLedgerParams {
  parameters?: FSISFeeCollectionParams;
  pagenumber?: number;
  pagesize?: number;
}

export interface FSISFeeAccomDetailModel {
  accomplishno: string;
  feeno: string;
  fsicmode: number;
  feecateg: number;
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
