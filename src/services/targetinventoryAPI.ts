import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { FSISInventoryDTO, TargetAccomplishmentParams, TargetAccomplishmentModel, FSISInventoryLedgerParams, FSISInventoryLedgerModel,
FSISUpdateInventoryDTO, FSISInventoryMonthlyParams, FSISInventoryMonthlyLedgerModel, FSISInventoryDeleteParams, 
ExportFSISInventoryDTO } from "@/types/targetinventoryType";

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
    // The backend expects capitalized query params and — per the working
    // reference curl — the (mis-spelled) `Pageumber` key for page number.
    const mapped = {
      Searchkey: params.searchkey ?? "",
      Stationno: params.stationno,
      Provinceno: params.provinceno,
      Reportyear: params.reportyear,
      Reportmonth: params.reportmonth,
      Pageumber: params.pagenumber,
      Pagesize: params.pagesize,
    };
    return await apiGet<FSISInventoryLedgerModel[]>("/api/v1/FSISInventory/Ledger", {
      params: mapped,
      ...GET_RETRY,
      ...options,
    });
  },

 async update(params: FSISUpdateInventoryDTO) {
    return await apiPost("/api/v1/FSISInventory/Monthly/Update", params, { ...NO_RETRY });
  },

  async getMonthly(params: FSISInventoryMonthlyParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<FSISInventoryMonthlyLedgerModel[]>("/api/v1/FSISInventory/Monthly", {
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

