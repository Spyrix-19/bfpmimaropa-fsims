import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {
  FSISEditRequestDetailModel,
  FSISEditRequestDetailParams,
  FSISEditRequestDTO,
  FSISEditRequestModel,
  FSISEditRequestDeleteParams,
  FSISEditRequestLedgerParams,
  FSISEditRequestStatusDTO,
} from "@/types/revisionrequestType";

export const revisionrequestAPI = {
  async create(params: FSISEditRequestDTO) {
    return await apiPost("/api/v1/FSISEditRequest/Create", params, { ...NO_RETRY });
  },

  async getDetail(params?: FSISEditRequestDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISEditRequestDetailModel>("/api/v1/FSISEditRequest/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(params?: FSISEditRequestLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISEditRequestModel[]>("/api/v1/FSISEditRequest/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: FSISEditRequestDeleteParams) {
    return await apiDelete("/api/v1/FSISEditRequest/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async status(params: FSISEditRequestStatusDTO) {
    return await apiPost("/api/v1/FSISEditRequest/Status/Update", params, { ...NO_RETRY });
  },
};
