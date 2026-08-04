import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import type {
  ExportNoticeDTO,
  FSISNoticeDeleteParams,
  FSISNoticeDetailByDateParams,
  FSISNoticeDetailParams,
  FSISNoticeDTO,
  NoticeDetailModel,
  NoticeLedgerParams,
} from "@/types/noticeType";

export const noticeAPI = {
  async create(params: FSISNoticeDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost("/api/v1/FSISNotice/Create", params, { ...NO_RETRY, ...options });
  },

  async getDetailBydate(
    params?: FSISNoticeDetailByDateParams,
    options?: import("@/lib/api").ApiOptions,
  ) {
    return await apiGet<NoticeDetailModel>("/api/v1/FSISNotice/Detail/Date", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getDetail(params?: FSISNoticeDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<NoticeDetailModel>("/api/v1/FSISNotice/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(request: NoticeLedgerParams, options?: import("@/lib/api").ApiOptions) {
    return await apiPost<NoticeDetailModel[]>("/api/v1/FSISNotice/Ledger", request.parameters, {
      params: {
        Pagenumber: request.pagenumber ?? 1,
        Pagesize: request.pagesize ?? 10,
      },
      ...options,
    });
  },

  async delete(params?: FSISNoticeDeleteParams, options?: import("@/lib/api").ApiOptions) {
    return await apiDelete("/api/v1/FSISNotice/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
      ...options,
    });
  },

  async export(body: ExportNoticeDTO, options?: import("@/lib/api").ApiOptions) {
    return await apiPost("/api/v1/FSISNotice/Export", body, {
      ...GET_RETRY,
      ...options,
    });
  },

  async getNoticeTypes(options?: import("@/lib/api").ApiOptions) {
    const endpoints = [
      "/api/v1/NoticeType/Search",
      "/api/v1/FSISNoticeType/Search",
      "/api/v1/NoticeType/List",
      "/api/v1/FSISNoticeType/List",
    ];
    const errors: string[] = [];
    for (const endpoint of endpoints) {
      try {
        const response = await apiGet<unknown[]>(endpoint, { ...GET_RETRY, ...options });
        if (response?.isSuccess) {
          return response;
        }
        const message = response?.errorMessages || response?.statusCode?.toString();
        if (message) errors.push(String(message));
      } catch (error) {
        errors.push(String(error));
      }
    }
    return {
      statusCode: 0,
      isSuccess: false,
      errorMessages: errors[0] || "Unable to load notice types.",
      data: null,
    };
  },
};
