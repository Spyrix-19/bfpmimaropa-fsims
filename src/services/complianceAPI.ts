import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISComplianceDTO, FSISComplianceDetailModel, FSISComplianceDetailByDateModel, FSISComplianceDetailParams, 
  FSISComplianceLedgerParams, FSISComplianceModel, FSISComplianceDeleteParams, 
  ExportFSISComplianceRequestDTO, FSISComplianceTargetAccomParams, TargetAccomplishmentModel,
  FSISComplianceDetailByDateParams} from "@/types/complianceType";

export const complianceAPI = {
  async getTargetAccomplishment(
    params?: FSISComplianceTargetAccomParams, options?: import("@/lib/api").ApiOptions ) {
    return await apiGet<TargetAccomplishmentModel>("/api/v1/FSISCompliance/TargetAccomplishment", { 
      params, 
      ...GET_RETRY, 
      ...options 
    });
  },


  async create(params: FSISComplianceDTO) {
    return await apiPost("/api/v1/FSISCompliance/Create", params, { ...NO_RETRY });
  },  

async getDetailBydate(
    params?: FSISComplianceDetailByDateParams, options?: import("@/lib/api").ApiOptions ) {
    return await apiGet<FSISComplianceDetailByDateModel>("/api/v1/FSISCompliance/Detail/Date", { 
      params, 
      ...GET_RETRY, 
      ...options 
    });
  },

  async getDetail(params?: FSISComplianceDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISComplianceDetailModel>("/api/v1/FSISCompliance/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(
    request: FSISComplianceLedgerParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost<FSISComplianceModel[]>(
      "/api/v1/FSISCompliance/Ledger",
      request.parameters,
      {
        params: {
          Pagenumber: request.pagenumber ?? 1,
          Pagesize: request.pagesize ?? 10,
        },
        ...options,
      }
    );
  },

  async delete(params?: FSISComplianceDeleteParams) {
    return await apiDelete("/api/v1/FSISCompliance/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async export(
    body: ExportFSISComplianceRequestDTO,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost("/api/v1/FSISCompliance/Export", body, {
      ...GET_RETRY,
      ...options,
    });
  }

  
};
