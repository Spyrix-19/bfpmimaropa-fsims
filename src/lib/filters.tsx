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

/* ------------------------------------------------------------------ *
 * Backend date-range resolution
 * ------------------------------------------------------------------ */

/** Backend interval codes: 1 Daily, 2 Weekly, 3 Monthly, 4 Quarterly, 5 Semester, 6 Annual. */
export const INTERVAL_CODE: Record<DashInterval, number> = {
  DAILY: 1,
  WEEKLY: 2,
  MONTHLY: 3,
  QUARTERLY: 4,
  SEMESTER: 5,
  ANNUAL: 6,
  ALL: 6,
};

/** `MM/dd/yyyy` (no leading zeros are required by the API, but kept padded). */
export function toApiDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

/** Sunday–Saturday week ranges for a year, clipped to the year boundaries. */
export function getYearWeekRanges(year: number): Array<{ week: number; start: Date; end: Date }> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const ranges: Array<{ week: number; start: Date; end: Date }> = [];
  const cursor = new Date(yearStart);
  cursor.setDate(yearStart.getDate() - yearStart.getDay()); // back to Sunday
  let week = 1;
  while (cursor <= yearEnd && week <= 60) {
    const end = new Date(cursor);
    end.setDate(cursor.getDate() + 6);
    ranges.push({
      week,
      start: new Date(cursor < yearStart ? yearStart : cursor),
      end: new Date(end > yearEnd ? yearEnd : end),
    });
    cursor.setDate(cursor.getDate() + 7);
    week += 1;
  }
  return ranges;
}

/**
 * Resolves the current interval/period selection into the backend payload
 * shape: `{ interval, startdate, enddate }` with `MM/dd/yyyy` dates.
 * The range is always the smallest selected date -> largest selected date.
 */
export function resolveDateRange(
  year: number,
  interval: DashInterval,
  period: string,
): { interval: number; startdate: string; enddate: string } {
  const code = INTERVAL_CODE[interval] ?? 6;
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const monthRange = (months: number[]) => {
    const valid = months.filter((m) => m >= 1 && m <= 12);
    if (!valid.length) return { start: yearStart, end: yearEnd };
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    return { start: new Date(year, min - 1, 1), end: new Date(year, max, 0) };
  };

  let start = yearStart;
  let end = yearEnd;

  if (interval === "DAILY") {
    const isAll = (period ?? "").startsWith("all:");
    const iso = isAll ? period.slice(4) : period;
    const d = fromISODate(iso);
    if (d) {
      if (isAll) {
        // "All days" of the referenced month.
        start = new Date(d.getFullYear(), d.getMonth(), 1);
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      } else {
        start = d;
        end = d;
      }
    }
  } else if (interval === "WEEKLY") {
    const match = /^week:(\d{4}):([\d,]+)$/.exec(period ?? "");
    const weekYear = match ? Number(match[1]) : year;
    const weeks = match
      ? match[2]
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((w) => w >= 1 && w <= 53)
      : [];
    const ranges = getYearWeekRanges(weekYear);
    const picked = weeks.length ? ranges.filter((r) => weeks.includes(r.week)) : ranges;
    if (picked.length) {
      start = picked.reduce((a, r) => (r.start < a ? r.start : a), picked[0].start);
      end = picked.reduce((a, r) => (r.end > a ? r.end : a), picked[0].end);
    }
  } else if (interval === "MONTHLY") {
    const months =
      !period || period === "all"
        ? [1, 12]
        : period
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((m) => m >= 1 && m <= 12);
    ({ start, end } = monthRange(months));
  } else if (interval === "QUARTERLY" || interval === "SEMESTER") {
    ({ start, end } = monthRange(resolveReportMonths(interval, period)));
  }

  return { interval: code, startdate: toApiDate(start), enddate: toApiDate(end) };
}

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
