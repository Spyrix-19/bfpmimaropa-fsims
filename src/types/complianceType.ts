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

export interface FSISIssuanceParamClass {
  provinceno: string;
  stationnos: string[];
}

export interface FSISComplianceParams {
  searchkey: string;
  reportyear: number;
  interval: number; // 1 Daily, 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual
  dateinspected: string; // ISO Date string
  reportmonth: number[];
  provinces: FSISIssuanceParamClass[];
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


// Detail Models
export interface FSISComplianceDetailParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
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

export interface FSISComplianceDetailClassModel {
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
  isrevisionrequest: boolean;
  editablestatus: number;
  remarks: string;
  dateinspected: string; // ISO Date string
  issuancelist: FSISIssuanceDetailClassModel[];
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

export interface FSISComplianceDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}

export interface ProvinceIssuanceExportModel {
  provinceno: string;
  provincename: string;
  stations: FSISComplianceModel[];
}