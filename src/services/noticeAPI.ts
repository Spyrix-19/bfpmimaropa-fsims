import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";

import { ExportNoticeDTO, FSISNoticeDeleteParams, FSISNoticeDetailByDateParams, FSISNoticeDetailParams, FSISNoticeDTO, NoticeDetailModel, NoticeLedgerParams } from "@/types/noticeType";

export const noticeAPI = {

  async create(params: FSISNoticeDTO) {
    return await apiPost("/api/v1/FSISNotice/Create", params, { ...NO_RETRY });
  },  

async getDetailBydate(
    params?: FSISNoticeDetailByDateParams, options?: import("@/lib/api").ApiOptions ) {
    return await apiGet<NoticeDetailModel>("/api/v1/FSISNotice/Detail/Date", { 
      params, 
      ...GET_RETRY, 
      ...options 
    });
  },

  async getDetail(params?: FSISNoticeDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<NoticeDetailModel>("/api/v1/FSISNotice/Detail", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async getLedger(
    request: NoticeLedgerParams,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost<NoticeDetailModel[]>(
      "/api/v1/FSISNotice/Ledger",
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

  async delete(params?: FSISNoticeDeleteParams) {
    return await apiDelete("/api/v1/FSISNotice/Delete", undefined, {
      params,
      ...MUTATION_RETRY_LIGHT,
    });
  },

  async export(
    body: ExportNoticeDTO,
    options?: import("@/lib/api").ApiOptions
  ) {
    return await apiPost("/api/v1/FSISNotice/Export", body, {
      ...GET_RETRY,
      ...options,
    });
  }

  
};
