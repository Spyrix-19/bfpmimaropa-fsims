/**
 * Backend envelope helper.
 *
 * Our backend returns a standard envelope:
 * {
 *   statusCode, isSuccess, errorMessages,
 *   draw, recordsTotal, recordsFiltered,
 *   pageNumber, pageSize, totalPages,
 *   data
 * }
 *
 * Our `apiGet/apiPost/...` wrappers expose `response.data` as that entire
 * envelope. These helpers make it easy to pull the inner payload + paging info.
 */

export const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

export interface Envelope<T> {
  statusCode: number;
  isSuccess: boolean;
  errorMessages: string;
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  data: T;
}

/**
 * Generic user-facing fallback. We deliberately avoid surfacing raw axios,
 * network, or stack-trace strings — only the API envelope's `errorMessages`
 * field is considered safe to display to end users, and even then it is
 * sanitized so system-level leaks (stack traces, exception names, DB errors)
 * never reach the UI.
 */
import { ApiMessages, sanitizeEnvelopeMessage } from "@/lib/api-messages";
const GENERIC_ERROR_MESSAGE = ApiMessages.UNKNOWN;

export function unwrap<T>(
  resp:
    | { data: unknown; canceled?: boolean; isSuccess?: boolean; errorMessages?: string; statusCode?: number }
    | null
    | undefined,
): {
  ok: boolean;
  canceled: boolean;
  data: T | null;
  total: number;
  totalPages: number;
  pageNumber: number;
  pageSize: number;
  error: string;
} {
  const canceled = !!resp?.canceled;
  const env = (resp?.data ?? null) as Envelope<T> | null;
  if (!env) {
    // No envelope body: fall back to the transport-level ApiResponse fields so
    // the user sees the real reason (timeout, network, 4xx/5xx) instead of a
    // blanket "Something went wrong".
    const transportError = sanitizeEnvelopeMessage(
      typeof resp?.errorMessages === "string" ? resp.errorMessages : "",
      resp?.statusCode ?? 0,
    );
    return {
      ok: false,
      canceled,
      data: null,
      total: 0,
      totalPages: 0,
      pageNumber: 1,
      pageSize: 0,
      error: canceled ? "" : transportError || GENERIC_ERROR_MESSAGE,
    };
  }
  const rawError = typeof env.errorMessages === "string" ? env.errorMessages : "";
  const status = (env as unknown as { statusCode?: number })?.statusCode ?? 0;
  return {
    ok: !!env.isSuccess,
    canceled,
    data: (env.data ?? null) as T | null,
    total: env.recordsTotal ?? 0,
    totalPages: env.totalPages ?? 0,
    pageNumber: env.pageNumber ?? 1,
    pageSize: env.pageSize ?? 0,
    error: env.isSuccess ? "" : sanitizeEnvelopeMessage(rawError, status),
  };
}
