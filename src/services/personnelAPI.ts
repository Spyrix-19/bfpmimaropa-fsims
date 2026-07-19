import { apiPost, apiGet, apiDelete, NO_RETRY, GET_RETRY, MUTATION_RETRY_LIGHT } from "@/lib/api";
import type {
  UpdateMemberStatusDTO,
  UploadMemberProfileDTO,
  MemberDetailParams,
  MemberDetailModel,
  MemberInfoDTO,
  MemberEmploymentDTO,
  MemberProfileDeleteParams,
  ActivateMemberPasswordDTO,
  UnLockMemberPasswordDTO,
  UpdateMemberPasswordDTO,
  UpdatePasswordExpiryDTO,
  ResetMemberPasswordDTO,
  SearchMemberParams,
  SearchMemberModel,
} from "@/types/personnelType";


export const personnelAPI = {
 

  async UpdateInfo(params: MemberInfoDTO) {
    return await apiPost("/api/v1/Personnel/Info/Update", params, { ...NO_RETRY });
  },

  async UpdateEmployment(params: MemberEmploymentDTO) {
    return await apiPost("/api/v1/Personnel/Employment/Update", params, { ...NO_RETRY });
  },

  async UpdateStatus(params: UpdateMemberStatusDTO) {
    return await apiPost("/api/v1/Personnel/Status/Update", params, { ...NO_RETRY });
  },

  async Activate(params: ActivateMemberPasswordDTO) {
    return await apiPost("/api/v1/Personnel/Activate", params, { ...NO_RETRY });
  },

  async Unlock(params: UnLockMemberPasswordDTO) {
    return await apiPost("/api/v1/Personnel/Unlock", params, { ...NO_RETRY });
  },

  async resetPassword(params: ResetMemberPasswordDTO) {
    return await apiPost("/api/v1/Personnel/Password/Reset", params, { ...NO_RETRY });
  },

  async updatePassword(params: UpdateMemberPasswordDTO) {
    return await apiPost("/api/v1/Personnel/Password/Update", params, { ...NO_RETRY });
  },

  async updatePasswordExpiry(params: UpdatePasswordExpiryDTO) {
    return await apiPost("/api/v1/Personnel/PasswordExpiry/Update", params, { ...NO_RETRY });
  },

  async uploadProfile(params: UploadMemberProfileDTO, options?: import("@/lib/api").ApiOptions) {
    // The C# endpoint uses [FromForm] + [Consumes("multipart/form-data")], so we
    // MUST send a multipart FormData body. Sending JSON causes HTTP 415.
    const form = new FormData();
    form.append("Memberno", String(params.memberno ?? ""));
    form.append("Badgeno", String(params.badgeno ?? ""));
    form.append("File", params.file, params.file.name);
    form.append("Updatedby", String(params.updatedby ?? ""));
    return await apiPost("/api/v1/Personnel/Profile/Upload", form, { ...NO_RETRY, ...options });
  },

  async deleteProfile(params: MemberProfileDeleteParams, options?: import("@/lib/api").ApiOptions) {
    return await apiDelete("/api/v1/Personnel/Profile/Delete", {
      params,
      ...MUTATION_RETRY_LIGHT,
      ...options,
    });
  },

  async getDetails(params?: MemberDetailParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<MemberDetailModel[]>("/api/v1/Personnel/Details", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

  async search(params?: SearchMemberParams, options?: import("@/lib/api").ApiOptions) {
    return await apiGet<SearchMemberModel[]>("/api/v1/Personnel/Search", {
      params,
      ...GET_RETRY,
      ...options,
    });
  },

};
