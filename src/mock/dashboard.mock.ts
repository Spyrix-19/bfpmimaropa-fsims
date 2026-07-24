/**
 * Centralized sample/mock data for the Dashboard.
 *
 * These values are for UI representation only. Dashboard filters do NOT
 * affect any of these numbers — they will be wired up once the backend
 * exposes a real aggregation endpoint.
 */

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const SECTORS = ["BPLO", "GOVT", "PEZA", "TIEZA"] as const;
export type Sector = (typeof SECTORS)[number];

export const APPLICATIONS = ["FSEC", "FSIC", "NTC", "NOD", "NTCV", "Closure"] as const;
export type Application = (typeof APPLICATIONS)[number];

// Chart palette references the CSS design tokens defined in src/styles.css
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

// ---------- Summary / KPI totals ----------
export const summary = {
  target: 5200,
  actual: 4712,
  lastUpdated: "Today, 08:15 AM",
  fsec: 1420,
  fsic: 3986,
  ntc: 312,
  nod: 200,
  ntcv: 96,
  closure: 34,
  records: 6240,
};

// ---------- Monthly trend: target vs actual ----------
export interface MonthlyPoint {
  name: string;
  target: number;
  actual: number;
}
export const byMonth: MonthlyPoint[] = [
  { name: "Jan", target: 320, actual: 285 },
  { name: "Feb", target: 340, actual: 312 },
  { name: "Mar", target: 360, actual: 348 },
  { name: "Apr", target: 380, actual: 365 },
  { name: "May", target: 400, actual: 372 },
  { name: "Jun", target: 420, actual: 401 },
  { name: "Jul", target: 410, actual: 388 },
  { name: "Aug", target: 430, actual: 415 },
  { name: "Sep", target: 440, actual: 402 },
  { name: "Oct", target: 460, actual: 431 },
  { name: "Nov", target: 470, actual: 448 },
  { name: "Dec", target: 480, actual: 462 },
];

// ---------- Monthly trend per sector ----------
export const byMonthSector: Array<Record<string, number | string>> = MONTHS.map((name, i) => ({
  name,
  BPLO: 120 + i * 6 + (i % 3) * 8,
  GOVT: 80 + i * 4 + (i % 2) * 6,
  PEZA: 40 + i * 3,
  TIEZA: 30 + i * 2 + (i % 4) * 3,
}));

// ---------- Province target vs actual ----------
export interface ProvincePoint {
  name: string;
  target: number;
  actual: number;
}
export const byProvince: ProvincePoint[] = [
  { name: "Palawan", target: 1240, actual: 1128 },
  { name: "Or. Mindoro", target: 980, actual: 902 },
  { name: "Occ. Mindoro", target: 860, actual: 778 },
  { name: "Romblon", target: 620, actual: 561 },
  { name: "Marinduque", target: 500, actual: 468 },
];

export const targetGapByProvince = byProvince.map((province) => ({
  name: province.name,
  gap: province.target - province.actual,
}));

export const recentActivity = [
  {
    station: "Puerto Princesa CFS",
    action: "FSEC inspection updated",
    value: "+12",
    time: "12 mins ago",
    badge: "FSEC",
  },
  {
    station: "Calapan CFS",
    action: "FSIC issuance completed",
    value: "+9",
    time: "25 mins ago",
    badge: "FSIC",
  },
  {
    station: "San Jose MFS",
    action: "NTC advisory issued",
    value: "+4",
    time: "42 mins ago",
    badge: "NTC",
  },
  {
    station: "Odiongan MFS",
    action: "NOD case filed",
    value: "+2",
    time: "1 hr ago",
    badge: "NOD",
  },
  {
    station: "Boac MFS",
    action: "Closure follow-up scheduled",
    value: "1",
    time: "1 hr ago",
    badge: "Closure",
  },
];

// ---------- Sector totals ----------
export const bySector = [
  { name: "BPLO", value: 1820 },
  { name: "GOVT", value: 1240 },
  { name: "PEZA", value: 620 },
  { name: "TIEZA", value: 490 },
];

// ---------- Application types ----------
export const byApplication = [
  { name: "FSEC", value: 1420 },
  { name: "FSIC", value: 3986 },
  { name: "NTC", value: 312 },
  { name: "NOD", value: 200 },
  { name: "NTCV", value: 96 },
  { name: "Closure", value: 34 },
];

// ---------- Sector x Application stacked ----------
export const sectorByApp: Array<Record<string, number | string>> = APPLICATIONS.map((name, i) => ({
  name,
  BPLO: [520, 1140, 90, 40, 20, 10][i],
  GOVT: [380, 780, 60, 20, 8, 4][i],
  PEZA: [180, 380, 40, 12, 6, 2][i],
  TIEZA: [140, 280, 24, 8, 4, 2][i],
  // OGA removed from dashboard representation
}));

// ---------- Top stations ----------
export const byStation = [
  { name: "Puerto Princesa CFS", actual: 388 },
  { name: "Calapan CFS", actual: 331 },
  { name: "San Jose MFS", actual: 221 },
  { name: "Odiongan MFS", actual: 194 },
  { name: "Boac MFS", actual: 168 },
  { name: "Mamburao MFS", actual: 128 },
  { name: "Coron MFS", actual: 138 },
  { name: "Romblon MFS", actual: 119 },
  { name: "Sablayan MFS", actual: 112 },
  { name: "Roxas MFS", actual: 104 },
];

// ---------- Year-over-Year ----------
const CURRENT_YEAR = new Date().getFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;
export const yoY = {
  currentYear: CURRENT_YEAR,
  prevYear: PREV_YEAR,
  data: MONTHS.map((name, i) => ({
    name,
    [String(PREV_YEAR)]: 240 + i * 15 + (i % 3) * 10,
    [String(CURRENT_YEAR)]: 285 + i * 18 + (i % 2) * 12,
  })),
};

export const dashboardMockData = {
  summary,
  byMonth,
  byMonthSector,
  byProvince,
  targetGapByProvince,
  recentActivity,
  bySector,
  byApplication,
  sectorByApp,
  byStation,
  yoY,
  SECTORS,
  SECTOR_COLORS,
  CHART_COLORS,
};

export default dashboardMockData;
