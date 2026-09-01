//Target Accomplishment
export interface FSISComplianceTargetAccomParams {
  stationno: string;
  dateinspected: string;
}

export interface TargetAccomplishmentModel {
  stationno: string;
  dateinspected?: string; // ISO date string
  /** Present when the summary is derived for a whole month instead of one day. */
  month?: number;
  year?: number;
  totaltargetbplo: number;
  totaltargetgov: number;
  totaltargetpeza: number;
  totaltargettieza: number;
  totalAccomplishmentbplo: number;
  totalAccomplishmentgov: number;
  totalAccomplishmentpeza: number;
  totalAccomplishmenttieza: number;
}

// Create/Update
export interface FSISComplianceDTO {
  stationno: string;
  encodedby: string;
  compliancelist: FSISComplianceClass[];
}

export interface FSISComplianceClass {
  fsisno: string;
  dateinspected: string; // ISO Date string
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  reinspectbplocount: number;
  reinspectoccupancycount?: number;
  reinspectgovcount: number;
  reinspectpezacount: number;
  reinspecttiezacount: number;
  isaccomplished: boolean;
  remarks: string;
  issuancelist: FSISIssuanceClassDTO[];
}

export interface FSISIssuanceClassDTO {
  issuanceno: string;
  fsicmode: number;
  fsecbuildingcount: number;
  fsecgovcount: number;
  fsecpezacount: number;
  fsectiezacount: number;
  fsicoccupancycount: number;
  fsicbplonewcount: number;
  fsicbplorenewcount: number;
  fsicgovcount: number;
  fsicpezacount: number;
  fsictiezacount: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
  closedcount: number;
  refsicoccupancycount: number;
  refsicbplonewcount: number;
  refsicbplorenewcount: number;
  refsicgovcount: number;
  refsicpezacount: number;
  refsictiezacount: number;
  rentcvcount: number;
  reabatementcount: number;
  reclosurecount: number;
}

// Detail Models
export interface FSISComplianceDetailParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
}

export interface FSISIssuanceDetailClassModel {
  issuanceno: string;
  fsicmode: number;
  fsecbuildingcount: number;
  fsecgovcount: number;
  fsecpezacount: number;
  fsectiezacount: number;
  fsicoccupancycount: number;
  fsicbplonewcount: number;
  fsicbplorenewcount: number;
  fsicgovcount: number;
  fsicpezacount: number;
  fsictiezacount: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
  closedcount: number;
  refsicoccupancycount?: number;
  refsicbplonewcount?: number;
  refsicbplorenewcount?: number;
  refsicgovcount?: number;
  refsicpezacount?: number;
  refsictiezacount?: number;
  rentcvcount?: number;
  reabatementcount?: number;
  reclosurecount?: number;
}

//Detail by Date
export interface FSISComplianceDetailByDateParams {
  stationno: string;
  dateinspected: string;
}

export interface FSISComplianceDetailByDateClassModel {
  fsisno: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  reinspectbplocount?: number;
  reinspectoccupancycount?: number;
  reinspectgovcount?: number;
  reinspectpezacount?: number;
  reinspecttiezacount?: number;
  isrevisionrequest: boolean;
  editablestatus: number;
  remarks: string;
  dateinspected: string;
  issuancelist: FSISIssuanceDetailClassModel[];
}

export interface FSISComplianceDetailByDateModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  dailytargetbplo: number;
  dailytargetgov: number;
  dailytargetpeza: number;
  dailytargettieza: number;
  compliancelist: FSISComplianceDetailByDateClassModel[];
}

export interface FSISComplianceDetailClassModel {
  fsisno: string;
  dailytargetbplo: number;
  dailytargetgov: number;
  dailytargetpeza: number;
  dailytargettieza: number;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  reinspectbplocount?: number;
  reinspectoccupancycount?: number;
  reinspectgovcount?: number;
  reinspectpezacount?: number;
  reinspecttiezacount?: number;
  isrevisionrequest: boolean;
  editablestatus: number;
  remarks: string;
  dateinspected: string;
  issuancelist: FSISIssuanceDetailClassModel[];
}

export interface FSISComplianceDetailModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname?: string;
  logourl: string;
  compliancelist: FSISComplianceDetailClassModel[];
}

// Ledger Models
export interface FSISComplianceLedgerParams {
  parameters?: FSISComplianceParams;
  pagenumber?: number;
  pagesize?: number;
}

export interface FSISComplianceParams {
  searchkey: string;
  reportyear: number;
  interval: number; // 1 Daily, 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual
  targetdate: string;
  dateinspected?: string;
  reportmonth: number[];
  provinces: FSISComplianceParamClass[];
}

export interface FSISComplianceParamClass {
  provinceno: string;
  stationnos: string[];
}

export interface FSISComplianceModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname?: string;
  logourl: string;
  compliancelist: FSISComplianceClassModel[];
}

export interface FSISComplianceClassModel {
  fsisno: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  dailytargetbplo: number;
  dailytargetgov: number;
  dailytargetpeza: number;
  dailytargettieza: number;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  reinspectoccupancycount?: number;
  reinspectbplocount?: number;
  reinspectgovcount?: number;
  reinspectpezacount?: number;
  reinspecttiezacount?: number;
  remarks: string;
  dateinspected: string; // ISO Date string
  issuancelist: FSISIssuanceClassModel[];
}

export interface FSISIssuanceClassModel {
  issuanceno: string;
  fsisno?: string;
  encodedby?: string;
  dateencoded?: string | Date;
  fsicmode: number;
  fsecbuildingcount: number;
  fsecgovcount: number;
  fsecpezacount: number;
  fsectiezacount: number;
  fsicoccupancycount: number;
  fsicbplonewcount: number;
  fsicbplorenewcount: number;
  fsicgovcount: number;
  fsicpezacount: number;
  fsictiezacount: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
  closedcount: number;
  refsicoccupancycount?: number;
  refsicbplonewcount?: number;
  refsicbplorenewcount?: number;
  refsicgovcount?: number;
  refsicpezacount?: number;
  refsictiezacount?: number;
  rentcvcount?: number;
  reabatementcount?: number;
  reclosurecount?: number;
}

//Delete
export interface FSISComplianceDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}

//Export
export interface ProvinceIssuanceExportModel {
  provinceno: string;
  provincename: string;
  stations: FSISComplianceModel[];
}

export interface ExportFSISComplianceRequestDTO {
  searchkey: string;
  reportyear: number;
  provinces: FSISComplianceProvinceStationSelectionClass[];
}

export interface FSISComplianceProvinceStationSelectionClass {
  provinceno: string;
  stationnos: string[];
}

/* -------------------------------------------------------------------------- */
/*  Derived / UI-facing compliance shapes                                     */
/*  (single source of truth — nothing outside this file defines these)        */
/* -------------------------------------------------------------------------- */

/** Category tabs shared by the ledger, matrix and report screens. */
export type ComplianceCategoryKey = "INSPECTION" | "FSEC" | "FSIC" | "NOTICES" | "OVERALL";

/** One flat compliance day row (API count keys + flattened issuance counts). */
export interface FSISComplianceLedgerClass {
  fsisno: string;
  dateinspected: string | Date;
  remarks: string;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

  reinspectoccupancycount?: number;
  reinspectbplocount?: number;
  reinspectgovcount?: number;
  reinspectpezacount?: number;
  reinspecttiezacount?: number;

  dailytargetbplo: number;
  dailytargetgov: number;
  dailytargetpeza: number;
  dailytargettieza: number;

  isrevisionrequest?: boolean;
  editablestatus?: number;

  issuancelist: FSISIssuanceClassModel[];

  fsecbuildingcount?: number;
  fsecgovcount?: number;
  fsecpezacount?: number;
  fsectiezacount?: number;
  fsicoccupancycount?: number;
  fsicbplonewcount?: number;
  fsicbplorenewcount?: number;
  fsicgovcount?: number;
  fsicpezacount?: number;
  fsictiezacount?: number;
  nodcount?: number;
  ntccount?: number;
  ntcvcount?: number;
  abatementcount?: number;
  closurecount?: number;
  refsicoccupancycount?: number;
  refsicbplonewcount?: number;
  refsicbplorenewcount?: number;
  refsicgovcount?: number;
  refsicpezacount?: number;
  refsictiezacount?: number;
  rentcvcount?: number;
  reabatementcount?: number;
  reclosurecount?: number;
}

/** Alias kept for the monthly ledger screens. */
export type FSISComplianceDailyClass = FSISComplianceLedgerClass;

/** Station-month wrapper for the compliance ledger UI. */
export interface FSISComplianceMonthlyLedgerModel {
  stationno: string;
  stationcode: string;
  stationname: string;

  regionno: string;
  regioncode: string;
  regionname: string;

  provinceno: string;
  provincename: string;

  cityno: string;
  zipcode: string;
  cityname: string;

  barangayno: string;
  barangayname: string;

  streetaddress: string;
  logourl: string;

  month: number;
  year: number;

  totaltargetbplo: number;
  totaltargetgov: number;
  totaltargetpeza: number;
  totaltargettieza: number;

  totalAccomplishmentbplo: number;
  totalAccomplishmentgov: number;
  totalAccomplishmentpeza: number;
  totalAccomplishmenttieza: number;

  updatedby: string;
  encodedby: string;

  complianceLedgerList: (FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>)[];
}

/** UI-key daily counts used by the ledger / matrix presentation layer. */
export interface ComplianceDailyCounts {
  complianceNo?: string;
  fsisno?: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  cityno: string;
  cityname: string;
  provinceno: string;
  provincename: string;
  dateinspected: string;

  dailytargetbplo?: number;
  dailytargetgov?: number;
  dailytargetpeza?: number;
  dailytargettieza?: number;

  inspectduringcount?: number;
  inspectaftercount?: number;
  inspectbplocount?: number;
  inspectgovcount?: number;
  inspectpezacount?: number;
  inspecttiezacount?: number;

  reinspectbplocount?: number;
  reinspectgovcount?: number;
  reinspectpezacount?: number;
  reinspecttiezacount?: number;

  insp_during: number;
  insp_after: number;
  insp_bplo: number;
  insp_gov: number;
  insp_peza: number;
  insp_tieza: number;

  fsec_building: number;
  fsec_gov: number;
  fsec_peza: number;
  fsec_tieza: number;

  fsic_occupancy: number;
  fsic_bplo_new: number;
  fsic_bplo_renewal: number;
  fsic_gov: number;
  fsic_peza: number;
  fsic_tieza: number;

  not_nod: number;
  not_ntc: number;
  not_ntcv: number;
  not_abatement: number;
  not_closure: number;

  reinsp_bplo?: number;
  reinsp_gov?: number;
  reinsp_peza?: number;
  reinsp_tieza?: number;

  refsic_occupancy?: number;
  refsic_bplo_new?: number;
  refsic_bplo_renewal?: number;
  refsic_gov?: number;
  refsic_peza?: number;
  refsic_tieza?: number;

  renot_ntcv?: number;
  renot_abatement?: number;
  renot_closure?: number;

  remarks: string;
  encodedby: string;
  encodedbyname: string;
  lastupdated: string;
  deletedat: string | null;
}

export interface ComplianceCategoryBucket {
  inspection: number;
  fsec: number;
  fsic: number;
  notices: number;
}

/** One station-month card row on the compliance ledger. */
export interface ComplianceMonthlyRow {
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
  daysEncoded: number;
  daysInMonth: number;
  totals: ComplianceCategoryBucket;
  breakdown: {
    inspection: Record<string, number>;
    fsec: Record<string, number>;
    fsic: Record<string, number>;
    notices: Record<string, number>;
  };
  lastupdated: string;
}

export interface ComplianceMatrixStationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  logoUrl: string;
  /** month (1-12) -> field key -> value */
  months: Record<number, Record<string, number>>;
}

export interface ComplianceMatrixProvinceGroup {
  province: string;
  provinceno: string;
  stations: ComplianceMatrixStationRow[];
  provincialTotal: Record<number, Record<string, number>>;
}
