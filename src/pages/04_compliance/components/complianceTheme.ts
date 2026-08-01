import { MATRIX_TONE, TABLE } from "@/lib/theme";

/**
 * Shared color palette for the Monitoring module.
 *
 * All Monitoring pages (monitoringNew, monitoringEdit, monitoringView)
 * consume these tokens so that every primary header, sub-header, grouped
 * table header, and total/summary section belongs to one unified color
 * family (blue). Change values here to update the entire module.
 *
 * Values are re-exported from the centralized design tokens in
 * `src/lib/theme.ts` (backed by CSS variables in `src/styles.css`), so the
 * module always matches the rest of the application in both light and dark
 * mode. Hierarchy, strongest → softest: head-1 → head-2 → head-3 →
 * head-soft → head-softer.
 */
export const MONITORING_THEME = {
  headerPrimary: MATRIX_TONE.stationHead,
  headerGroup: MATRIX_TONE.quarter,
  headerSub: MATRIX_TONE.month,
  headerSoft: MATRIX_TONE.cat,
  headerSofter: MATRIX_TONE.catSofter,
  headerBorder: "border-grid",

  // Standardized totals / grand total / summary treatment.
  totalRow: "head-softer",
  totalBorder: "border-grid",
  totalText: "text-foreground",

  // Zebra striping that remains within the family (used in matrices).
  rowEven: TABLE.rowEven,
  rowOdd: TABLE.rowOdd,
} as const;

export type MonitoringThemeKey = keyof typeof MONITORING_THEME;
