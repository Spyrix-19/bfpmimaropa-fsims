import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import {
  AnnouncementDeleteParams,
  AnnouncementLedgerModel,
  AnnouncementLedgerParams,
  AnnouncementMemberParams,
  AnnouncementReadDTO,
  AnnouncementRequestDTO,
} from "@/types/announcementType";

export const announcementAPI = {
  async create(params: AnnouncementRequestDTO) {
    return await apiPost("/api/v1/Announcement/Create", params, { ...NO_RETRY });
  },

  async getDetail(params?: AnnouncementLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<AnnouncementLedgerModel>("/api/v1/Announcement/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(params?: AnnouncementLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<AnnouncementLedgerModel[]>("/api/v1/Announcement/Ledger", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async delete(params?: AnnouncementDeleteParams) {
    return await apiDelete("/api/v1/Announcement/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async Read(params: AnnouncementReadDTO) {
    return await apiPost("/api/v1/Announcement/Read", params, { ...NO_RETRY });
  },

  async ReadAll(params: AnnouncementMemberParams) {
    return await apiPost("/api/v1/Announcement/ReadAll", params, { ...NO_RETRY });
  },

  async UnreadCount(params?: AnnouncementMemberParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<number>("/api/v1/Announcement/UnreadCount", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },
};
