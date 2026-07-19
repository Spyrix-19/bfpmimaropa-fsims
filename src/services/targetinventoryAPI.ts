import { apiPost, apiGet, NO_RETRY, GET_RETRY } from "@/lib/api";
import {
  FSISInventoryDTO,
  TargetAccomplishmentParams,
  TargetAccomplishmentModel,
  FSISInventoryLedgerParams,
  FSISInventoryLedgerItem,
  FSISInventoryMonthlyParams,
  FSISInventoryMonthlyItem,
} from "@/types/targetinventoryType";

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

  async getLedger(params: FSISInventoryLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryLedgerItem[]>("/api/v1/FSISTargetReference/Ledger", {
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

  async getMonthly(params: FSISInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryMonthlyItem[]>("/api/v1/FSISInventory/Monthly", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },
};

