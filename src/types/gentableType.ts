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
  /** Parent code reference, present on hierarchical tables such as fire code fees. */
  parentno?: number | null;
  /** Parent description, present on hierarchical tables such as fire code fees. */
  parentname?: string | null;
}
