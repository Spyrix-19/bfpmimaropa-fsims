/**
 * Shared color palette for the Monitoring module.
 *
 * All Monitoring pages (monitoringNew, monitoringEdit, monitoringView)
 * consume these tokens so that every primary header, sub-header, grouped
 * table header, and total/summary section belongs to one unified color
 * family (sky). Change values here to update the entire module.
 *
 * Hierarchy (light → dark, decreasing emphasis):
 *   HEADER_PRIMARY   → sky-700  (strongest, white text)
 *   HEADER_GROUP     → sky-600  (grouped table headers, white text)
 *   HEADER_SUB       → sky-500  (sub group table headers, white text)
 *   HEADER_SOFT      → sky-100  (pastel sub-header row / group tone)
 *   HEADER_SOFTER    → sky-50   (nested / alternate sub-header)
 *   TOTAL_ROW        → sky-50 + sky-900 text, sky-200 borders
 *   TOTAL_CELL_TEXT  → sky-900 (with dark-mode counterpart)
 */
export const MONITORING_THEME = {
  headerPrimary:
    "bg-sky-700 text-white dark:bg-sky-800 dark:text-sky-50",
  headerGroup:
    "bg-sky-600 text-white dark:bg-sky-700 dark:text-sky-50",
  headerSub:
    "bg-sky-500 text-white dark:bg-sky-600 dark:text-sky-50",
  headerSoft:
    "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
  headerSofter:
    "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  headerBorder: "border-sky-200 dark:border-sky-900/60",

  // Standardized totals / grand total / summary treatment.
  totalRow:
    "bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
  totalBorder: "border-sky-200 dark:border-sky-900/60",
  totalText: "text-sky-900 dark:text-sky-100",

  // Zebra striping that remains within the family (used in matrices).
  rowEven: "bg-card",
  rowOdd: "bg-sky-50/40 dark:bg-sky-950/20",
} as const;

export type MonitoringThemeKey = keyof typeof MONITORING_THEME;