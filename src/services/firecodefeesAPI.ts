import { apiPost, apiDelete, MUTATION_RETRY_LIGHT } from "@/lib/api";
import type {
  FireCodeFeeDeleteParams,
  FireCodeFeeLedgerParams,
  FireCodeFeeModel,
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

  async delete(params?: FireCodeFeeDeleteParams) {
    return await apiDelete("/api/v1/FireCodeFees/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },
};
