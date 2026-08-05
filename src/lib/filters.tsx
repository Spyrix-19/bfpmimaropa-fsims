import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SelectedLocation } from "@/components/location-multi-select";
import type { SelectedStation } from "@/components/station-multi-select";

/**
 * Global dashboard/report filters. Reference-data fields store both the
 * backend key (`no`) and the display name so the UI can render without
 * re-fetching. `"all"` means "no filter applied".
 */
export interface RefFilter {
  no: string; // "all" or backend id (locationno / stationno / detno)
  name: string; // display label
  code?: string; // optional (e.g. locationcode for scoping children)
}

export type DashInterval = "ALL" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL";

export interface DashFilters {
  year: string;
  interval: DashInterval;
  /**
   * Meaning depends on interval: "all" or a specific bucket
   * (month number / `q1..q4` / `s1..s2`). When the interval is `DAILY`
   * this holds the selected calendar date as an ISO `yyyy-mm-dd` string.
   */
  period: string;
  provinces: SelectedLocation[];
  stations: SelectedStation[];
  city: RefFilter;
  category: RefFilter;
}

const empty: RefFilter = { no: "all", name: "", code: "" };

/** Local (not UTC) ISO `yyyy-mm-dd` for the given date. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parses an ISO `yyyy-mm-dd` string into a local Date (null when invalid). */
export function fromISODate(v: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export const DEFAULT_FILTERS: DashFilters = {
  year: String(new Date().getFullYear()),
  interval: "DAILY",
  period: `all:${toISODate(new Date())}`,
  provinces: [],
  stations: [],
  city: empty,
  category: empty,
};

/** Expands the interval/period selection into the concrete list of months. */
export function resolveReportMonths(interval: DashInterval, period: string): number[] {
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (interval === "ALL" || interval === "ANNUAL") return ALL;
  if (interval === "DAILY") {
    // `period` carries the selected ISO date; narrow the query to its month.
    const d = fromISODate(period.startsWith("all:") ? period.slice(4) : period);
    return d ? [d.getMonth() + 1] : ALL;
  }
  if (interval === "WEEKLY") {
    const weekYearMatch = /^week:(\d{4}):([1-5]?\d(?:,[1-5]?\d)*)$/.exec(period ?? "");
    if (weekYearMatch) {
      const year = Number(weekYearMatch[1]);
      const weeks = weekYearMatch[2]
        .split(",")
        .map((p) => Number(p.trim()))
        .filter((w) => w >= 1 && w <= 53);
      if (!weeks.length) return ALL;

      const months = new Set<number>();
      weeks.forEach((week) => {
        const weekStart = new Date(year, 0, 4);
        const dayOfWeek = weekStart.getDay();
        const mondayOfWeekOne = new Date(weekStart);
        mondayOfWeekOne.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
        const start = new Date(mondayOfWeekOne);
        start.setDate(mondayOfWeekOne.getDate() + (week - 1) * 7);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        months.add(start.getMonth() + 1);
        months.add(end.getMonth() + 1);
      });

      return [...months].sort((a, b) => a - b);
    }

    const legacyMatch = /^week:(\d{1,2}):([1-6](?:,[1-6])*)$/.exec(period ?? "");
    if (legacyMatch) {
      const month = Number(legacyMatch[1]);
      return month >= 1 && month <= 12 ? [month] : ALL;
    }
    return ALL;
  }
  if (period === "all" || !period) return ALL;

  if (interval === "MONTHLY") {
    // `period` may hold a single month ("3") or a comma-separated multi-select ("3,4,5").
    const months = period
      .split(",")
      .map((p) => Number(p.trim()))
      .filter((m) => m >= 1 && m <= 12);
    return months.length ? [...new Set(months)].sort((a, b) => a - b) : ALL;
  }
  if (interval === "QUARTERLY") {
    switch (period) {
      case "q1":
        return [1, 2, 3];
      case "q2":
        return [4, 5, 6];
      case "q3":
        return [7, 8, 9];
      case "q4":
        return [10, 11, 12];
      default:
        return ALL;
    }
  }
  if (interval === "SEMESTER") {
    switch (period) {
      case "s1":
        return [1, 2, 3, 4, 5, 6];
      case "s2":
        return [7, 8, 9, 10, 11, 12];
      default:
        return ALL;
    }
  }
  return ALL;
}

const FiltersCtx = createContext<{
  filters: DashFilters;
  setFilters: (f: DashFilters) => void;
  reset: () => void;
} | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DashFilters>(DEFAULT_FILTERS);
  const value = useMemo(
    () => ({ filters, setFilters, reset: () => setFilters(DEFAULT_FILTERS) }),
    [filters],
  );
  return <FiltersCtx.Provider value={value}>{children}</FiltersCtx.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersCtx);
  if (!ctx) throw new Error("useFilters must be within FiltersProvider");
  return ctx;
}
