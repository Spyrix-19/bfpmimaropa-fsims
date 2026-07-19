export interface FSISInventoryDTO {
  fsisno: string;
  stationno: string;
  dateinspected: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
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
  remarks: string;
  updatedby: string;
  encodedby: string;
}

export interface FSISInventoryDetailModel {
  fsisno: string;
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
  dateinspected: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
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
  remarks: string;
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

export interface FSISInventoryModel {
  fsisno: string;
  stationno: string;
  dateinspected: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
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
  remarks: string;
  updatedby: string;
  encodedby: string;
}

export interface TargetAccomplishmentParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
}

/* =========================================================================
 * FSIS Inventory Ledger — server-side paged response used by the
 * Fire Safety Compliance ledger page.
 * ========================================================================= */

export interface FSISInventoryLedgerParams {
  searchkey?: string;
  stationno?: string;
  provinceno?: string;
  reportyear: number;
  reportmonth?: number;
  pagenumber: number;
  pagesize: number;
}

export interface FSISInventoryLedgerDailyItem {
  fsisno: string;
  dateinspected: string;
  remarks: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
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

export interface FSISInventoryLedgerItem {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityno: string;
  cityname: string;
  logourl: string;
  dateinspected: string;
  remarks: string;
  reportyear: number;
  reportmonth: number;
  fsisInventoryLedgerList: FSISInventoryLedgerDailyItem[];
  updatedby: string;
  encodedby: string;
}

/* =========================================================================
 * FSIS Inventory Monthly — station-scoped monthly response consumed by the
 * Fire Safety Compliance page. Mirrors GET /api/v1/FSISInventory/Monthly.
 * ========================================================================= */

export interface FSISInventoryMonthlyParams {
  Stationno: string;
  Provinceno: string;
  Reportyear: number;
  Reportmonth: number;
}

export interface FSISInventoryMonthlyItem {
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
  dateinspected: string;
  remarks: string;
  reportyear: number;
  reportmonth: number;
  fsisInventoryLedgerList: FSISInventoryLedgerDailyItem[];
  updatedby: string;
  encodedby: string;
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