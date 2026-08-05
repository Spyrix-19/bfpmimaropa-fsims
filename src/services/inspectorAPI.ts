import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { FSISInspectionDeleteParams, FSISInspectionDetailModel, FSISInspectionDetailParams, FSISInspectionModel, FSISInspectorDTO, FSISInspectorLedgerParams } from "@/types/inspectorType";

export const inspectorAPI = {
  async create(params: FSISInspectorDTO) {
    return await apiPost("/api/v1/FSISInspector/Create", params, { ...NO_RETRY });
  },

  async getDetail(params?: FSISInspectionDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInspectionDetailModel>("/api/v1/FSISInspector/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

   async getLedger(request: FSISInspectorLedgerParams, options?: import("@/lib/api").ApiOptions) {
      return await apiPost<FSISInspectionModel[]>(
        "/api/v1/FSISInspector/Ledger",
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

  async delete(params?: FSISInspectionDeleteParams) {
    return await apiDelete("/api/v1/FSISInspector/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },


};
