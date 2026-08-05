export interface FSISBWCDTO {
    bwcno: string;
    stationno: string;
    operationalcount: number;
    nonoperationalcount: number;
    remarks: string;
    encodedby: string;
  }
  
  export interface CheckExistParams {
    stationno: string;
  }

  export interface FSISBWCDetailParams {
    bwcno: string;
  }

  export interface FSISBWCDetailModel {
    bwcno: string;
    stationno: string;
    stationcode: string;
    stationname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    logourl: string;
    operationalcount: number;
    nonoperationalcount: number;
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
  
  export interface FSISBWCLedgerParams {
    parameters?: FSISBWCParams;
    pagenumber?: number;
    pagesize?: number;
  }

  export interface FSISBWCParams {
    searchkey: string;
    provinces: FSISBWCClass[];
  }
  
  export interface FSISBWCClass {
    provinceno: string;
    stationnos: string[];
  }

  export interface FSISBWCModel {
    bwcno: string;
    stationno: string;
    stationcode: string;
    stationname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    logourl: string;
    operationalcount: number;
    nonoperationalcount: number;
    remarks: string;
  }

  export interface FSISBWCDeleteParams {
    bwcno: string;
    deletedby: string;
    roleno: number;
  }
  