export interface SearchOfficeParams {
  searchKey?: string;
  pageNumber: number;
  pageSize: number;
}

export interface SearchOfficeModel {
  detno: number;
  recordcode: string;
  description: string;
  tablename: string;
  sortorder: number;
}
