/**
 * Local helpers for the Target Reference module — buckets the backend
 * `targetreferencelist` (TargetReferenceClassModel[]) into BPLO / Gov /
 * PEZA / TIEZA cells for the on-screen tables.
 *
 * These live in the module (not in a shared types file) so the module
 * has no dependency on the mock TargetReferenceModel used by Monitoring.
 */

import type { TargetReferenceClassModel } from "@/types/targetreferenceType";
import type { AuthUser } from "@/types/authType";
import { resolveLocationScope } from "@/lib/auth";

/* ------------------------------------------------------------------ *
 * Role-based scope resolver
 * Consumes the authenticated user directly (no aliasing).
 *
 *   roleno 1 or 2, type 25/26 -> province & station fully editable
 *   roleno 1 or 2, type 27    -> province LOCKED to login.provinceno,
 *                               station remains searchable within it
 *   roleno 1 or 2, type 28..31-> both province & station LOCKED to login
 *   roleno 3, type 25..31      -> both province & station LOCKED to login
 * ------------------------------------------------------------------ */
export interface TargetScope {
  roleno: number;
  stationtype: number;
  /** Effective province (GUID string) — always populated when locked. */
  provinceno: string;
  /** Effective station (GUID string) — populated when locked. */
  stationno: string;
  provinceLocked: boolean;
  stationLocked: boolean;
  /** Display labels for read-only fields. */
  provincename: string;
  stationname: string;
}

export function resolveTargetScope(
  user: Pick<AuthUser, "provinceno" | "provincename" | "stationno" | "stationname" | "stationtype"> | null | undefined,
  roleno: number | null | undefined,
): TargetScope {
  const scope = resolveLocationScope(user as AuthUser | null | undefined, roleno);
  return {
    roleno: scope.roleno,
    stationtype: scope.stationtype,
    provinceno: scope.provinceno,
    stationno: scope.stationno,
    provinceLocked: scope.provinceLocked,
    stationLocked: scope.stationLocked,
    provincename: scope.provincename,
    stationname: scope.stationname,
  };
}

/* ------------------------------------------------------------------ *
 * Month-locking helper (Edit only).
 * Returns true when the given report month should be non-editable.
 * ------------------------------------------------------------------ */
export function isReportMonthLocked(reportYear: number, reportMonth: number, now: Date = new Date()) {
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  const y = Number(reportYear) || 0;
  const m = Number(reportMonth) || 0;
  if (y < cy) return true;
  if (y > cy) return false;
  return m < cm;
}


export type TargetPeriod = "MONTHLY" | "QUARTERLY" | "SEMI-ANNUAL" | "ANNUAL";

export const PERIOD_OPTIONS: { value: TargetPeriod; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMI-ANNUAL", label: "Semi-Annual" },
  { value: "ANNUAL", label: "Annual" },
];

export interface TargetBucket {
  bplo: number;
  gov: number;
  peza: number;
  tieza: number;
}

export const emptyBucket = (): TargetBucket => ({ bplo: 0, gov: 0, peza: 0, tieza: 0 });

export const addBucket = (a: TargetBucket, b: TargetBucket): TargetBucket => ({
  bplo: a.bplo + b.bplo,
  gov: a.gov + b.gov,
  peza: a.peza + b.peza,
  tieza: a.tieza + b.tieza,
});

export const sumBucket = (b: TargetBucket) => b.bplo + b.gov + b.peza + b.tieza;

/** Map backend sectorcode -> UI bucket key. Unknown codes are ignored. */
export function sectorKey(code: string | undefined | null): keyof TargetBucket | null {
  const c = (code ?? "").toUpperCase().trim();
  if (c === "BPLO") return "bplo";
  if (c === "GOV" || c === "GOVERNMENT") return "gov";
  if (c === "PEZA") return "peza";
  if (c === "TIEZA") return "tieza";
  return null;
}

/**
 * Bucket a station's targetreferencelist into monthly/quarterly/semi/annual.
 */
function resolveBucket(it: TargetReferenceClassModel): TargetBucket | null {
  const hasMonthTotals = [it.bplototal, it.govtotal, it.piezatotal, it.tiezatotal].some(
    (value) => value !== undefined && value !== null,
  );

  if (hasMonthTotals) {
    return {
      bplo: Number(it.bplototal ?? 0),
      gov: Number(it.govtotal ?? 0),
      peza: Number(it.piezatotal ?? 0),
      tieza: Number(it.tiezatotal ?? 0),
    };
  }

  const k = sectorKey(it.sectorcode);
  if (!k) return null;

  const bucket = emptyBucket();
  bucket[k] = Number(it.targettotal) || 0;
  return bucket;
}

export function computeDerivedFromList(list: TargetReferenceClassModel[] | null | undefined) {
  const monthly: Record<number, TargetBucket> = {};
  for (let i = 1; i <= 12; i++) monthly[i] = emptyBucket();

  (list ?? []).forEach((it) => {
    const m = Number(it.reportmonth);
    if (!m || m < 1 || m > 12) return;
    const bucket = resolveBucket(it);
    if (!bucket) return;
    monthly[m] = addBucket(monthly[m], bucket);
  });

  const quarters = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12],
  ].map((mm) => mm.reduce((acc, m) => addBucket(acc, monthly[m]), emptyBucket()));
  const halves = [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
  ].map((mm) => mm.reduce((acc, m) => addBucket(acc, monthly[m]), emptyBucket()));
  const annual = quarters.reduce((acc, q) => addBucket(acc, q), emptyBucket());
  return { monthly, quarters, halves, annual };
}
