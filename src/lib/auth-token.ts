/**
 * In-memory holders for the access token and role code.
 *
 * Nothing here is persisted: the API interceptor and the top-level error
 * boundary read from memory instead of reading raw browser storage.
 */

let accessToken: string | null = null;
let roleCode: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token && token.trim() ? token : null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setCachedRoleCode(code: string | null) {
  roleCode = code ? code.toUpperCase() : null;
}

export function getCachedRoleCode(): string | null {
  return roleCode;
}
