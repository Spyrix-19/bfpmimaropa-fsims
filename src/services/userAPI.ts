import { apiPost, apiGet, NO_RETRY, GET_RETRY } from "@/lib/api";
import { ActivateUserAccessRoleDTO, DeactivateUserAccessRoleDTO, UserAccountRoleDTO, UserModel, UserParams, UserStationOfficeDTO } from "@/types/userType";

export const userAPI = {
  async activate(params: ActivateUserAccessRoleDTO) {
    return await apiPost("/api/v1/User/AccessRole/Activate", params, { ...NO_RETRY });
  }, 
  
  async deactivate(params: DeactivateUserAccessRoleDTO) {
    return await apiPost("/api/v1/User/AccessRole/Deactivate", params, { ...NO_RETRY });
  }, 

  async updateStation(params: UserStationOfficeDTO) {
    return await apiPost("/api/v1/User/Station/Update", params, { ...NO_RETRY });
  },

  async UpdateAccountRole(params: UserAccountRoleDTO) {
    return await apiPost("/api/v1/User/AccountRole/Update", params, { ...NO_RETRY });
  },

  async getLedger(params?: UserParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<UserModel[]>("/api/v1/User/Access/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getActivatedLedger(params?: UserParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<UserModel[]>("/api/v1/User/Access/Activated", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

};
