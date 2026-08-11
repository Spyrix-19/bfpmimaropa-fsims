import { apiGet, apiPost, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {
  DashboardDTO,
  DashboardComplianceModel,
  DashboardInspectionAccomplishModel,
  DashboardIssuanceGapModel,
  DashboardTargetAccomplishModel,
  DashboardMonthlyTargetAccomplishModel,
  DashboardMonthlySectorInspectionModel,
  DashboardYearlyInspectionModel,
  DashboardYearToYearDTO,
} from "@/types/dashboardType";

export const dashboardAPI = {
  async getComplianceSummary(body: DashboardDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost<DashboardComplianceModel>(
      "/api/v1/Dashboard/FSIMS/Compliance/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },

  async getGapSummary(body: DashboardDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost<DashboardIssuanceGapModel>("/api/v1/Dashboard/FSIMS/Gap/Summary", body, {
      ...MUTATION_RETRY_LIGHT,
      ...options,
    });
  },

  async getInspectionSummary(body: DashboardDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost<DashboardInspectionAccomplishModel>(
      "/api/v1/Dashboard/FSIMS/Inspection/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },

  async getTargetVSInspection(
    body: DashboardYearToYearDTO,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<DashboardTargetAccomplishModel>(
      "/api/v1/Dashboard/FSIMS/TargetVSInspection/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },

  async getMonthlyTargetVSInspection(
    body: DashboardYearToYearDTO,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<DashboardMonthlyTargetAccomplishModel>(
      "/api/v1/Dashboard/FSIMS/MonthlyTargetVSInspection/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },

  async getMonthlySectorInspection(
    body: DashboardYearToYearDTO,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<DashboardMonthlySectorInspectionModel>(
      "/api/v1/Dashboard/FSIMS/MonthlySectorInspection/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },

  async getYearlyInspection(
    body: DashboardYearToYearDTO,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiPost<DashboardYearlyInspectionModel>(
      "/api/v1/Dashboard/FSIMS/YearlyInspection/Summary",
      body,
      {
        ...MUTATION_RETRY_LIGHT,
        ...options,
      },
    );
  },
};
