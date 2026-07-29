import { apiGet, apiPost, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { DashboardComplianceDTO, DashboardComplianceModel, DashboardInspectionAccomplishModel, DashboardIssuanceGapDTO, DashboardIssuanceGapModel } from "@/types/dashboardType";

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


  async getGapSummary(params?: DashboardIssuanceGapDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<DashboardIssuanceGapModel[]>("/api/v1/Dashboard/FSIMS/Gap/Summary", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getInspectionSummary(params?: DashboardIssuanceGapDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<DashboardInspectionAccomplishModel[]>("/api/v1/Dashboard/FSIMS/Inspection/Summary", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },


    
};
