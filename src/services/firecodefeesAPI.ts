import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import type {
  FireCodeFeeDeleteParams,
  FireCodeFeeLedgerParams,
  FireCodeFeeModel,
  FireCodeFeeDTO,
  FireCodeFeeDetailByDateParams,
} from "@/types/firecodefeesType";

/**
 * Fire Code Fees Collection endpoints. The contract mirrors
 * `/api/v1/FSISCompliance/*` so the collection ledger behaves exactly like
 * the Fire Safety Compliance ledger.
 */
export const fireCodeFeesAPI = {
  async getLedger(request: FireCodeFeeLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiPost<FireCodeFeeModel[]>(
      "/api/v1/FireCodeFees/Ledger",
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

  async create(params: FireCodeFeeDTO) {
    return await apiPost("/api/v1/FireCodeFees/Create", params, { ...NO_RETRY });
  },

  async getDetailBydate(
    params?: FireCodeFeeDetailByDateParams,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiGet<unknown>("/api/v1/FireCodeFees/Detail/Date", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: FireCodeFeeDeleteParams) {
    return await apiDelete("/api/v1/FireCodeFees/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },
};
