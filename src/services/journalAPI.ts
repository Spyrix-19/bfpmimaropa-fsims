import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {JournalDTO, JournalDetailParams, JournalDetailModel, JournalLedgerParams, JournalModel, JournalDeleteParams} from "@/types/journalType"

export const journalAPI = {
  async create(params: JournalDTO) {
    return await apiPost("/api/v1/Journal/Create", params, { ...NO_RETRY });
  },  

  async getDetail(params?: JournalDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<JournalDetailModel>("/api/v1/Journal/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(params?: JournalLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<JournalModel[]>("/api/v1/Journal/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: JournalDeleteParams) {
    return await apiDelete("/api/v1/Journal/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },



  
};
