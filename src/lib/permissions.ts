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
 * Rule: `roleno === 3` (Personnel) AND `stationtype ∈ {28, 29, 30, 31}`.
 * Every other user must see View-only, without Add / Edit / Delete controls.
 */
export function canManageTargetAndCompliance(
  user: AuthUser | null | undefined,
  systemAccess: FsimsAccess | null | undefined,
): boolean {
  const roleno = Number(systemAccess?.roleno ?? 0) || 0;
  const stationtype = Number(user?.stationtype ?? 0) || 0;
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
  return (roleno === 1 || roleno === 2) && VIEW_ONLY_STATION_TYPES.has(stationtype);
}

/** Convenience inverse of {@link isEditRestricted}. */
export function canShowEditAction(
  user: AuthUser | null | undefined,
  systemAccess: FsimsAccess | null | undefined,
): boolean {
  return !isEditRestricted(user, systemAccess);
}
