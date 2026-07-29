/**
 * Centralized, user-safe error messages.
 *
 * These mirror the backend's canonical messages so the UI never leaks
 * system/internal details (stack traces, DB errors, upstream host names,
 * InnerMessage, etc.). We ONLY surface:
 *   1. The API envelope's `errorMessages` field (custom, business-level
 *      errors like "duplicate entry" that are safe to show), OR
 *   2. One of these generic constants — chosen by HTTP status.
 *
 * Never display `InnerMessage`, axios `error.message`, or raw response
 * bodies.
 */

export const ApiMessages = {
  INVALID_SESSION: "Your session has expired for your security.",
  INVALID_MODEL: "Request validation failed. Please check invalid parameters.",
  API_ERR: "API error. Please try again.",
  UNKNOWN: "Something went wrong. Please try again.",
  API_JSON: "Something went wrong while processing the server response. Please try again.",
  DB_CONNECTION: "Unable to connect to the database. Please try again later.",
  USER_ACCESS:
    "Your user accessibility does not allow you to access this feature. Please consult MIS/IT for assistance.",
  NETWORK: "Unable to reach the server. Please check your connection and try again.",
} as const;

/**
 * Pick a safe fallback message based on HTTP status. Used only when the API
 * envelope did not provide a custom `errorMessages` value.
 */
export function fallbackMessageForStatus(status: number): string {
  if (!status) return ApiMessages.NETWORK;
  if (status === 400 || status === 422) return ApiMessages.INVALID_MODEL;
  if (status === 401) return ApiMessages.INVALID_SESSION;
  if (status === 403) return ApiMessages.USER_ACCESS;
  if (status === 408 || status === 504) return ApiMessages.NETWORK;
  if (status === 502 || status === 503) return ApiMessages.DB_CONNECTION;
  if (status >= 500) return ApiMessages.API_ERR;
  if (status >= 400) return ApiMessages.API_ERR;
  return ApiMessages.UNKNOWN;
}

/**
 * List of substrings that indicate a message is system-level / unsafe to
 * display. If the envelope's `errorMessages` matches any of these, we
 * replace it with a generic message.
 */
const SYSTEM_LEAK_PATTERNS: RegExp[] = [
  /\bat\s+[\w.$<>]+\s*\(/i, // stack frames like "at Foo.bar ("
  /System\.[A-Z]\w+Exception/i, // .NET exceptions
  /NullReferenceException/i,
  /SqlException/i,
  /Microsoft\.\w+/i,
  /Npgsql/i,
  /Stack trace/i,
  /InnerException/i,
  /\bTraceId\b/i,
  /Object reference not set/i,
  /Exception of type/i,
  /Unhandled exception/i,
  /\binner(?:message|messages)?\b/i,
  /\b(exception|stacktrace|stack trace)\b/i,
  /\b(sql|postgres|postgresql|entity framework|connection string|data source|database name|table name|column name|stored procedure|authorization internals|authentication internals)\b/i,
  /\b(?:http|https):\/\//i,
  /^\s*\{[\s\S]*\}\s*$/, // raw JSON blobs
  /^\s*\[[\s\S]*\]\s*$/, // raw arrays / payload dumps
  /<!DOCTYPE html/i, // HTML error pages
];

export function isSystemLeakMessage(msg: string): boolean {
  if (!msg) return false;
  return SYSTEM_LEAK_PATTERNS.some((re) => re.test(msg));
}

/**
 * Sanitize an envelope error message. If it looks like a system-level
 * message (stack trace, exception name, etc.), swap it for a safe fallback.
 * Otherwise return the original — those are custom, business messages the
 * backend intentionally exposes (e.g. "Duplicate badge number").
 */
export function sanitizeEnvelopeMessage(
  msg: string | null | undefined,
  status = 0,
): string {
  const trimmed = (msg ?? "").trim();
  if (!trimmed) return fallbackMessageForStatus(status);

  const normalized = trimmed.replace(/\s+/g, " ").trim();
  if (!normalized) return fallbackMessageForStatus(status);
  if (isSystemLeakMessage(normalized)) return fallbackMessageForStatus(status);
  return normalized;
}

/**
 * Extract a user-safe error message from an ApiResponse-like object.
 * Only reads the `errorMessages` field (never `innerMessage` or raw errors),
 * runs it through the sanitizer, and falls back to a status-based generic
 * message. Use this in components that need to display an API error.
 */
export function getSafeErrorMessage(
  res: { errorMessages?: string | null; statusCode?: number } | null | undefined,
): string {
  if (!res) return ApiMessages.UNKNOWN;
  return sanitizeEnvelopeMessage(res.errorMessages ?? "", res.statusCode ?? 0);
}

/**
 * True when the message is one of the blanket fallbacks (or empty), meaning the
 * caller should substitute a contextual, feature-specific message instead.
 */
export function isGenericError(message?: string | null): boolean {
  if (!message) return true;
  return message === ApiMessages.UNKNOWN || message === ApiMessages.API_JSON || message === ApiMessages.API_ERR;
}
