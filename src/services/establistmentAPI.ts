import { apiGet, apiPost, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { BusinessEstablishmentDeleteParams, BusinessEstablishmentDetailModel, BusinessEstablishmentDetailParams, BusinessEstablishmentDTO, BusinessEstablishmentLedgerParams, BusinessEstablishmentModel, SearchBusinessEstablishmentParams } from "@/types/establishmentType";



export const businessAPI = {
  async search(params?: SearchBusinessEstablishmentParams) {
    return await apiGet<BusinessEstablishmentModel[]>("/api/v1/BusinessEstablishment/Search", { params, ...GET_RETRY });
  },

  async create(params: BusinessEstablishmentDTO) {
    return await apiPost("/api/v1/BusinessEstablishment/Create", params, { ...NO_RETRY });
  },

  async getDetails(params: BusinessEstablishmentDetailParams) {
    return await apiGet<BusinessEstablishmentDetailModel>("/api/v1/BusinessEstablishment/Details", {
      params,
      ...GET_RETRY,
    });
  },

  async getLedger(params: BusinessEstablishmentLedgerParams) {
    return await apiGet<BusinessEstablishmentModel[]>("/api/v1/BusinessEstablishment/Ledger", {
      params,
      ...GET_RETRY,
    });
  },

  async delete(params?: BusinessEstablishmentDeleteParams) {
    return await apiDelete("/api/v1/BusinessEstablishment/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },
};
