export interface SearchStationModel {
  stationno: string;
  stationcode: string;
  stationname: string;

  regionno: string;
  regioncode: string;
  regionname: string;

  provinceno: string;
  provincename: string;

  cityno: string;
  cityname: string;

  zipcode: string;

  barangayno: string;
  barangayname: string;

  streetaddress: string;

  filetype: string;
  logourl: string; // Base64
}

export interface ProvinceStationSelection {
  provinceno: string;
}

export interface ExportTargetReferenceRequest {
  searchkey: string;
  provinces: ProvinceStationSelection[];
}

export interface StationMultipleSearchRequest {
  searchkey: string;
  reportyear: number;
  provinces: ProvinceStationSelection[];
}

export interface SearchStationParams {
  searchKey?: string;
  provinceno?: string;
  pageNumber: number;
  pageSize: number;
}
