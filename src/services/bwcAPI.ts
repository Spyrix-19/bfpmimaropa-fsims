import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { FSISBWCDeleteParams, FSISBWCDetailModel, FSISBWCDetailParams, FSISBWCDTO, FSISBWCLedgerParams, FSISBWCModel } from "@/types/bwcType";

export const bwcAPI = {
  async create(params: FSISBWCDTO) {
    return await apiPost("/api/v1/FSISBWC/Create", params, { ...NO_RETRY });
  },

  async getDetail(params?: FSISBWCDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISBWCDetailModel>("/api/v1/FSISBWC/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

   async getLedger(request: FSISBWCLedgerParams, options?: import("@/lib/api").ApiOptions) {
      return await apiPost<FSISBWCModel[]>(
        "/api/v1/FSISBWC/Ledger",
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

  async delete(params?: FSISBWCDeleteParams) {
    return await apiDelete("/api/v1/FSISBWC/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },


};
