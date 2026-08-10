export interface AnnouncementRequestDTO {
  announcementno: string;
  title: string;
  summary: string;
  content: string;
  priority: string;
  imageurl: string;
  attachmenturl: string;
  ispinned: boolean;
  ispopup: boolean;
  isactive: boolean;
  startdate: string;
  enddate: string;
  systemnos: string[];
  viewers: AnnouncementViewerRequestClass[];
  encodedby: string;
}

export interface AnnouncementViewerRequestClass {
  viewertype: string;
  viewerno: string;
}

export interface AnnouncementReadDTO {
  announcementno: string;
  memberno: string;
}

// Detail Models
export interface AnnouncementDetailParams {
  announcementno: string;
}

export interface AnnouncementDetailModel {
  announcementno: string;
  title: string;
  summary: string;
  content: string;
  priority: string;
  imageurl: string;
  attachmenturl: string;
  ispinned: boolean;
  ispopup: boolean;
  isactive: boolean;
  startdate: string;
  enddate: string;
  systems: string[];
  viewers: AnnouncementViewerRequestClass[];
}

// Ledger Models
export interface AnnouncementLedgerParams {
  searchkey?: string;
  systemno?: string;
  memberno?: string;
  pagenumber?: number;
  pagesize?: number;
}


export interface AnnouncementLedgerModel {
  announcementno: string;
  title: string;
  summary: string;
  priority: string;
  ispinned: boolean;
  ispopup: boolean;
  isactive: boolean;
  startdate: string;
  enddate: string;
  dateencoded: string;
  dateupdated: string;
}

//Delete
export interface AnnouncementDeleteParams {
  announcementno: string;
  deletedby: string;
  roleno: number;
}

export interface AnnouncementMemberParams {
  memberno: number;
}

