import { apiGet, GET_RETRY } from "@/lib/api";
import { SearchLedgerParams, SearchLocationModel } from "@/types/locationType";

// Endpoints return: [{ locationno: GUID, locationcode: string, locationname: string }]
export const locationAPI = {
  async search(params?: SearchLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchLocationModel[]>("/api/v1/Location/Search", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },
};
