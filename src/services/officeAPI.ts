import { apiGet, GET_RETRY } from "@/lib/api";
import type { SearchOfficeParams, SearchOfficeModel } from "@/types/officeTypes";

export const officeAPI = {
  async search(params?: SearchOfficeParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchOfficeModel[]>("/api/v1/Office/Search", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },
};
