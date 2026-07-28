import { apiPost, MUTATION_RETRY_LIGHT } from "@/lib/api";
import { DashboardComplianceDTO, DashboardComplianceModel } from "@/types/dashboardType";

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
};
