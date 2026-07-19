export interface SearchLedgerParams {
  searchkey?: string;
  parentcode: string;
  locationtype: string;
  pagenumber: number;
  pagesize: number;
}


export interface SearchLocationModel {
  locationno: string; // Guid
  locationcode: string;
  locationname: string;
  locationtype: string;
  sortorder: number; // decimal
}
