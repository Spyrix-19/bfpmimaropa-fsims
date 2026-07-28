import { apiGet, GET_RETRY } from "@/lib/api";
import { DashboardComplianceDTO, DashboardComplianceModel } from "@/types/dashboardType";


export const dashboardAPI = {
  async getComplianceSummary(params?: DashboardComplianceDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<DashboardComplianceModel[]>("/api/v1/Dashboard/FSIMS/Compliance/Summary", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },
};
