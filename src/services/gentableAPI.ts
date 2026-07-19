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
};
