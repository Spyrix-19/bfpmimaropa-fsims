//Target Accomplishment
export interface FSISComplianceTargetAccomParams {
  stationno: string;
  dateinspected: string;
}

export interface TargetAccomplishmentModel {
  stationno: string;
  dateinspected: string; // ISO date string
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