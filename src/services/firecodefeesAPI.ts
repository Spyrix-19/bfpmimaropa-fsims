import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {
  FSISFeeCollectionDTO,
  FSISFeeCollectionDetailModel,
  FSISFeeCollectionDetailParams,
  FSISFeeCollectionDeleteParams,
  FSISFeeCollectionLedgerParams,
  FSISStationFeeDetailModel,
  FSISFeeCollectionDetailByDateParams,
  ExportFSISFeeCollectionDTO,
} from "@/types/firecodefeesType";

export const firecodefeesAPI = {
  async create(params: FSISFeeCollectionDTO) {
    return await apiPost("/api/v1/FSISFeeCollection/Create", params, { ...NO_RETRY });
  },

  async getDetailBydate(
    params?: FSISFeeCollectionDetailByDateParams,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<FSISFeeCollectionDetailModel>(
      "/api/v1/FSISFeeCollection/Detail/Date",
      params,
      {
        ...options,
      },
    );
  },

  async getDetail(
    params?: FSISFeeCollectionDetailParams,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<FSISFeeCollectionDetailModel>(
      "/api/v1/FSISFeeCollection/Detail",
      params,
      {
        ...options,
      },
    );
  },

  async getLedger(
    request: FSISFeeCollectionLedgerParams,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<FSISStationFeeDetailModel[]>(
      "/api/v1/FSISFeeCollection/Ledger",
      request.parameters,
      {
        params: {
          Pagenumber: request.pagenumber ?? 1,
          Pagesize: request.pagesize ?? 10,
        },
        ...options,
      },
    );
  },

  async delete(params?: FSISFeeCollectionDeleteParams) {
    return await apiDelete("/api/v1/FSISFeeCollection/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async export(body: ExportFSISFeeCollectionDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost("/api/v1/FSISFeeCollection/Export", body, {
      ...GET_RETRY,
      ...options,
    });
  },
};
