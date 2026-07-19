import { apiGet, apiPost, GET_RETRY } from "@/lib/api";
import type {
  SearchStationModel,
  SearchStationParams,
  ExportTargetReferenceRequest,
  StationMultipleSearchRequest,
} from "@/types/stationTypes";

export const stationAPI = {
  
  async search(params?: SearchStationParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchStationModel[]>("/api/v1/Station/Search", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

   async searchMultiple(
      body: ExportTargetReferenceRequest,
      pagination: { Pagenumber?: number; Pagesize?: number },
      options?: import("@/lib/api").ApiOptions
    ) {
      return await apiPost("/api/v1/User/Multiple/Search", body, {
        params: pagination,
        ...GET_RETRY,
        ...options,
      });
    },

  async searchStationMultiple(
    body: StationMultipleSearchRequest,
    pagination: { Pagenumber?: number; Pagesize?: number },
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<SearchStationModel[]>("/api/v1/Station/Multiple/Search", body, {
      params: pagination,
      ...GET_RETRY,
      ...options,
    });
  },

};
