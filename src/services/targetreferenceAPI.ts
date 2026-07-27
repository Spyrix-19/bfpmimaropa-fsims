import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISTargetReferenceDTO, TargetReferenceDetailParams, TargetReferenceDetailModel, 
  TargetReferenceLedgerParams, TargetReferenceModel, TargetReferenceDeleteParams, 
  ExportTargetReferenceRequestDTO} from "@/types/targetreferenceType";

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

  async getLedger(params?: TargetReferenceLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<TargetReferenceModel[]>("/api/v1/FSISTargetReference/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
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
