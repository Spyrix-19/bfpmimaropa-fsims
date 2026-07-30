export interface FSISTargetReferenceDTO {
  stationno: string;
  provinceno: string;
  encodedby: string;
  targetreferencelist: TargetReferenceClass[];
}

export interface TargetReferenceClass {
  targetno: string;
  reportyear: number;
  reportmonth: number;
  /** Day of month (1..31) — daily granularity. Optional for backward compatibility. */
  reportday?: number;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
}

export interface TargetReferenceDetailParams {
  stationno: string;
  reportyear: number;
}

export interface TargetReferenceDetailModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  targetreferencelist: TargetReferenceDetailClassModel[];
}

export interface TargetReferenceDetailClassModel {
  targetno: string;
  reportyear: number;
  reportmonth: number;
  /** Day of month (1..31) when the backend stores daily records. */
  reportday?: number;
  iseditable: boolean;
  editablestatus: number;
  isrevisionrequest: boolean;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
  isdeleted: boolean;
  deletedby: string;
  datedeleted: string | Date;
  deletedbyname: string;
  updatedby: string;
  dateupdated: string | Date;
  updatedbyname: string;
  encodedby: string;
  encodedbyname: string;
  dateencoded: string | Date;
}


export interface TargetReferenceLedgerParams {
  searchkey: string;
  stationno: string;
  reportyear: number;
  provinceno: string;
  pagenumber: number;
  pagesize: number;
}


export interface TargetReferenceModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  targetreferencelist: TargetReferenceClassModel[];
}

export interface TargetReferenceClassModel {
  targetno: string;
  reportyear: number;
  reportmonth: number;
  /** Day of month (1..31) when the backend stores daily records. */
  reportday?: number;
  iseditable: boolean;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
}

export interface TargetReferenceDeleteParams {
  stationno: string;
  reportyear: number;
  deletedby: string;
  roleno: number;
}

export interface ProvinceStationSelectionClass {
  provinceno: string;
  stationnos: string[];
}

export interface ExportTargetReferenceRequestDTO {
  searchkey: string;
  reportyear: number;
  provinces: ProvinceStationSelectionClass[];
}

export interface ProvinceExportModel {
  provinceno: string;
  provincename: string;
  stations: TargetReferenceModel[];
}