import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import { toast } from "@/lib/toast";
import { loadingBus } from "@/lib/loading-bus";

/* =========================
   BASE CONFIG
========================= */

// All requests now hit the external API directly (VITE_BFP_MIMAROPA_API_BASE_URL).
// The same-origin proxy under api/ is intentionally kept in the repo so that
// re-enabling proxied endpoints (e.g. to hide credentials server-side) is a
// one-line change: add the path to PROXY_ONLY_PATHS. Empty by default.
const EXTERNAL_API_BASE_URL = (
  (import.meta.env?.VITE_BFP_MIMAROPA_API_BASE_URL as string | undefined) ??
  "https://bfpr4bv3-api.onrender.com"
).replace(/\/$/, "");
const PROXY_ONLY_PATHS: string[] = [];
const API_BASE_URL = "/";

/* =========================
   RETRY PRESETS
========================= */

export interface ApiOptions<TParams = unknown> {
  headers?: Record<string, string>;
  params?: TParams;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
  // progress callback receives percent 0-100 for uploads
  progressCallback?: (percent: number) => void;
  // When true, don't show the global blocking loading overlay. Components
  // that render their own local loading UI (modals, dropdowns) should set
  // this to avoid the full-screen overlay.
  suppressGlobalLoading?: boolean;
  // When true, skip the wrapper-level error toast so the caller can show a
  // more contextual message instead.
  suppressErrorToast?: boolean;
  // Optional AbortSignal — pass from a component to cancel the request on
  // unmount and stop the loading bus / retry loop.
  signal?: AbortSignal;
  // When true, disable the in-flight GET dedupe for this call (rarely
  // needed — force-refresh scenarios).
  noDedupe?: boolean;
}

/* Retry presets */
export const NO_RETRY: ApiOptions = {
  retries: 0,
};

export const GET_RETRY: ApiOptions = {
  retries: 3,
  retryDelayMs: 500,
};

export const MUTATION_RETRY_LIGHT: ApiOptions = {
  retries: 1,
  retryDelayMs: 300,
};

export const AGGRESSIVE_RETRY: ApiOptions = {
  retries: 5,
  retryDelayMs: 1000,
};

/* =========================
   API RESPONSE TYPE
========================= */

export interface ApiResponse<T = unknown> {
  statusCode: number;
  isSuccess: boolean;
  errorMessages: string;
  data: T | null;
  /** True when the request was aborted by the caller's AbortSignal. */
  canceled?: boolean;
}

/* =========================
   AXIOS INSTANCE
========================= */

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================
   AUTH INTERCEPTOR
========================= */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Route every request directly to the external API, EXCEPT for endpoints
  // that must stay on the same-origin proxy (e.g. /api/auth/login).
  const rawUrl = config.url ?? "";
  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  if (!isAbsolute) {
    const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
    const useProxy = PROXY_ONLY_PATHS.some(
      (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`),
    );
    if (!useProxy) {
      config.baseURL = EXTERNAL_API_BASE_URL;
      config.url = path;
    } else {
      config.baseURL = "/";
      config.url = path;
    }
  }

  return config;
});

/* =========================
   HELPERS
========================= */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isCanceled = (error: AxiosError) =>
  error?.code === "ERR_CANCELED" ||
  (error as unknown as { name?: string })?.name === "CanceledError";

/** Timeout / cold-start style failures — always worth retrying with backoff. */
const isTimeoutError = (error: AxiosError) =>
  error?.code === "ECONNABORTED" ||
  error?.code === "ETIMEDOUT" ||
  error.response?.status === 408 ||
  error.response?.status === 504;

const shouldRetry = (error: AxiosError) => {
  if (isCanceled(error)) return false;

  const status = error.response?.status;

  // No HTTP response received at all (network failure, DNS issue, CORS block, timeout)
  if (!status) return true;

  return [
    408, // Request Timeout → server did not receive request in time
    429, // Too Many Requests → rate limited (retry after delay often works)
    500, // Internal Server Error → generic backend crash
    502, // Bad Gateway → upstream server failed (proxy/load balancer issue)
    503, // Service Unavailable → server temporarily down or overloaded
    504, // Gateway Timeout → upstream server didn’t respond in time
  ].includes(status);
};

/* =========================
   TRANSPORT ERROR INTERCEPTOR
   -------------------------
   ONE place decides whether the user sees a "can't reach the server" toast.
   Several dashboard panels fire in parallel; without this, each failure
   raised its own banner. The sonner id collapses duplicates and the time
   window prevents a new banner for every retry / sibling request.
========================= */

const TRANSPORT_TOAST_WINDOW_MS = 10000;
let lastTransportToastAt = 0;

type TrackedConfig = AxiosRequestConfig & {
  __suppressErrorToast?: boolean;
  /** Correlates an axios error back to its live retry state. */
  __rid?: string;
};

/** rid -> retry attempts still available. Axios clones config per attempt, so
 *  the live counter lives here instead of on the config object. */
const attemptsLeftByRid = new Map<string, number>();
let ridSeq = 0;
const nextRid = () => `r${++ridSeq}`;

const notifyTransportError = (error: AxiosError) => {
  const cfg = (error.config ?? {}) as TrackedConfig;
  if (cfg.__suppressErrorToast) return;
  // Don't warn while the request will still be retried (Render cold starts).
  const attemptsLeft = cfg.__rid ? (attemptsLeftByRid.get(cfg.__rid) ?? 0) : 0;
  if (attemptsLeft > 0) return;

  const now = Date.now();
  if (now - lastTransportToastAt < TRANSPORT_TOAST_WINDOW_MS) return;
  lastTransportToastAt = now;

  toast.error(fallbackMessageForStatus(0), { id: "api-network-error" });
};

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (!isCanceled(error) && !error.response) notifyTransportError(error);
    return Promise.reject(error);
  },
);

/* =========================
   RETRY WRAPPER (exponential backoff + jitter)
========================= */

const MAX_RETRY_DELAY_MS = 8000;

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 400,
  rid?: string,
): Promise<T> => {
  let lastError: unknown;

  for (let i = 0; i <= retries; i++) {
    if (rid) attemptsLeftByRid.set(rid, retries - i);

    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const axiosError = err as AxiosError;

      if (i < retries && shouldRetry(axiosError)) {
        // Timeouts (Render cold start) get a longer ramp before retrying.
        const base = isTimeoutError(axiosError) ? Math.max(delay, 1000) : delay;
        const backoff = Math.min(base * Math.pow(2, i), MAX_RETRY_DELAY_MS);
        await sleep(backoff + Math.random() * 250); // jitter avoids thundering herd
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
};

/* =========================
   RESPONSE NORMALIZER
========================= */

const normalizeResponse = <T>(res: { status: number; data?: T }): ApiResponse<T> => ({
  statusCode: res.status,
  isSuccess: true,
  errorMessages: "",
  data: res.data ?? null,
});

// Generic, user-safe fallback. We never surface raw axios/network/stack
// messages to the UI because they can leak backend hostnames, stack frames,
// SQL fragments, or other sensitive details. Only the API envelope's
// `errorMessages` field is considered safe to display — and only after
// sanitization. The backend's `InnerMessage` is intentionally IGNORED.
import { ApiMessages, fallbackMessageForStatus, sanitizeEnvelopeMessage } from "@/lib/api-messages";

const GENERIC_ERROR_MESSAGE = ApiMessages.UNKNOWN;

const normalizeError = <T>(error: AxiosError, options?: ApiOptions): ApiResponse<T> => {
  const data = error.response?.data as Record<string, unknown> | undefined;
  const status = error.response?.status ?? 0;

  // ONLY trust `errorMessages` from our backend envelope. Everything else
  // (axios `error.message`, upstream `data.message`, `InnerMessage`, stack
  // traces, etc.) is discarded so the end user cannot see internals.
  const envelopeMessage =
    typeof data?.errorMessages === "string" ? (data.errorMessages as string) : "";

  // Sanitize: if the envelope message itself looks system-level (stack trace,
  // .NET exception name, DB error), swap it for a safe status-based fallback.
  const message = sanitizeEnvelopeMessage(envelopeMessage, status);

  // Transport-level failures (no response, timeout, network) are reported by
  // the single axios response interceptor above — never here, so parallel
  // requests can't stack duplicate banners.

  return {
    statusCode: status,
    isSuccess: false,
    errorMessages: message || GENERIC_ERROR_MESSAGE,
    data: null,
  };
};

/* =========================
   CORE REQUEST
========================= */

/* =========================
   IN-FLIGHT GET DEDUPE
   -------------------------
   Concurrent identical GETs (StrictMode double-mount, sibling components
   fetching the same endpoint) share a single promise. Keyed by
   method+url+sorted-params. POST/PUT/PATCH/DELETE are never deduped.
========================= */
const inflight = new Map<string, Promise<ApiResponse<unknown>>>();

const dedupeKey = (method: string, url: string, params: unknown): string => {
  let paramStr = "";
  if (params && typeof params === "object") {
    try {
      const entries = Object.entries(params as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      paramStr = JSON.stringify(entries);
    } catch {
      paramStr = "";
    }
  }
  return `${method} ${url} ${paramStr}`;
};

const canceledResponse = <T>(): ApiResponse<T> => ({
  statusCode: 0,
  isSuccess: false,
  errorMessages: "",
  data: null,
  canceled: true,
});

const request = async <T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<ApiResponse<T>> => {
  // In-flight dedupe for GET only.
  if (method === "GET" && !options?.noDedupe) {
    const key = dedupeKey(method, url, options?.params);
    // The shared request must NOT be tied to a single caller's AbortSignal —
    // otherwise one consumer unmounting (e.g. React StrictMode's first mount)
    // cancels the request that every other consumer is awaiting.
    const { signal, ...shared } = options ?? {};
    let p = inflight.get(key) as Promise<ApiResponse<T>> | undefined;
    if (!p) {
      p = doRequest<T>(method, url, body, shared).finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, p as Promise<ApiResponse<unknown>>);
    }
    if (!signal) return p;
    if (signal.aborted) return canceledResponse<T>();
    // Per-caller cancellation: resolve early with a canceled envelope while
    // the shared request keeps running for the remaining consumers.
    return Promise.race([
      p,
      new Promise<ApiResponse<T>>((resolve) => {
        signal.addEventListener("abort", () => resolve(canceledResponse<T>()), { once: true });
      }),
    ]);
  }
  return doRequest<T>(method, url, body, options);
};

const doRequest = async <T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  options?: ApiOptions,
): Promise<ApiResponse<T>> => {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, unknown> = { ...(options?.headers ?? {}) };
  if (isFormData) {
    headers["Content-Type"] = undefined;
  }

  const rid = nextRid();
  const config: TrackedConfig = {
    __rid: rid,
    method,

    url,
    params: options?.params,
    data: body,
    headers: headers as AxiosRequestConfig["headers"],
    timeout: options?.timeout ?? (isFormData ? 120000 : 30000),
    signal: options?.signal,
    // Read by the transport-error interceptor so exactly one place decides
    // whether a toast is shown.
    __suppressErrorToast: options?.suppressErrorToast,
    onUploadProgress: (ev: any) => {
      try {
        const cb = options?.progressCallback;
        if (!cb) return;
        const loaded = ev?.loaded ?? ev?.progress?.loaded;
        const total = ev?.total ?? ev?.progress?.total;
        if (!loaded || !total) return;
        const percent = Math.round((loaded / total) * 100);
        cb(percent);
      } catch {
        // ignore
      }
    },
  };

  const retries = options?.retries ?? 2;
  const retryDelay = options?.retryDelayMs ?? 400;
  const showLoading = !options?.suppressGlobalLoading;
  if (showLoading) loadingBus.start();
  try {
    const response = await withRetry(() => api.request<T>(config), retries, retryDelay, rid);

    return normalizeResponse<T>(response);
  } catch (error) {
    // Silently return a canceled envelope on abort so callers don't toast.
    const ax = error as AxiosError;
    if (ax?.code === "ERR_CANCELED" || (ax as any)?.name === "CanceledError") {
      return canceledResponse<T>();
    }
    return normalizeError<T>(ax, options);
  } finally {
    attemptsLeftByRid.delete(rid);
    if (showLoading) loadingBus.stop();
  }
};

/* =========================
   PUBLIC METHODS
========================= */

export const apiGet = <T = unknown, P = unknown>(url: string, options?: ApiOptions<P>) =>
  request<T>("GET", url, undefined, options as ApiOptions);

export const apiPost = <T = unknown>(url: string, body?: unknown, options?: ApiOptions) =>
  request<T>("POST", url, body, options);

export const apiPut = <T = unknown>(url: string, body?: unknown, options?: ApiOptions) =>
  request<T>("PUT", url, body, options);

export const apiPatch = <T = unknown>(url: string, body?: unknown, options?: ApiOptions) =>
  request<T>("PATCH", url, body, options);

/* IMPORTANT: DELETE supports body (many APIs require it) */
export const apiDelete = <T = unknown>(url: string, body?: unknown, options?: ApiOptions) =>
  request<T>("DELETE", url, body, options);

/* =========================
   EXPORTS
========================= */

export { API_BASE_URL, api };
