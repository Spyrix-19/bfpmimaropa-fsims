export class FSISFeeCollectionDTO {
  Stationno: string = "";
  Encodedby: string = "";
  fsisfeeList: FSISFeeCollectionClass[] = [];
}

export class FSISFeeCollectionClass {
  Feeno: string = "";
  Dateaccomplish: Date = new Date("1900-01-01");
  Isaccomplished: boolean = false;
  Remarks: string = "";
  fsisfeecollectionList: FSISFeeCollectionClassDTO[] = [];
}

export class FSISFeeCollectionClassDTO {
  Accomplishno: string = "";
  Fsicmode: number = 0;
  Feecateg: number = 0;
  Collectedamount: number = 0.00;
}

export interface FSISFeeCollectionParamClass {
  Provinceno: string;
  Stationnos: string[];
}

export interface FSISFeeCollectionParams {
  Searchkey: string;
  Reportyear: number;
  Reportmonth: number[];
  Interval: number;
  Dateaccomplish: string;
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




//Detail by Date
export interface FSISFeeCollectionDetailByDateParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
}



export interface FSISFeeCollectionDetailParams {
  stationno: string;
  reportyear: number;
}



// Ledger Models
export interface FSISFeeCollectionLedgerParams {
  parameters?: FSISFeeCollectionParams;
  pagenumber?: number;
  pagesize?: number;
}

export interface FSISFeeAccomDetailModel {
  Accomplishno: string;
  Feeno: string;
  Fsicmode: number;
  Feecateg: number;
  Collectedamount: number;
}

export interface FSISFeeCollectionDetailModel {
  Feeno: string;
  Stationno: string;
  Dateaccomplish: string;
  Accomfeelist: FSISFeeAccomDetailModel[];
}

export interface FSISStationFeeDetailModel {
  Stationno: string;
  Stationcode: string;
  Stationname: string;
  Provinceno: string;
  Provincename: string;
  Feedetaillist: FSISFeeCollectionDetailModel[];
}

export interface FSISFeeCollectionLedgerModel {
  Total: number;
  Items: FSISStationFeeDetailModel[];
}

//Delete
export interface FSISFeeCollectionDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}
