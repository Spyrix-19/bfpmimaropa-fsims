/**
 * Types for the FSIMS Login API (POST /api/v1/Auth/Login).
 *
 * The API response is the single source of truth for the authenticated user.
 * No follow-up profile/enrichment call is required.
 */

export interface LoginDTO {
  badgeno: string;
  userpass: string;
  client_id?: string;
  client_secret?: string;
  grant_type?: string;
  login_type?: string;
}

/** Raw system-access entry as returned in `member.systemaccess[]`. */
export interface SystemAccessEntry {
  memberno: string;
  systemno: string;
  systemcode: string;
  systemname: string;
  hasaccess: boolean;
  roleno: number;
  rolecode: string;
  rolename: string;
}

/** Raw member payload returned by the Login API. */
export interface AuthMemberModel {
  memberno: string;
  badgeno: string;
  lastname: string;
  firstname: string;
  miname?: string;
  suffix?: string;
  fullname: string;

  rankno: number;
  rankcode: string;
  rankname: string;

  designation: string;

  isnewaccount: boolean;

  stationno: string;
  stationcode: string;
  stationname: string;
  stationtype: number;

  latitude: number;
  longitude: number;

  regionno: string;
  regioncode: string;
  regionname: string;

  provinceno: string;
  provincename: string;

  cityno: string;
  cityname: string;

  zipcode: string;

  barangayno: string;
  barangayname: string;

  profileurl: string;
  filetype?: string;

  isactive?: boolean;  

  systemaccess: SystemAccessEntry[];
}

export interface AuthApiResponse {
  statusCode: number;
  isSuccess: boolean;
  errorMessages: string;
  expiration: string;
  member?: AuthMemberModel | null;
  accessToken: string;
}


/** Resolved FSIMS system access entry attached to the auth user. */
export interface FsimsAccess {
  systemcode: string;
  systemname: string;
  hasaccess: boolean;
  roleno: number;
  rolecode: string;
  rolename: string;
}

/** Canonical authenticated user exposed by the app. */
export type AuthUser = Omit<AuthMemberModel, "systemaccess"> & {
  accessToken: string;
  /** Alias of `fullname` for UI convenience. */
  name: string;
  systemaccess: FsimsAccess;
};

/** DTO used by the change-password modal. */
export interface UpdateMemberPasswordDTO {
  memberno: string;
  userpass: string;
  updatedby: string;
}
