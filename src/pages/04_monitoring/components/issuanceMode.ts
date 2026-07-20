/**
 * Shared helpers for the "Mode of Issuance" (FSIS ISSUANCE gentable) picker
 * used by both the FSC Add screen (`monitoringNew.tsx`) and the FSC Edit
 * modal (`monitoringEdit.tsx`).
 *
 * The gentable's `detno` for the selected row is what the API stores as
 * `fsicmode` on every daily record.
 */

export type IssuanceGroup = "FSEC" | "FSIC" | "OTHERS" | null;

/**
 * Infer which activity group the selected FSIS Issuance mode unlocks.
 * Matches by recordcode first, then falls back to description keywords.
 */
export function inferIssuanceGroup(code: string, description: string): IssuanceGroup {
  const hay = `${code} ${description}`.toUpperCase();
  if (hay.includes("FSEC")) return "FSEC";
  if (hay.includes("FSIC")) return "FSIC";
  if (hay.includes("NOTICE") || hay.includes("OTHER") || hay.includes("ENFORCE")) return "OTHERS";
  return null;
}

export const FSIS_ISSUANCE_TABLE = "FSIS ISSUANCE";
