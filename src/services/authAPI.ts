import { apiPost, type ApiOptions, NO_RETRY } from "@/lib/api";
import type { Envelope } from "@/lib/api-envelope";
import type {
  LoginDTO,
  AuthApiResponse,
  UpdateMemberPasswordDTO,
  SendOtpRequestDTO,
  VerifyOtpRequestDTO,
  SendOtpResult,
  VerifyOtpResult,
} from "@/types/authType";

const AUTH_ENV = {
  clientId: (import.meta.env?.VITE_BFP_MIMAROPA_CLIENT_ID as string | undefined) ?? "",
  clientSecret: (import.meta.env?.VITE_BFP_MIMAROPA_CLIENT_SECRET as string | undefined) ?? "",
  grantType: (import.meta.env?.VITE_BFP_MIMAROPA_GRANT_TYPE as string | undefined) ?? "PASSWORD",
  loginType:
    (import.meta.env?.VITE_BFP_MIMAROPA_LOGIN_TYPE as string | undefined) ?? "BFP MIMAROPA AMS",
};

const LOGIN_REQUEST_OPTIONS: ApiOptions = {
  // The backend can take a moment to wake up on the first request after a cold start,
  // so allow a slightly longer timeout and a couple of retries before surfacing a failure.
  timeout: 30000,
  retries: 3,
  retryDelayMs: 400,
  suppressErrorToast: true,
};

export const authAPI = {
  async login(params: LoginDTO, options?: ApiOptions) {
    const body = {
      ...params,
      client_id: AUTH_ENV.clientId,
      client_secret: AUTH_ENV.clientSecret,
      grant_type: AUTH_ENV.grantType,
      login_type: AUTH_ENV.loginType,
    };
    return await apiPost<AuthApiResponse>("/api/v1/Auth/Login", body, {
      ...LOGIN_REQUEST_OPTIONS,
      ...options,
    });
  },

  async updatePassword(params: UpdateMemberPasswordDTO, options?: ApiOptions) {
    return await apiPost("/api/v1/Auth/Password/Update", params, {
      timeout: 10000,
      retries: 0,
      suppressErrorToast: true,
      ...options,
    });
  },

  async sendOtp(params: SendOtpRequestDTO, options?: ApiOptions) {
    return await apiPost<Envelope<SendOtpResult | null>>("/api/v1/Auth/SendOtp", params, {
      timeout: 30000,
      retries: 0,
      suppressErrorToast: true,
      ...options,
    });
  },

  async verifyOtp(params: VerifyOtpRequestDTO, options?: ApiOptions) {
    return await apiPost<Envelope<VerifyOtpResult | null>>("/api/v1/Auth/VerifyOtp", params, {
      ...NO_RETRY,
      suppressErrorToast: true,
      ...options,
    });
  },
};
