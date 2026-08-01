import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISComplianceDTO, FSISComplianceDetailModel, FSISComplianceDetailByDateModel, FSISComplianceDetailParams, 
  FSISComplianceLedgerParams, FSISComplianceModel, FSISComplianceDeleteParams, 
  ExportFSISComplianceRequestDTO} from "@/types/complianceType";

export const complianceAPI = {
  async create(params: FSISComplianceDTO) {
    return await apiPost("/api/v1/FSISCompliance/Create", params, { ...NO_RETRY });
  },  

  /**
   * Existence check for a station + specific target date (M/D/YYYY).
   * Returns the station wrapper model whose `compliancelist` is empty when no
   * record exists for that date.
   */
async getDetailBydate(
    params: { Stationno: string; Dateinspected: string },
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<FSISComplianceDetailByDateModel>(
      "/api/v1/FSISCompliance/Detail/Date",
      { params, ...GET_RETRY, ...options }
    );
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

// ---------------------------------------------------------------------------
// Legacy FSISInventory endpoints, still used by the compliance ledger, matrix,
// edit and view screens. Kept as a separate export so complianceAPI above can
// stay focused on the FSISCompliance endpoints.
// ---------------------------------------------------------------------------
import type {
  FSISInventoryDTO,
  TargetAccomplishmentParams,
  TargetAccomplishmentModel,
  FSISInventoryLedgerParams,
  FSISInventoryLedgerModel,
  FSISUpdateInventoryDTO,
  FSISInventoryMonthlyParams,
  FSISCheckInventoryMonthlyParams,
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryDeleteParams,
  ExportFSISInventoryDTO,
} from "@/types/complianceType";

export const targetinventoryAPI = {
  async create(params: FSISInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Create", params, { ...NO_RETRY });
  },

  async getTargetAccomplishment(
    params?: TargetAccomplishmentParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    const mapped = {
      Stationno: params?.stationno,
      Reportyear: params?.reportyear,
      Reportmonth: params?.reportmonth,
    };
    return await apiGet<TargetAccomplishmentModel>(
      "/api/v1/FSISInventory/TargetAccomplishment",
      { params: mapped, ...GET_RETRY, ...options }
    );
  },

  async getInventoryLedger(
    params: FSISInventoryLedgerParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<FSISInventoryLedgerModel[]>("/api/v1/FSISInventory/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async update(params: FSISUpdateInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Monthly/Update", params, { ...NO_RETRY });
  },

  async getMonthlyExist(
    params: FSISCheckInventoryMonthlyParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>(
      "/api/v1/FSISInventory/Monthly/Exist",
      { params, ...GET_RETRY, ...options }
    );
  },

  async getMonthly(
    params: FSISInventoryMonthlyParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>("/api/v1/FSISInventory/Monthly", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getDetail(
    params: FSISInventoryMonthlyParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>("/api/v1/FSISInventory/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: FSISInventoryDeleteParams) {
    return await apiDelete("/api/v1/FSISInventory/Monthly/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async export(body: ExportFSISInventoryDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost("/api/v1/FSISInventory/Export", body, {
      ...MUTATION_RETRY_LIGHT,
      ...options,
    });
  },
};
