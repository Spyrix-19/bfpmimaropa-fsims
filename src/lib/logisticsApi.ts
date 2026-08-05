import type { ApiOptions, ApiResponse } from "@/lib/api";
import { EMPTY_GUID } from "@/lib/api-envelope";
import { bwcAPI } from "@/services/bwcAPI";
import { inspectorAPI } from "@/services/inspectorAPI";

/** Province + station selection sent to the Ledger endpoints. */
export interface LogisticsProvinceParam {
  provinceno: string;
  stationnos: string[];
}

export interface LogisticsListRequest {
  searchkey: string;
  provinces: LogisticsProvinceParam[];
  pagenumber: number;
  pagesize: number;
}

export interface LogisticsSavePayload {
  /** EMPTY_GUID when adding a new record. */
  recordno: string;
  stationno: string;
  /** Numeric metric values keyed by the module's field keys. */
  values: Record<string, number>;
  remarks: string;
  encodedby: string;
}

export interface LogisticsDeletePayload {
  recordno: string;
  deletedby: string;
  roleno: number;
}

/**
 * Thin adapter so the shared logistics ledger UI can drive either the
 * Issued BWC or the Fire Safety Inspector endpoints with one code path.
 */
export interface LogisticsApi {
  /** Primary key field name returned by the API (`bwcno` / `inspectorno`). */
  idKey: string;
  list(req: LogisticsListRequest, options?: ApiOptions): Promise<ApiResponse<unknown>>;
  detail(recordno: string, options?: ApiOptions): Promise<ApiResponse<unknown>>;
  save(payload: LogisticsSavePayload): Promise<ApiResponse<unknown>>;
  remove(payload: LogisticsDeletePayload): Promise<ApiResponse<unknown>>;
}

const n = (values: Record<string, number>, key: string) => Number(values[key] ?? 0) || 0;

export const bwcLogisticsApi: LogisticsApi = {
  idKey: "bwcno",
  list: (req, options) =>
    bwcAPI.getLedger(
      {
        parameters: { searchkey: req.searchkey, provinces: req.provinces },
        pagenumber: req.pagenumber,
        pagesize: req.pagesize,
      },
      options,
    ),
  detail: (recordno, options) => bwcAPI.getDetail({ bwcno: recordno }, options),
  save: (p) =>
    bwcAPI.create({
      bwcno: p.recordno || EMPTY_GUID,
      stationno: p.stationno,
      operationalcount: n(p.values, "operationalcount"),
      nonoperationalcount: n(p.values, "nonoperationalcount"),
      remarks: p.remarks,
      encodedby: p.encodedby,
    }),
  remove: (p) =>
    bwcAPI.delete({ bwcno: p.recordno, deletedby: p.deletedby, roleno: p.roleno }),
};

export const inspectorLogisticsApi: LogisticsApi = {
  idKey: "inspectorno",
  list: (req, options) =>
    inspectorAPI.getLedger(
      {
        parameters: { searchkey: req.searchkey, provinces: req.provinces },
        pagenumber: req.pagenumber,
        pagesize: req.pagesize,
      },
      options,
    ),
  detail: (recordno, options) => inspectorAPI.getDetail({ inspectorno: recordno }, options),
  save: (p) =>
    inspectorAPI.create({
      inspectorno: p.recordno || EMPTY_GUID,
      stationno: p.stationno,
      withtrainingcount: n(p.values, "withtrainingcount"),
      withouttrainingcount: n(p.values, "withouttrainingcount"),
      remarks: p.remarks,
      encodedby: p.encodedby,
    }),
  remove: (p) =>
    inspectorAPI.delete({ inspectorno: p.recordno, deletedby: p.deletedby, roleno: p.roleno }),
};
