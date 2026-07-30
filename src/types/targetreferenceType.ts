export interface FSISTargetReferenceDTO {
  stationno: string;
  provinceno: string;
  encodedby: string;
  targetreferencelist: TargetReferenceClass[];
}

export interface TargetReferenceClass {
  targetno: string;
  targetdate: string;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
  isaccomplished: boolean;
  remarks: string;
}

export interface TargetReferenceParamClass {
  provinceno: string;
  stationnos: string[];
}

export interface TargetReferenceParams {
  searchkey: string;
  reportyear: number;
  interval: number; // 1 Daily, 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual
  targetdate: string;
  reportmonth: number[];
  provinces: TargetReferenceParamClass[];
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

export interface TargetReferenceDetailParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
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
  targetdate: string;
  isrevisionrequest: boolean;
  editablestatus: number;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
  isdeleted: boolean;
  deletedby: string;
  datedeleted: string;
  deletedbyname: string;
  updatedby: string;
  dateupdated: string;
  updatedbyname: string;
  encodedby: string;
  encodedbyname: string;
  dateencoded: string;
}

export interface GetFSISTargetReferenceRequest {
  parameters: TargetReferenceParams;
  pagenumber?: number;
  pagesize?: number;
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

export interface TargetReferenceModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  targetreferencelist: TargetReferenceClassModel[];
}

export interface TargetReferenceDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
  deletedby: string;
  roleno: number;
}




export interface TargetReferenceClassModel {
  targetno: string;
  targetdate: string;
  bplototal: number;
  govtotal: number;
  pezatotal: number;
  tiezatotal: number;
  remarks: string;
}

export interface ProvinceExportModel {
  provinceno: string;
  provincename: string;
  stations: TargetReferenceModel[];
}





















