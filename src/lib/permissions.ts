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
