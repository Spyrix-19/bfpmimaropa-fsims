export interface JournalDTO {
  stationno: string;
  ipaddress: string;
  browser: string;
  device: string;
  updatedby: string;
  encodedby: string;
  journalList: JournalClass[];
}

export interface JournalClass {
  journalno: string;
  tablename: string;
  modulename: string;
  actiontype: string;
  referenceid: string;
  description: string;
  olddata: string;
  newdata: string;
}

export interface JournalDetailParams {
  journalno: string;
}

export interface JournalDetailModel {
  journalno: string;
  tablename: string;
  modulename: string;
  actiontype: string;
  referenceid: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  logourl: string;
  description: string;
  olddata: string;
  newdata: string;
  ipaddress: string;
  browser: string;
  device: string;
  isdeleted: boolean;
  deletedby: string;
  datedeleted: Date;
  deletedbyname: string;
  updatedby: string;
  dateupdated: Date | null;
  updatedbyname: string;
  encodedby: string;
  encodedbyname: string;
  dateencoded: Date;
}

export interface JournalLedgerParams {
  searchkey: string;
  modulename: string;
  pagenumber: number;
  pagesize: number;
}

export interface JournalModel {
  journalno: string;
  tablename: string;
  modulename: string;
  actiontype: string;
  referenceid: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  logourl: string;
  description: string;
  dateencoded: Date;
}

export interface JournalDeleteParams {
  journalno: string;
  deletedby: string;
  roleno: number;
}
