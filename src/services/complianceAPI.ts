import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISInventoryDTO, TargetAccomplishmentParams, TargetAccomplishmentModel, FSISInventoryLedgerParams, FSISInventoryLedgerModel,
FSISUpdateInventoryDTO, FSISInventoryMonthlyParams, FSISCheckInventoryMonthlyParams, FSISInventoryMonthlyLedgerModel, FSISInventoryDeleteParams,
ExportFSISInventoryDTO } from "@/types/complianceType";

export const complianceAPI = {
  async create(params: FSISInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Create", params, { ...NO_RETRY });
  },

  async getTargetAccomplishment(params?: TargetAccomplishmentParams, options?: import("@/lib/api").ApiOptions) {
    // The backend expects capitalized query params for this endpoint.
    // The working curl sample uses Stationno / Reportyear / Reportmonth.
    const mapped = {
      Stationno: params?.stationno,
      Reportyear: params?.reportyear,
      Reportmonth: params?.reportmonth,
    };

    return await apiGet<TargetAccomplishmentModel>("/api/v1/FSISInventory/TargetAccomplishment", {
      params: mapped,
      ...GET_RETRY,
      ...options,
    });
  },

  async getInventoryLedger(params: FSISInventoryLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryLedgerModel[]>("/api/v1/FSISInventory/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

 async update(params: FSISUpdateInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Monthly/Update", params, { ...NO_RETRY });
  },

  async getMonthlyExist(params: FSISCheckInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>("/api/v1/FSISInventory/Monthly/Exist", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getMonthly(params: FSISInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>("/api/v1/FSISInventory/Monthly", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getDetail(params: FSISInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
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

async export(
    body: ExportFSISInventoryDTO,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost("/api/v1/FSISInventory/Export", body, {
      ...MUTATION_RETRY_LIGHT,
      ...options,
    });
  }




};

