import { apiGet, GET_RETRY } from "@/lib/api";
import type { DuplicateDataMonitoringModel } from "@/types/duplicaterecordType";

export const duplicateRecordAPI = {
  async getDuplicateDataMonitoring(
    request?: { pagenumber?: number; pagesize?: number },
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiGet<DuplicateDataMonitoringModel[]>("/api/v1/DuplicateDataMonitoring", {
      params: {
        ...(request?.pagenumber != null
          ? { pagenumber: request.pagenumber, Pagenumber: request.pagenumber }
          : {}),
        ...(request?.pagesize != null
          ? { pagesize: request.pagesize, Pagesize: request.pagesize }
          : {}),
      },
      ...GET_RETRY,
      ...options,
    });
  },
};
