export interface ActivateUserAccessRoleDTO {
  accessno: string;
  memberno: string;
  systemno: string;
  hasaccess: boolean;
  accountrole: number;
  updatedby: string;
}

export interface DeactivateUserAccessRoleDTO {
  accessno: string;
  updatedby: string;
}

export interface UserParams {
  searchkey: string;
  systemno: string;
  provinceno: string;
  regionno: string;
  pageNumber: number;
  pageSize: number;
}


export interface UserModel {
  accessno: string;
  memberno: string;
  badgeno: string;
  rankcode: string;
  fullname: string;
  profileurl: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  stationtype: number;
  provincename: string;
  logourl: string;
  systemno: string;
  systemcode: string;
  systemname: string;
  hasaccess: boolean;
  roleno: number;
  rolecode: string;
  rolename: string;
}

