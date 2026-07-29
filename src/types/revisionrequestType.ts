export interface FSISEditRequestDTO {
  requestno: string;
  referencekey: string;
  stationno: string;
  reportyear: number;
  reportmonth: number;
  requesttype: string;
  requestremarks: string;
  statusno: number;
  requestedby: string;
  dateinspected?: string;   //for issuance (monitoringedit.tsx) only
}

export interface FSISEditRequestStatusDTO {
  requestno: string;
  stationno: string;
  requesttype: string;
  remarks: string;
  statusno: number;
  taggedby: string;
}

export interface FSISEditRequestDetailParams {
  requestno: string;
}

export interface FSISEditRequestDetailModel {
  requestno: string;
  referencekey: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  reportyear: number;
  reportmonth: number;
  requestedby: string;
  requestedbyname: string;
  daterequested: Date;
  requesttype: string;
  remarks: string;
  statusno: number;
  statuscode: string;
  statusname: string;
  approvedby: string;
  approvedbyname: string;
  dateapproved: Date;
  rejectedby: string;
  rejectedbyname: string;
  daterejected: Date;
}

export interface FSISEditRequestLedgerParams {
  stationno: string;
  reportyear: number;
  reportmonth: number;
  provinceno: string;
  requesttype: string;
  pagenumber: number;
  pagesize: number;
}

export interface FSISEditRequestModel {
  requestno: string;
  referencekey: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  reportyear: number;
  reportmonth: number;
  requesttype: string;
  remarks: string;
  statusno: number;
  statuscode: string;
  statusname: string;
  fullname?: string;
  daterequested?: string;
}


export interface FSISEditRequestDeleteParams {
  requestno: string;
  deletedby: string;
  roleno: number;
}


