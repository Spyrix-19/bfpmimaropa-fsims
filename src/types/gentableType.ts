export interface SearchGentableLedgerParams {
  searchKey?: string;
  tablename?: string;
  pageNumber: number;
  pageSize: number;
}

export interface SearchGentableModel {
  detno: number;
  recordcode: string;
  description: string;
  tablename: string;
  sortorder: number;
}
