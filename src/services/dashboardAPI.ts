import { apiGet, apiPost, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { DashboardComplianceDTO, DashboardComplianceModel, DashboardIssuanceGapDTO, DashboardIssuanceGapModel } from "@/types/dashboardType";

export const dashboardAPI = {
  async getComplianceSummary(
    body: DashboardComplianceDTO,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<DashboardComplianceModel>(
      "/api/v1/Dashboard/FSIMS/Compliance/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },


  async search(params?: DashboardIssuanceGapDTO, options?: import("@/lib/api").ApiOptions) {
      return await apiGet<DashboardIssuanceGapModel[]>("/api/v1/Dashboard/FSIMS/Gap/Summary", {
        params,
        ...GET_RETRY,
        ...options,
      });
    },



    
};
