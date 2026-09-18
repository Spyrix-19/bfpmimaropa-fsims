import type { AuthUser, FsimsAccess } from "@/types/authType";

/**
 * Station types that qualify as a "line" / operational station eligible to
 * mutate Target Reference and Fire Safety Compliance records.
 */
const MANAGE_STATION_TYPES = new Set([28, 29, 30, 31]);

/**
 * Permission gate for the Add / Edit / Delete actions on the Target Reference
 * and Fire Safety Compliance modules.
 *
 * Super Administrator (roleno 1) always has access.
 * Administrator (roleno 2) may manage only when stationtype ∈ {28, 29, 30, 31};
 * station types 25, 26 and 27 remain hidden.
 * Personnel (roleno 3) keep the existing management behavior.
 */
export function canManageTargetAndCompliance(
  user: AuthUser | null | undefined,
  systemAccess: FsimsAccess | null | undefined,
): boolean {
  const roleno = Number(systemAccess?.roleno ?? 0) || 0;
  const stationtype = Number(user?.stationtype ?? 0) || 0;

  if (roleno === 1) return true;
  if (roleno === 2) return MANAGE_STATION_TYPES.has(stationtype);
  return roleno === 3 && MANAGE_STATION_TYPES.has(stationtype);
}

/**
 * Station types that must never see mutating actions for roles 1 and 2.
 */
const VIEW_ONLY_STATION_TYPES = new Set([25, 26, 27]);

/**
 * Rule: hide Edit (and other mutating actions) when the user's role is
 * 1 or 2 AND their station type is 25, 26 or 27 — the action is not
 * applicable for that role/station-type combination.
 */
export function isEditRestricted(
  user: AuthUser | null | undefined,
  systemAccess: FsimsAccess | null | undefined,
): boolean {
  const roleno = Number(systemAccess?.roleno ?? 0) || 0;
  const stationtype = Number(user?.stationtype ?? 0) || 0;
  // Only Administrator (roleno === 2) is restricted for these station types.
  // Super (roleno === 1) should not be restricted.
  return roleno === 2 && VIEW_ONLY_STATION_TYPES.has(stationtype);
}

/** Convenience inverse of {@link isEditRestricted}. */
export function canShowEditAction(
  user: AuthUser | null | undefined,
  systemAccess: FsimsAccess | null | undefined,
): boolean {
  return !isEditRestricted(user, systemAccess);
}
