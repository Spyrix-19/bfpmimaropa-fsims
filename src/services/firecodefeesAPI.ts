import type { ApiResponse } from "@/lib/api";
import type { Envelope } from "@/lib/api-envelope";
import type {
  FireCodeFeeDeleteParams,
  FireCodeFeeLedgerParams,
  FireCodeFeeModel,
  FireCodeFeeDTO,
  FireCodeFeeDetailByDateParams,
} from "@/types/firecodefeesType";

/* -------------------------------------------------------------------------
 * Fire Code Fees Collection — endpoints intentionally blanked out while the
 * real/corrected API contract is being finalized.
 *
 * Every method below is a no-op stub that resolves with an empty, successful
 * envelope so the UI keeps rendering (empty ledger, no requests, no errors).
 * Replace each body with the real `apiGet` / `apiPost` / `apiDelete` call.
 * ---------------------------------------------------------------------- */

function emptyEnvelope<T>(data: T): ApiResponse<Envelope<T>> {
  return {
    statusCode: 200,
    isSuccess: true,
    errorMessages: "",
    canceled: false,
    data: {
      statusCode: 200,
      isSuccess: true,
      errorMessages: "",
      draw: 0,
      recordsTotal: 0,
      recordsFiltered: 0,
      pageNumber: 1,
      pageSize: 0,
      totalPages: 0,
      data,
    },
  };
}

export const fireCodeFeesAPI = {
  async getLedger(
    _request: FireCodeFeeLedgerParams,
    _options?: import("@/lib/api").ApiOptions,
  ): Promise<ApiResponse<Envelope<FireCodeFeeModel[]>>> {
    return emptyEnvelope<FireCodeFeeModel[]>([]);
  },

  async create(_params: FireCodeFeeDTO): Promise<ApiResponse<Envelope<unknown>>> {
    return emptyEnvelope<unknown>(null);
  },

  async getDetailBydate(
    _params?: FireCodeFeeDetailByDateParams,
    _options?: import("@/lib/api").ApiOptions,
  ): Promise<ApiResponse<Envelope<unknown>>> {
    return emptyEnvelope<unknown>(null);
  },

  async delete(_params?: FireCodeFeeDeleteParams): Promise<ApiResponse<Envelope<unknown>>> {
    return emptyEnvelope<unknown>(null);
  },
};
