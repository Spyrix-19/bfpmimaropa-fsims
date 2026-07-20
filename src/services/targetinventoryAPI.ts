import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import {  FSISInventoryDTO,  FSISUpdateInventoryDTO,  TargetAccomplishmentParams,  TargetAccomplishmentModel,  FSISInventoryLedgerParams,
  FSISInventoryLedgerItem,  FSISInventoryMonthlyParams,  FSISInventoryMonthlyItem, FSISInventoryDeleteParams, ExportFSISInventoryDTO} from "@/types/targetinventoryType";

export const targetinventoryAPI = {
  async create(params: FSISInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Create", params, { ...NO_RETRY });
  },

  async getTargetAccomplishment(params?: TargetAccomplishmentParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<TargetAccomplishmentModel>("/api/v1/FSISInventory/TargetAccomplishment", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getInventoryLedger(params: FSISInventoryLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryLedgerItem[]>("/api/v1/FSISInventory/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

 async update(params: FSISUpdateInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Monthly/Update", params, { ...NO_RETRY });
  },

  async getMonthly(params: FSISInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryMonthlyItem[]>("/api/v1/FSISInventory/Monthly", {
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
      ...GET_RETRY,
      ...options,
    });
  }




};

