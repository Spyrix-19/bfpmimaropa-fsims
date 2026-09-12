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
 * Temporary per-module exemptions (comma separated, same keys used to group
 * Revision Requests):
 *   VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES="fire-code-fees"
 *   valid keys: target-reference | monitoring | notice | fire-code-fees
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
export type PastDateLockModule =
  | "target-reference"
  | "monitoring"
  | "notice"
  | "fire-code-fees";

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
  "firecodefees": "fire-code-fees",
  fees: "fire-code-fees",
};

function normalizeModule(value: string): PastDateLockModule | null {
  const key = value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ");
  return MODULE_ALIASES[key] ?? MODULE_ALIASES[key.replace(/-/g, " ")] ?? null;
}

/** Modules temporarily exempted from the past-date lock for everyone. */
const EXEMPT_MODULES: Set<PastDateLockModule> = new Set(
  String((import.meta.env?.VITE_BFP_MIMAROPA_PAST_DATE_LOCK_EXEMPT_MODULES as string) ?? "")
    .replace(/^["'[]|["'\]]$/g, "")
    .split(",")
    .map(normalizeModule)
    .filter((m): m is PastDateLockModule => m !== null),
);

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
  // Temporarily disabled modules.
  if (module && EXEMPT_MODULES.has(module)) return false;
  const provinceno = (context.provinceno || "").trim().toLowerCase();
  if (!provinceno) return false;
  return PROVINCE_LOCK_FLAGS[provinceno] === true;
}

export default isPastDateLockEnabled;
