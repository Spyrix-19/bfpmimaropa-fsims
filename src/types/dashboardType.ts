export interface DashboardClass {
  provinceno: string;
  stationnos: string[];
}

export interface DashboardDTO {
  reportyear: number;
  /** 1 Daily, 2 Weekly, 3 Monthly, 4 Quarterly, 5 Semester, 6 Annual. */
  interval: number;
  /** `MM/dd/yyyy` */
  startdate: string;
  /** `MM/dd/yyyy` */
  enddate: string;
  provinces: DashboardClass[];
}

export interface DashboardYearToYearDTO {
  reportyear: number[];
  Provinces: DashboardClass[];
}

export interface DashboardComplianceModel {
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
  year: number;
  totalduring: number;
  totalafter: number;
  totalbplo: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardFSECModel {
  year: number;
  totalbuilding: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardFSICModel {
  year: number;
  totaloccupancy: number;
  totalbplonew: number;
  totalbplorenew: number;
  totalgov: number;
  totalpeza: number;
  totaltieza: number;
}

export interface DashboardNoticeModel {
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

export interface DashboardYearlyInspectionModel {
  reportyear: number;
  yearlyinspectionList: DashboardYearlyInspectionClass[];
}

export interface DashboardYearlyInspectionClass {
  reportmonth: number;
  totalaccomplish: number;
}
