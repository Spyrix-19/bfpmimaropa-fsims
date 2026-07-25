/**
 * Centralized UI theme class tokens.
 *
 * Every module (Dashboard, Fire Safety Compliance / Monitoring, Target
 * Reference, Target Matrix, Reports, Users, Revision Requests, …) consumes
 * these constants so the whole application shares one visual language.
 *
 * The underlying colors live in `src/styles.css` as CSS variables plus
 * `@utility` classes (head-1/2/3, head-soft, tone-*, total-row, border-grid…),
 * which means a theme change requires editing only that one file.
 *
 * Purely presentational — contains no business logic.
 */

/** Table / matrix structural styling. */
export const TABLE = {
  /** Outer wrapper for scrollable data tables. */
  wrapper: "w-full max-w-full overflow-auto rounded-lg border border-border shadow-soft bg-card",
  /** Base table element. */
  base: "min-w-max border-separate border-spacing-0 text-[11px] text-foreground",
  /** Cell grid lines. */
  cell: "border-b border-r border-grid",
  cellBottom: "border-b border-grid",
  /** Emphasized separator above totals. */
  topRule: "border-t-2 border-grid-strong",
  rowEven: "bg-card",
  rowOdd: "row-alt",
  rowHover: "hover:row-hover",
  rowSelected: "row-selected",
} as const;

/** Unified header hierarchy shared by all matrices and grouped tables. */
export const MATRIX_TONE = {
  /** Strongest header (station / entity column headers). */
  stationHead: "head-1",
  /** Quarter-level grouping header. */
  quarter: "head-2",
  /** Month-level header. */
  month: "head-3",
  /** Pastel category / sub-header row. */
  cat: "head-soft",
  /** Softest nested sub-header. */
  catSofter: "head-softer",
  /** Semester grouping header. */
  semester: "head-2",
  /** Annual grouping header. */
  annual: "head-1",
  /** Category groups of the compliance matrix. */
  catInsp: "tone-info",
  catFsec: "tone-success",
  catFsic: "tone-warning",
  catNotice: "tone-danger",
  catInspSub: "tone-info-soft",
  catFsecSub: "tone-success-soft",
  catFsicSub: "tone-warning-soft",
  catNoticeSub: "tone-danger-soft",
  /** Province / group separator row. */
  provHeaderRow: "group-row font-bold",
  /** Province / grand total row. */
  provTotalRow: "total-row font-bold",
  provTotalRowStrong: "total-row-strong font-bold",
} as const;

/** Soft badge/chip tones — one palette for every status across the app. */
export const TONE_SOFT = {
  info: "tone-info-soft",
  success: "tone-success-soft",
  warning: "tone-warning-soft",
  danger: "tone-danger-soft",
  neutral: "tone-neutral-soft",
} as const;

export type ToneName = keyof typeof TONE_SOFT;

/** Shared badge shape used by every status pill. */
export const STATUS_PILL_BASE =
  "inline-flex items-center rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";

/** Global status → tone mapping. Keys are uppercased status names. */
export const STATUS_TONE: Record<string, ToneName> = {
  PENDING: "warning",
  FOR_REVIEW: "warning",
  DRAFT: "neutral",
  UNLOCKED: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  INACTIVE: "neutral",
  APPROVED: "success",
  COMPLETED: "info",
  ACTIVE: "success",
  SUCCESS: "success",
  LOCKED: "warning",
  WARNING: "warning",
  DENIED: "danger",
  REJECTED: "danger",
  ERROR: "danger",
  INFO: "info",
};

/** Resolve any status string to its soft tone classes. */
export const statusTone = (status?: string | null): string =>
  TONE_SOFT[STATUS_TONE[String(status ?? "").toUpperCase()] ?? "neutral"];

/** Semantic foreground-only text tones (variance figures, inline hints). */
export const TEXT_TONE = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  muted: "text-muted-foreground",
} as const;

/** Icon medallion styling used by confirm dialogs and modals. */
export const ICON_MEDALLION = {
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  warning: { bg: "tone-warning-soft", fg: "text-warning" },
  danger: { bg: "tone-danger-soft", fg: "text-destructive" },
  success: { bg: "tone-success-soft", fg: "text-success" },
} as const;

/** Standard card / panel treatment. */
export const CARD = {
  base: "rounded-lg border border-border bg-card shadow-soft",
  interactive:
    "rounded-lg border border-border bg-card shadow-soft transition-colors hover:border-primary/40",
  header: "px-4 py-3 border-b border-border",
  body: "p-4",
  footer: "px-4 py-3 border-t border-border",
} as const;
