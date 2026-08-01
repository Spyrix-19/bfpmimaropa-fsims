import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISTargetReferenceDTO, TargetReferenceDetailParams, TargetReferenceDetailModel, 
  GetFSISTargetReferenceRequestLedgerParams, TargetReferenceModel, TargetReferenceDeleteParams, 
  ExportTargetReferenceRequestDTO, TargetReferenceByDateModel} from "@/types/targetreferenceType";

export const targetreferenceAPI = {
  async create(params: FSISTargetReferenceDTO) {
    return await apiPost("/api/v1/FSISTargetReference/Create", params, { ...NO_RETRY });
  },  

  async getDetail(params?: TargetReferenceDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<TargetReferenceDetailModel>("/api/v1/FSISTargetReference/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  /** Existence check for a station + specific target date (MM/DD/YYYY). */
  async getDetailByTargetdate(
    params: { Stationno: string; Targetdate: string },
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<TargetReferenceByDateModel[]>(
      "/api/v1/FSISTargetReference/Detail/Targetdate",
      { params, ...GET_RETRY, ...options }
    );
  },

  async getLedger(
    request: GetFSISTargetReferenceRequestLedgerParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost<TargetReferenceModel[]>(
      "/api/v1/FSISTargetReference/Ledger",
      request.parameters,
      {
        params: {
          Pagenumber: request.pagenumber ?? 1,
          Pagesize: request.pagesize ?? 10,
        },
        ...options,
      }
    );
  },

  async delete(params?: TargetReferenceDeleteParams) {
    return await apiDelete("/api/v1/FSISTargetReference/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async export(
    body: ExportTargetReferenceRequestDTO,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost("/api/v1/FSISTargetReference/Export", body, {
      ...GET_RETRY,
      ...options,
    });
  }

  
};
