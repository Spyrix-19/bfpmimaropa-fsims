/**
 * Local helpers for the Target Reference module — buckets the backend
 * `targetreferencelist` (TargetReferenceClassModel[]) into BPLO / Gov /
 * PEZA / TIEZA cells for the on-screen tables.
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

/* ------------------------------------------------------------------ *
 * Daily helpers.
 * `daysInMonth` is leap-year aware (28 / 29 / 30 / 31) — never hardcoded.
 * ------------------------------------------------------------------ */
export function daysInMonth(reportYear: number, reportMonth: number): number {
  const y = Number(reportYear) || new Date().getFullYear();
  const m = Number(reportMonth) || 1;
  if (m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

/** Ordered day numbers (1..N) for the given year + month. */
export function buildDays(reportYear: number, reportMonth: number): number[] {
  return Array.from({ length: daysInMonth(reportYear, reportMonth) }, (_, i) => i + 1);
}

/** Long label for a daily row, e.g. "July 1, 2026". */
export function formatDayLabel(reportYear: number, reportMonth: number, day: number): string {
  return new Date(reportYear, reportMonth - 1, day).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export type TargetPeriod = "DAILY" | "MONTHLY" | "QUARTERLY" | "SEMI-ANNUAL" | "ANNUAL";

export const PERIOD_OPTIONS: { value: TargetPeriod; label: string }[] = [
  { value: "DAILY", label: "Daily" },
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

/**
 * Bucket a station's targetreferencelist row into a BPLO/Gov/PEZA/TIEZA bucket.
 */
function resolveBucket(it: TargetReferenceClassModel): TargetBucket {
  return {
    bplo: Number(it.bplototal ?? 0),
    gov: Number(it.govtotal ?? 0),
    peza: Number(it.pezatotal ?? 0),
    tieza: Number(it.tiezatotal ?? 0),
  };
}

export function computeDerivedFromList(list: TargetReferenceClassModel[] | null | undefined) {
  const monthly: Record<number, TargetBucket> = {};
  for (let i = 1; i <= 12; i++) monthly[i] = emptyBucket();

  (list ?? []).forEach((it) => {
    const m = Number(it.reportmonth);
    if (!m || m < 1 || m > 12) return;
    monthly[m] = addBucket(monthly[m], resolveBucket(it));
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

/**
 * Bucket the station's daily target records for a single month.
 *
 * Every calendar day of the month is generated (28/29/30/31), so days without
 * a matching record still appear with empty (zero) values. Records are matched
 * on reportyear + reportmonth + reportday; legacy rows without a `reportday`
 * are folded into day 1 so historical data is never dropped.
 */
export function computeDailyFromList(
  list: TargetReferenceClassModel[] | null | undefined,
  reportYear: number,
  reportMonth: number,
) {
  const daily: Record<number, TargetBucket> = {};
  const days = buildDays(reportYear, reportMonth);
  days.forEach((d) => (daily[d] = emptyBucket()));

  (list ?? []).forEach((it) => {
    if (Number(it.reportyear) !== Number(reportYear)) return;
    if (Number(it.reportmonth) !== Number(reportMonth)) return;
    const d = Number(it.reportday ?? 1);
    if (!daily[d]) return;
    daily[d] = addBucket(daily[d], resolveBucket(it));
  });

  const total = days.reduce((acc, d) => addBucket(acc, daily[d]), emptyBucket());
  return { days, daily, total };
}
