/**
 * Province-scoped feature flag for the past-date lock (and the Revision
 * Request requirement that it triggers).
 *
 * Per-province switches (any casing, "TRUE" enables the lock):
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_ORMIN   → Oriental Mindoro
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_OCCMIN  → Occidental Mindoro
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_MAR     → Marinduque
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_ROM     → Romblon
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_PAL     → Palawan
 *
 * Hard lock (highest priority): modules listed in the province-specific
 * ALL_DATE_LOCK_MODULES env vars are locked for every date in that province,
 * regardless of exemption or past-date configuration.
 *
 * Super Administrators (roleno === 1) are exempt from the lock everywhere.
 *
 * Per-province module exemptions (comma separated, same keys used to group
 * Revision Requests; same province suffixes as the lock switches above):
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_ORMIN="fire-code-fees"
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_OCCMIN=...
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_MAR=...
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_ROM=...
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_PAL=...
 *   valid keys: target-reference | monitoring | notice | fire-code-fees
 *   or "ALL" / "*" to exempt every module in that province
 *
 * Always call {@link isPastDateLockEnabled} instead of reading env vars
 * directly. The logged-in user's province + role are cached in memory by the
 * AuthProvider via {@link setPastDateLockContext}.
 */
import {
  MIMAROPA_MARINDUQUE,
  MIMAROPA_OCCIDENTAL_MINDORO,
  MIMAROPA_ORIENTAL_MINDORO,
  MIMAROPA_PALAWAN,
  MIMAROPA_ROMBLON,
} from "@/lib/fsims-constants";

const SUPER_ADMIN_ROLE_NO = 1;

/**
 * Only the exact semantic value "TRUE" (trimmed, case-insensitive) enables the
 * lock. Everything else — "FALSE", "0", "1", "yes", "enabled", garbage, empty —
 * is disabled. Never use JavaScript truthiness here.
 */
function flag(name: string): boolean {
  const raw = String((import.meta.env?.[name] as string | undefined) ?? "")
    .trim()
    // tolerate quoted values ("TRUE") coming from some .env parsers
    .replace(/^["']|["']$/g, "")
    .trim()
    .toUpperCase();
  return raw === "TRUE";
}

/** provinceno (lowercased) → whether the past-date lock is enabled there. */
const PROVINCE_LOCK_FLAGS: Record<string, boolean> = {
  [MIMAROPA_ORIENTAL_MINDORO.toLowerCase()]: flag("VITE_BFP_MIMAROPA_PAST_DATE_LOCK_ORMIN"),
  [MIMAROPA_OCCIDENTAL_MINDORO.toLowerCase()]: flag("VITE_BFP_MIMAROPA_PAST_DATE_LOCK_OCCMIN"),
  [MIMAROPA_MARINDUQUE.toLowerCase()]: flag("VITE_BFP_MIMAROPA_PAST_DATE_LOCK_MAR"),
  [MIMAROPA_ROMBLON.toLowerCase()]: flag("VITE_BFP_MIMAROPA_PAST_DATE_LOCK_ROM"),
  [MIMAROPA_PALAWAN.toLowerCase()]: flag("VITE_BFP_MIMAROPA_PAST_DATE_LOCK_PAL"),
};

/** Source-module keys, matching the Revision Request grouping. */
export type PastDateLockModule = "target-reference" | "monitoring" | "notice" | "fire-code-fees";

export const PAST_DATE_LOCK_MODULES: readonly PastDateLockModule[] = [
  "target-reference",
  "monitoring",
  "notice",
  "fire-code-fees",
];

/** Aliases so friendlier names in .env still resolve to a module key. */
const MODULE_ALIASES: Record<string, PastDateLockModule> = {
  "target-reference": "target-reference",
  target: "target-reference",
  "target reference": "target-reference",
  monitoring: "monitoring",
  compliance: "monitoring",
  notice: "notice",
  notices: "notice",
  "fire-code-fees": "fire-code-fees",
  "fire code fees": "fire-code-fees",
  "fire code fee": "fire-code-fees",
  firecodefees: "fire-code-fees",
  fees: "fire-code-fees",
};

function normalizeModule(value: string): PastDateLockModule | null {
  const key = value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ");
  return MODULE_ALIASES[key] ?? MODULE_ALIASES[key.replace(/-/g, " ")] ?? null;
}

/** "ALL" / "*" exempts every module. */
const ALL_TOKENS = new Set(["ALL", "*", "EVERY", "EVERYTHING"]);

/** Parse a comma-separated module list from an env var into a module set. */
function parseModuleList(name: string): Set<PastDateLockModule> {
  const raw = String((import.meta.env?.[name] as string | undefined) ?? "")
    .replace(/^['"\[]+|['"\]]+$/g, "")
    .trim();
  if (!raw) return new Set();
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.some((p) => ALL_TOKENS.has(p.toUpperCase()))) {
    return new Set(PAST_DATE_LOCK_MODULES);
  }
  return new Set(parts.map(normalizeModule).filter((m): m is PastDateLockModule => m !== null));
}

/** provinceno (lowercased) → modules exempted from the lock in that province. */
const PROVINCE_EXEMPT_MODULES: Record<string, Set<PastDateLockModule>> = {
  [MIMAROPA_ORIENTAL_MINDORO.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_ORMIN",
  ),
  [MIMAROPA_OCCIDENTAL_MINDORO.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_OCCMIN",
  ),
  [MIMAROPA_MARINDUQUE.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_MAR",
  ),
  [MIMAROPA_ROMBLON.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_ROM",
  ),
  [MIMAROPA_PALAWAN.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES_PAL",
  ),
};

/** provinceno (lowercased) → modules that are locked for every date in that province. */
const PROVINCE_ALL_DATE_LOCK_MODULES: Record<string, Set<PastDateLockModule>> = {
  [MIMAROPA_ORIENTAL_MINDORO.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_ALL_DATE_LOCK_MODULES_ORMIN",
  ),
  [MIMAROPA_OCCIDENTAL_MINDORO.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_ALL_DATE_LOCK_MODULES_OCCMIN",
  ),
  [MIMAROPA_MARINDUQUE.toLowerCase()]: parseModuleList(
    "VITE_BFP_MIMAROPA_ALL_DATE_LOCK_MODULES_MAR",
  ),
  [MIMAROPA_ROMBLON.toLowerCase()]: parseModuleList("VITE_BFP_MIMAROPA_ALL_DATE_LOCK_MODULES_ROM"),
  [MIMAROPA_PALAWAN.toLowerCase()]: parseModuleList("VITE_BFP_MIMAROPA_ALL_DATE_LOCK_MODULES_PAL"),
};

/** Whether `module` is exempted from the lock in the given province. */
export function isModuleExempt(module: PastDateLockModule, provinceno?: string): boolean {
  const key = (provinceno ?? context.provinceno ?? "").trim().toLowerCase();
  if (!key) return false;
  return PROVINCE_EXEMPT_MODULES[key]?.has(module) === true;
}

/** Whether `module` is hard-locked for every date in the given province. */
export function isModuleLockedForAllDates(module: PastDateLockModule, provinceno?: string): boolean {
  const key = (provinceno ?? context.provinceno ?? "").trim().toLowerCase();
  if (!key) return false;
  return PROVINCE_ALL_DATE_LOCK_MODULES[key]?.has(module) === true;
}

type LockContext = { provinceno: string; roleno: number };

let context: LockContext = { provinceno: "", roleno: 0 };

/** Cache the logged-in user's province + role (called by the AuthProvider). */
export function setPastDateLockContext(next: LockContext | null) {
  context = { provinceno: next?.provinceno ?? "", roleno: Number(next?.roleno ?? 0) || 0 };
}

/** Whether the past-date lock applies to the currently logged-in user. */
export function isPastDateLockEnabled(module?: PastDateLockModule): boolean {
  const provinceno = (context.provinceno || "").trim().toLowerCase();

  // Super administrators are exempt from all date-lock rules, including the
  // high-priority all-date hard lock.
  if (context.roleno === SUPER_ADMIN_ROLE_NO) return false;

  // Highest-priority hard lock: these modules are locked for every date regardless
  // of province-level past-date toggle or module exemptions.
  if (module && isModuleLockedForAllDates(module, provinceno)) return true;

  // Per-province module exemptions.
  if (module && isModuleExempt(module, provinceno)) return false;
  if (!provinceno) return false;
  return PROVINCE_LOCK_FLAGS[provinceno] === true;
}

export default isPastDateLockEnabled;

/** Philippine Standard Time is a fixed UTC+8 (no DST). */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Exact instant a month closes: 11:59 PM (Manila) on the 4th day of the
 * following month. Date.UTC handles Dec → Jan rollover and leap years.
 */
export function getMonthlyLockCutoff(year: number, month: number): Date | null {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || y < 1 || m < 1 || m > 12) return null;
  // Date.UTC month index `m` (0-based) is the month after `m` (1-based).
  return new Date(Date.UTC(y, m, 4, 23, 59, 0, 0) - MANILA_OFFSET_MS);
}

/**
 * True once the year/month has reached its monthly closing cutoff. Current and
 * future months are never past. Independent of the browser timezone.
 */
export function isPastMonth(year: number, month: number, now: Date = new Date()): boolean {
  const cutoff = getMonthlyLockCutoff(year, month);
  if (!cutoff) return false;
  return now.getTime() >= cutoff.getTime();
}

/** Reads the calendar year/month of a record date without timezone drift. */
function recordYearMonth(value: string | Date): { y: number; m: number } | null {
  if (typeof value === "string") {
    const iso = value.trim().match(/^(\d{4})-(\d{1,2})/);
    if (iso) return { y: Number(iso[1]), m: Number(iso[2]) };
    const us = value.trim().match(/^(\d{1,2})\/\d{1,2}\/(\d{4})/);
    if (us) return { y: Number(us[2]), m: Number(us[1]) };
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Date objects built by the app are local calendar dates (new Date(y, m-1, d)).
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export type DateLockReason =
  | "SUPER_ADMINISTRATOR"
  | "ALL_DATE_LOCK"
  | "MONTHLY_PAST_DATE_LOCK"
  | "EXEMPT"
  | "LOCK_DISABLED"
  | "CURRENT_OR_FUTURE_MONTH"
  | "BEFORE_CUTOFF"
  | "INVALID_DATE";

export interface DateLockDecision {
  /** The record's period is closed for normal Add/Edit. */
  locked: boolean;
  reason: DateLockReason;
  cutoffDate: Date | null;
}

/**
 * The single authoritative lock decision. Precedence:
 * Super Admin → All-Date (supreme) lock → exemption → province switch →
 * monthly cutoff. Approved revisions are layered on top by
 * `deriveRevisionLock` (revision/useRevisionRequests.ts).
 */
export function getDateLockDecision(
  value: string | Date,
  module?: PastDateLockModule,
  now: Date = new Date(),
): DateLockDecision {
  if (context.roleno === SUPER_ADMIN_ROLE_NO)
    return { locked: false, reason: "SUPER_ADMINISTRATOR", cutoffDate: null };
  const provinceno = (context.provinceno || "").trim().toLowerCase();
  if (module && isModuleLockedForAllDates(module, provinceno))
    return { locked: true, reason: "ALL_DATE_LOCK", cutoffDate: null };
  if (module && isModuleExempt(module, provinceno))
    return { locked: false, reason: "EXEMPT", cutoffDate: null };
  if (!isPastDateLockEnabled(module))
    return { locked: false, reason: "LOCK_DISABLED", cutoffDate: null };
  const ym = recordYearMonth(value);
  const cutoffDate = ym ? getMonthlyLockCutoff(ym.y, ym.m) : null;
  if (!ym || !cutoffDate) return { locked: false, reason: "INVALID_DATE", cutoffDate: null };
  if (now.getTime() >= cutoffDate.getTime())
    return { locked: true, reason: "MONTHLY_PAST_DATE_LOCK", cutoffDate };
  const manilaNow = new Date(now.getTime() + MANILA_OFFSET_MS);
  const nowIndex = manilaNow.getUTCFullYear() * 12 + manilaNow.getUTCMonth();
  const recIndex = ym.y * 12 + (ym.m - 1);
  return {
    locked: false,
    reason: recIndex >= nowIndex ? "CURRENT_OR_FUTURE_MONTH" : "BEFORE_CUTOFF",
    cutoffDate,
  };
}

/** True when a record date is locked (only its year/month matter). */
export function isDateLocked(
  value: string | Date,
  module?: PastDateLockModule,
  now: Date = new Date(),
): boolean {
  return getDateLockDecision(value, module, now).locked;
}
