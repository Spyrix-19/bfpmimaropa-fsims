export interface FSISInventoryDTO {
  fsisno: string;
  stationno: string;
  dateinspected: string | Date;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

  remarks: string;

  updatedby: string;
  encodedby: string;

  issuancelist: FSISInventoryIssuanceClassDTO[];
}

export interface FSISInventoryIssuanceClassDTO {
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

  avatementcount: number;
  closurecount: number;
}

export interface FSISUpdateInventoryDTO {
  stationno: string;
  updatedby: string;
  encodedby: string;

  fsisUpdateInventoryList: FSISUpdateInventoryClass[];
}

export interface FSISUpdateInventoryClass {
  fsisno: string;
  stationno: string;
  dateinspected: string | Date;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

  remarks: string;

  updatedby: string;
  encodedby: string;

  issuancelist: FSISInventoryIssuanceClassDTO[];
}

export interface ExportFSISInventoryDTO {
  searchkey: string;
  reportyear: number;
  reportmonth: number;

  provinces: ProvinceStationSelectionClass[];
}

export interface ProvinceStationSelectionClass {
  provinceno: string;
  stationnos: string[];
}






// =========================
// Ledger
// =========================

export interface FSISInventoryLedgerParams {
  searchkey?: string;
  stationno?: string;
  provinceno?: string;
  reportyear: number;
  reportmonth?: number;
  pagenumber: number;
  pagesize: number;
}

export interface FSISInventoryLedgerModel {
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

  updatedby: string;
  encodedby: string;

  fsisInventoryLedgerList: FSISInventoryLedgerClass[];
}

export interface FSISInventoryLedgerClass {
  stationno: string;
  fsisno: string;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

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

  avatementcount: number;
  closurecount: number;

  remarks: string;
  dateinspected: string | Date;
}

// =========================
// Monthly Inventory
// =========================

export interface FSISInventoryMonthlyParams {
  Stationno: string;
  Provinceno: string;
  Reportyear: number;
  Reportmonth: number;
}

export interface FSISCheckInventoryMonthlyParams {
  Stationno: string;
  Provinceno: string;
  /** Complete date based on Reporting Period as of (yyyy-MM-dd). */
  Dateinspected: string;
}


export interface FSISInventoryMonthlyLedgerModel {
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

  fsisInventoryLedgerList: FSISInventoryMonthlyClass[];
}

export interface FSISInventoryMonthlyClass {
  fsisno: string;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

  remarks: string;
  dateinspected: string | Date;

  issuancelist: FSISIssuanceClassModel[];
}

export interface FSISIssuanceClassModel {
  issuanceno: string;
  fsisno: string;

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

  avatementcount: number;
  closurecount: number;

  encodedby: string;
  dateencoded: string | Date;
}

// =========================
// Target Accomplishment
// =========================

export interface TargetAccomplishmentParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
}

export interface TargetAccomplishmentModel {
  stationno: string;

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
}

export interface FSISInventoryDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
  deletedby: string;
  roleno: number;
}

// =========================
// Export Inventory
// =========================

export interface ExportFSISInventoryDTO {
  searchkey: string;
  reportyear: number;
  reportmonth: number;
  provinces: ProvinceStationSelectionClass[];
}

export interface ExportInventoryModel {
  updatedby: string;
  encodedby: string;

  accomplishmentStationlist: ExportInventoryStationClassModel[];
}

export interface ExportInventoryStationClassModel {
  stationno: string;
  provinceno: string;

  stationcode: string;
  stationname: string;

  provincename: string;
  cityname: string;

  logourl: string;

  inventorylist: ExportInventoryClassModel[];
}

export interface ExportInventoryClassModel {
  stationno: string;

  reportyear: number;
  reportmonth: number;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;

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

  avatementcount: number;
  closurecount: number;
}