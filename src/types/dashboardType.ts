export interface DashboardClass {
  provinceno: string;
  stationnos: string[];
}

export interface DashboardDTO {
  reportyear: number;
  reportmonth: number[];
  provinces: DashboardClass[];
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

export interface DashboardIssuanceGapModel {
  provinceno: string;
  provincename: string;
  gapList: DashboardIssuanceGapClass[];
}

export interface DashboardIssuanceGapClass {
  totalbplo: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardInspectionAccomplishModel {
  provinceno: string;
  provincename: string;
  inspectionList: DashboardInspectionClass[];
}

export interface DashboardInspectionClass {
  totalbplo: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardTargetAccomplishModel {
  provinceno: string;
  provincename: string;
  targetaccomList: DashboardTargetAccomplishClass[];
}

export interface DashboardTargetAccomplishClass {
  totaltarget: number;
  totalaccomplish: number;
}

export interface DashboardMonthlyTargetAccomplishModel {
  reportmonth: number;
  monthlytargetaccomList: DashboardMonthlyTargetAccomplishClass[];
}

export interface DashboardMonthlyTargetAccomplishClass {
  totaltarget: number;
  totalaccomplish: number;
}

export interface DashboardMonthlySectorInspectionModel {
  reportmonth: number;
  monthlysectorinspectionList: DashboardMonthlySectorInspectionClass[];
}

export interface DashboardMonthlySectorInspectionClass {
  totalbplo: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardYearlyInspectionInspectionModel {
  reportmonth: number;
  monthlysectorinspectionList: DashboardYearlyInspectionInspectionClass[];
}

export interface DashboardYearlyInspectionInspectionClass {
  totalyear1: number;
  totalyear2: number;
  totalyear3: number;
}