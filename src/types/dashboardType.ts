export interface DashboardComplianceClass {
  provinceno: string;
  stationnos: string[];
}

export interface DashboardComplianceDTO {
  reportyear: number;
  reportmonth: number;
  provinces: DashboardComplianceClass[];
}

export interface DashboardComplianceModel {
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
  inspectionList: DashboardInspectionModel[];
  fsecList: DashboardFSECModel[];
  fsicList: DashboardFSICModel[];
  noticeList: DashboardNoticeModel[];
}

export interface DashboardInspectionModel {
  month: number;
  year: number;
  totalduring: number;
  totalafter: number;
  totalbplo: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardFSECModel {
  month: number;
  year: number;
  totalbuilding: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardFSICModel {
  month: number;
  year: number;
  totaloccupancy: number;
  totalbplonew: number;
  totalbplorenew: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardNoticeModel {
  month: number;
  year: number;
  noticename: string;
  totalpending: number;
  totalaccomplished: number;
}