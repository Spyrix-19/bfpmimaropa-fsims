export interface FSISInspectorDTO {
    inspectorno: string;
    stationno: string;
    withtrainingcount: number;
    withouttrainingcount: number;
    remarks: string;
    encodedby: string;
  }
  
  export interface FSISInspectionDetailParams {
    inspectorno: string;
  }
  
  export interface FSISInspectionDetailModel {
    inspectorno: string;
    stationno: string;
    stationcode: string;
    stationname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    logourl: string;
    withtrainingcount: number;
    withouttrainingcount: number;
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
  
  export interface FSISInspectorLedgerParams {
      parameters?: FSISInspectorParams;
      pagenumber?: number;
      pagesize?: number;
    }

  export interface FSISInspectorParams {
    searchkey: string;
    provinces: FSISInspectorClass[];
  }
  
  export interface FSISInspectorClass {
    provinceno: string;
    stationnos: string[];
  }

  export interface FSISInspectionModel {
    inspectorno: string;
    stationno: string;
    stationcode: string;
    stationname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    logourl: string;
    withtrainingcount: number;
    withouttrainingcount: number;
    remarks: string;
  }

  export interface FSISInspectionDeleteParams {
    inspectorno: string;
    deletedby: string;
    roleno: number;
  }
  