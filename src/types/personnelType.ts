export interface MemberInfoDTO {
  memberno: string;
  lastname: string;
  firstname: string;
  miname: string;
  suffix: string;
  rankno: number;
  statusno: number;
  genderno: number;
  civilstatus: number;
  birthdate: string;
  emailaddress: string;
  mobileno: string;
  updatedby: string;
}

export interface MemberEmploymentDTO {
  memberno: string;
  stationno: string;
  officeno: number;
  designation: string;
  defs: string;
  degs: string;
  updatedby: string;
}

export interface UploadMemberProfileDTO {
  memberno: string;
  badgeno: string;
  file: File;
  updatedby: string;
}

export interface MemberProfileDeleteParams {
  memberno: string;
  badgeno: string;
  deletedby: string;
}

export interface ActivateMemberPasswordDTO {
  memberno: string;
  activeuser: boolean;
  updatedby: string;
}

export interface UpdateMemberStatusDTO {
  memberno: string;
  statusno: number;
  remarks: string;
  updatedby: string;
}

export interface UnLockMemberPasswordDTO {
  memberno: string;
  passwordlock: boolean;
  updatedby: string;
}

export interface UpdateMemberPasswordDTO {
  memberno: string;
  userpass: string;
  updatedby: string;
}

export interface ResetMemberPasswordDTO {
  memberno: string;
  updatedby: string;
}

export interface UpdatePasswordExpiryDTO {
  memberno: string;
  passwordexpiry: string;
  updatedby: string;
}

export interface UploadResultDTO {
  memberno: string;
  fileName: string;
  path: string;
  relativeUrl: string;
  fullUrl: string;
}

export interface MemberDetailParams {
  memberno: string;
}

export interface MemberDetailModel {
  memberno: string;
  badgeno: string;
  lastname: string;
  firstname: string;
  miname: string;
  suffix: string;
  fullname: string;

  rankno: number;
  rankcode: string;
  rankname: string;

  statusno: number;
  statuscode: string;
  statusname: string;

  genderno: number;
  gendercode: string;
  gendername: string;

  civilstatus: number;
  civilstatuscode: string;
  civilstatusname: string;

  birthdate: string;
  degs: string; // DateTime
  defs: string;

  emailaddress: string;
  mobileno: string;

  stationno: string;
  stationcode: string;
  stationname: string;

  officeno: number;
  officecode: string;
  officename: string;

  designation: string;

  isscope: boolean;
  isfingerprint: boolean;
  isface: boolean;
  ismanual: boolean;

  isactive: boolean;
  inactivedate: string;

  accountlock: boolean;
  lockdate: string;

  ipaddress: string;
  lastaccess: string;
  passwordexpiry?: string;
  
  profileurl: string;
  filetype: string;
  imagedata: string; // Base64 (byte[])

  isnewaccount: boolean;
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

  systemaccess: MemberSystemAccessModel[];
}

/** One entry in `member.systemaccess[]` returned by the Login API. */
export interface MemberSystemAccessModel {
  memberno: string;
  systemno: string;
  systemcode: string;
  systemname: string;
  hasaccess: boolean;
  roleno: number;
  rolecode: string;
  rolename: string;
}

export interface SearchMemberParams {
  searchKey: string;
  pageNumber: number;
  pageSize: number;
}

export class SearchMemberModel {
  Memberno: string = "";
  Badgeno: string = "";
  Lastname: string = "";
  Firstname: string = "";
  Miname: string = "";
  Suffix: string = "";
  Fullname: string = "";
  Rankno: number = 0;
  Rankcode: string = "";
  Rankname: string = "";
  Profileurl: string = "";
  Filetype: string = "";
}

export interface MemberDeleteParams {
  memberno: string;
  deletedby: string;
  roleno: number;
}
