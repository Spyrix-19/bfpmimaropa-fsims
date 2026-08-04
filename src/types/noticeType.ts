export type NoticeCategory = "NOD" | "NTC" | "NTCV" | "Abatement" | "Closure";

export interface NoticeCategoryCounts {
  pending: number;
  accomplished: number;
}

export interface NoticeCategoryRow extends NoticeCategoryCounts {
  category: NoticeCategory;
  remaining: number;
  completionPct: number;
}

//create
export interface FSISNoticeDTO {
  noticeno: string;
  stationno: string;
  dateaccomplish: string;
  encodedby: string;
  accomnoticeList: NoticeAccomClass[];
}

export interface NoticeAccomClass {
  accomplishno: string;
  noticeno: string;
  fsicmode: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
}

//Detail by Date
export interface FSISNoticeDetailByDateParams {
  stationno: string;
  dateaccomplish: string;
}

//detail
export interface FSISNoticeDetailParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
}

//ledger
export interface NoticeParamClass {
  provinceno: string;
  stationnos: string[];
}

export interface NoticeLedgerParams {
  parameters?: NoticeModel;
  pagenumber?: number;
  pagesize?: number;
}

export interface NoticeModel {
  searchkey: string;
  reportyear: number;
  interval: number; // 1 Daily, 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual
  dateaccomplish: string;
  reportmonth: number[];
  provinces: NoticeParamClass[];
}

/**
 * `POST /api/v1/FSISNotice/Ledger` returns its rows wrapped in a
 * `{ total, items }` payload rather than a bare array.
 */
export interface NoticeLedgerResultModel {
  total: number;
  items: NoticeDetailModel[];
}

export interface NoticeDetailModel {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname?: string;
  logourl: string;
  totalissuednodcount?: number;
  totalissuedntccount?: number;
  totalissuedntcvcount?: number;
  totalissuedabatementcount?: number;
  totalissuedclosurecount?: number;
  totalaccomplishednodcount?: number;
  totalaccomplishedntccount?: number;
  totalaccomplishedntcvcount?: number;
  totalaccomplishedabatementcount?: number;
  totalaccomplishedclosurecount?: number;
  noticedetallist: NoticeDetailClassModel[];
}

export interface NoticeDetailClassModel {
  noticeno: string;
  stationno: string;
  dateaccomplish: string;
  isrevisionrequest: boolean;
  editablestatus: number;
  noticeaccomlist: NoticeAccomDetailClass[];
}

export interface NoticeAccomDetailClass {
  accomplishno: string;
  noticeno: string;
  fsicmode: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
}

//Delete
export interface FSISNoticeDeleteParams {
  stationno: string;
  reportyear: number;
  reportmonth?: number;
  deletedby: string;
  roleno: number;
}

//export
export interface NoticeProvinceStationSelectionClass {
  provinceno: string;
  /**
   * If stationnos is null or empty, include all stations for this province.
   */
  stationnos: string[];
}

export interface ExportNoticeDTO {
  searchkey: string;
  reportyear: number;
  provinces: NoticeProvinceStationSelectionClass[];
}
