import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {
  NotificationDTO,
  NotificationDetailParams,
  NotificationDetailModel,
  NotificationLedgerParams,
  NotificationModel,
  NotificationDeleteParams,
  NotificationReadDTO,
} from "@/types/notificationType";

export const notificationAPI = {
  async create(params: NotificationDTO) {
    return await apiPost("/api/v1/Notification/Create", params, { ...NO_RETRY });
  },

  async getDetail(params?: NotificationDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<NotificationDetailModel>("/api/v1/Notification/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(params?: NotificationLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<NotificationModel[]>("/api/v1/Notification/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: NotificationDeleteParams) {
    return await apiDelete("/api/v1/Notification/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async readNotif(params: NotificationReadDTO) {
    return await apiPost("/api/v1/Notification/Read", params, { ...NO_RETRY });
  },
};
