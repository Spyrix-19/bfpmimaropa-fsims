import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import type {
  StationMonthlyPerformanceModel,
  StationMonthlyPerformanceClass,
} from "@/types/dashboardType";

export type MonthlyPerformance = StationMonthlyPerformanceClass;
export type StationPerformance = StationMonthlyPerformanceModel;

export interface RankedStation {
  stationno: string;
  stationcode: string;
  stationname: string;
  provincename: string;
  cityname: string;
  logoSrc: string | null;
  /** Average of the applicable monthly overallPercentage values. */
  averageOverallPercentage: number;
  /** Number of months included in the computation. */
  monthsCounted: number;
  /** Number of months at exactly 100%. */
  perfectMonths: number;
  /** True when every applicable month is exactly 100%. */
  isPerfect: boolean;
  /** Applicable months (current reporting period only), ordered by month ASC. */
  months: MonthlyPerformance[];
  /** Competition-style rank based on the distinct average percentage. */
  rank: number;
}

export { MONTH_NAMES };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const FILE_BASE_URL = (
  (import.meta.env?.VITE_BFP_MIMAROPA_API_BASE_URL as string | undefined) ??
  "https://bfpr4bv3-api.onrender.com"
).replace(/\/$/, "");

function resolveLogo(logourl?: string | null): string | null {
  const raw = typeof logourl === "string" ? logourl.trim() : "";
  if (!raw) return null;
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return `${FILE_BASE_URL}/${raw.replace(/^\/+/, "")}`;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampPct(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function normalizeComparativeSectorPct(value: number): number {
  const pct = clampPct(toNumber(value));
  // Zero means the station has no record for that sector in that month, so it
  // is treated as "nothing to compare" and therefore qualifies as 100%.
  return pct === 0 ? 100 : pct;
}

function hasActualSectorData(month: MonthlyPerformance): boolean {
  return (
    toNumber(month.bploPercentage) > 0 ||
    toNumber(month.govPercentage) > 0 ||
    toNumber(month.pezaPercentage) > 0 ||
    toNumber(month.tiezaPercentage) > 0
  );
}

function isPerfectMonth(month: MonthlyPerformance): boolean {
  if (!hasActualSectorData(month)) return false;
  return (
    normalizeComparativeSectorPct(month.bploPercentage) === 100 &&
    normalizeComparativeSectorPct(month.govPercentage) === 100 &&
    normalizeComparativeSectorPct(month.pezaPercentage) === 100 &&
    normalizeComparativeSectorPct(month.tiezaPercentage) === 100
  );
}

/** Format a percentage without excessive decimals (98.75%, 91.3%, 100%). */
export function formatPct(value: number): string {
  const v = clampPct(value);
  const rounded = Math.round(v * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2)}%`;
}

/**
 * Station monthly performance (Top 10 + 100% performers).
 *
 * Only months belonging to the current reporting period are considered:
 * January up to the current month for the current year, or the full year for
 * a past year. Future months and duplicate months are ignored.
 */
export function useStationPerformance(selectedYear?: number) {
  const [stations, setStations] = React.useState<StationPerformance[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getStationPerformance({
        suppressGlobalLoading: true,
        suppressErrorToast: true,
        signal: controller.signal,
        timeout: 90000,
      });
      const { ok, data, error: err, canceled } = unwrap<StationPerformance[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        const message = isGenericError(err) ? "Unable to load station performance." : err;
        toast.error(message);
        setError(message);
        setStations([]);
      } else {
        setError(null);
        setStations(Array.isArray(data) ? data : data ? [data as StationPerformance] : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const now = React.useMemo(() => new Date(), []);
  const year = selectedYear ?? now.getFullYear();
  const lastMonth =
    year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 0;

  const ranked = React.useMemo<RankedStation[]>(() => {
    if (lastMonth < 1) return [];
    const mapped = (stations ?? [])
      .filter((s) => !!s)
      .map((s) => {
        const seen = new Set<number>();
        const values: number[] = [];
        const months: MonthlyPerformance[] = [];
        for (const m of s.monthlyperformanceList ?? []) {
          if (!m) continue;
          const mYear = toNumber(m.year);
          const mMonth = toNumber(m.month);
          if (mYear !== year) continue;
          if (mMonth < 1 || mMonth > lastMonth) continue;
          if (seen.has(mMonth)) continue;
          if (!hasActualSectorData(m)) continue;
          seen.add(mMonth);
          months.push(m);
          values.push(clampPct(toNumber(m.overallPercentage)));
        }
        months.sort((a, b) => toNumber(a.month) - toNumber(b.month));
        const monthsCounted = values.length;
        const sum = values.reduce((a, b) => a + b, 0);
        const perfectMonths = months.filter((m) => isPerfectMonth(m)).length;
        return {
          stationno: s.stationno,
          stationcode: s.stationcode ?? "",
          stationname: s.stationname ?? "",
          provincename: s.provincename ?? "",
          cityname: s.cityname ?? "",
          logoSrc: resolveLogo(s.logourl),
          averageOverallPercentage: monthsCounted ? sum / monthsCounted : 0,
          monthsCounted,
          perfectMonths,
          isPerfect: monthsCounted > 0 && perfectMonths === monthsCounted,
          months,
          rank: 0,
        } as RankedStation;
      })
      .sort(
        (a, b) =>
          b.averageOverallPercentage - a.averageOverallPercentage ||
          a.stationname.localeCompare(b.stationname),
      );

    // Competition-style ranking: identical percentages share one rank.
    let rank = 0;
    let prevKey: string | null = null;
    for (const s of mapped) {
      const key = (Math.round(s.averageOverallPercentage * 100) / 100).toFixed(2);
      if (key !== prevKey) {
        rank += 1;
        prevKey = key;
      }
      s.rank = rank;
    }
    return mapped;
  }, [stations, year, lastMonth]);

  // Include every station up to (and including) the 10th distinct ranking level.
  const topStations = React.useMemo(
    () => ranked.filter((s) => s.monthsCounted > 0 && s.rank <= 10),
    [ranked],
  );

  const perfectStations = React.useMemo(
    () =>
      ranked
        .filter((s) => s.isPerfect)
        .slice()
        .sort((a, b) => a.stationname.localeCompare(b.stationname)),
    [ranked],
  );

  const periodLabel = React.useMemo(() => {
    if (lastMonth < 1) return `${year}`;
    const end = MONTH_NAMES[Math.min(lastMonth, 12) - 1];
    return lastMonth === 1 ? `January ${year}` : `January–${end} ${year}`;
  }, [lastMonth, year]);

  const shortPeriodLabel = React.useMemo(() => {
    if (lastMonth < 1) return `${year}`;
    const end = MONTH_NAMES[Math.min(lastMonth, 12) - 1].slice(0, 3);
    return lastMonth === 1 ? `Jan ${year}` : `Jan – ${end} ${year}`;
  }, [lastMonth, year]);

  return {
    loading,
    error,
    topStations,
    perfectStations,
    periodLabel,
    shortPeriodLabel,
    totalMonths: Math.max(lastMonth, 0),
  };
}
