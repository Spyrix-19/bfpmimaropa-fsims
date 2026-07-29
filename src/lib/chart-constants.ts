/**
 * Dashboard chart presentation constants.
 *
 * Palette + sector labels only — NO sample/mock values. Every number the
 * dashboard renders comes from the API.
 */

export const SECTORS = ["BPLO", "GOVT", "PEZA", "TIEZA"] as const;
export type Sector = (typeof SECTORS)[number];

/** Chart palette references the CSS design tokens defined in the global stylesheet. */
export const CHART_COLORS = {
  primary: "var(--color-chart-1)",
  success: "var(--color-chart-2)",
  warning: "var(--color-chart-3)",
  danger: "var(--color-chart-4)",
  purple: "var(--color-chart-5)",
  teal: "var(--color-chart-6)",
} as const;

export const SECTOR_COLORS: Record<Sector, string> = {
  BPLO: CHART_COLORS.primary,
  GOVT: CHART_COLORS.success,
  PEZA: CHART_COLORS.warning,
  TIEZA: CHART_COLORS.purple,
};
