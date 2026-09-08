import { apiGet, GET_RETRY } from "@/lib/api";
import type { SearchGentableLedgerParams, SearchGentableModel } from "@/types/gentableType";

export const gentableAPI = {
  async search(params?: SearchGentableLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchGentableModel[]>("/api/v1/Gentable/Search", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  /** Full (unpaged) code list of a gentable, e.g. "FIRE CODE FEES CATEGORY". */
  async getCode(tablename: string, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchGentableModel[]>("/api/v1/Gentable/Code", {
      params: { Tablename: tablename },
      ...GET_RETRY,
      ...options,
    });
  },
};
