export interface TargetReferenceDTO {
  stationno: string;
  updatedby: string;
  encodedby: string;
  targetreferencelist: TargetReferenceClass[];
}

export interface TargetReferenceClass {
  targetno: string;
  sectorno: number;
  reportyear: number;
  reportmonth: number;
  targettotal: number;
}

export interface TargetReferenceDetailParams {
  stationno: string;
  reportyear: number;
}

export interface TargetReferenceDetailModel {
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

  deletedby: string;
  datedeleted: Date;
  deletedbyname: string;

  updatedby: string;
  dateupdated: Date;
  updatedbyname: string;

  encodedby: string;
  encodedbyname: string;
  dateencoded: Date;

  targetreferencelist: TargetReferenceClassModel[];
}

export interface TargetReferenceLedgerParams {
  searchkey: string;
  stationno: string;
  reportyear: number;
  provinceno: string;
  pagenumber: number;
  pagesize: number;
}


export interface TargetReferenceExportParams {
  searchkey?: string;
  stationno: string;
  provinceno: string;
  reportyear: number;
}

export interface TargetReferenceModel {
  stationno: string;
  stationcode: string;
  stationname: string;

  provinceno?: string;
  provincename: string;
  cityname: string;

  logourl: string;

  updatedby: string;
  encodedby: string;

  targetreferencelist: TargetReferenceClassModel[];
}

export interface TargetReferenceClassModel {
  targetno: string;

  sectorno: number;
  sectorcode: string;
  sectorname: string;

  reportyear: number;
  reportmonth: number;

  targettotal: number;

  iseditable: boolean;
}

export interface TargetReferenceDeleteParams {
  stationno: string;
  reportyear: number;
  deletedby: string;
  roleno: number;
}

export interface ProvinceExportModel {
  provinceno: string; // Guid
  provincename: string;
  stations: TargetReferenceModel[];
}

export interface ProvinceStationSelection {
  provinceno: string;

  stationnos: string[];
}

export interface ExportTargetReferenceRequest {
  searchkey: string;
  reportyear: number;
  provinces: ProvinceStationSelection[];
}

