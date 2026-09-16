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

const TRUTHY = new Set(["TRUE", "1", "YES", "ON", "ENABLED"]);

function flag(name: string): boolean {
  const raw = String((import.meta.env?.[name] as string | undefined) ?? "")
    .trim()
    // tolerate quoted values ("TRUE") coming from some .env parsers
    .replace(/^["']|["']$/g, "")
    .trim()
    .toUpperCase();
  return TRUTHY.has(raw);
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
    .replace(/^["'[]|["'\]]$/g, "")
    .trim();
  if (!raw) return new Set();
  const parts = raw.split(",").map((p) => p.trim());
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

/** Whether `module` is exempted from the lock in the given province. */
export function isModuleExempt(module: PastDateLockModule, provinceno?: string): boolean {
  const key = (provinceno ?? context.provinceno ?? "").trim().toLowerCase();
  if (!key) return false;
  return PROVINCE_EXEMPT_MODULES[key]?.has(module) === true;
}

type LockContext = { provinceno: string; roleno: number };

let context: LockContext = { provinceno: "", roleno: 0 };

/** Cache the logged-in user's province + role (called by the AuthProvider). */
export function setPastDateLockContext(next: LockContext | null) {
  context = { provinceno: next?.provinceno ?? "", roleno: Number(next?.roleno ?? 0) || 0 };
}

/** Whether the past-date lock applies to the currently logged-in user. */
export function isPastDateLockEnabled(module?: PastDateLockModule): boolean {
  // Super Administrators bypass every past-date rule.
  if (context.roleno === SUPER_ADMIN_ROLE_NO) return false;
  const provinceno = (context.provinceno || "").trim().toLowerCase();
  // Per-province module exemptions.
  if (module && isModuleExempt(module, provinceno)) return false;
  if (!provinceno) return false;
  return PROVINCE_LOCK_FLAGS[provinceno] === true;
}

export default isPastDateLockEnabled;

/**
 * True when the given year/month should be considered past according to the
 * "4th-of-following-month" rule:
 * - current month is never past
 * - previous month becomes past starting on day 4 of the current month
 * - older months are always past
 */
export function isPastMonth(year: number, month: number, now: Date = new Date()): boolean {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m || m < 1 || m > 12) return false;
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (y === cy && m === cm) return false;
  const prev = new Date(cy, cm - 2, 1); // cm-2 because Date months are 0-based
  const prevY = prev.getFullYear();
  const prevM = prev.getMonth() + 1;
  if (y === prevY && m === prevM) return now.getDate() >= 4;
  return new Date(y, m - 1, 1).getTime() < new Date(cy, cm - 1, 1).getTime();
}

/**
 * True when a specific calendar date should be locked for editing according
 * to the month-based rule. This ignores the day-of-month of the target date
 * and uses the target's month/year only.
 */
export function isDateLocked(
  value: string | Date,
  module?: PastDateLockModule,
  now: Date = new Date(),
): boolean {
  if (!isPastDateLockEnabled(module)) return false;
  let d: Date;
  if (typeof value === "string") {
    const iso = value.slice(0, 10);
    d = new Date(`${iso}T00:00:00`);
  } else {
    d = new Date(value);
  }
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return isPastMonth(y, m, now);
}
