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

export type DashInterval = "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL";

export interface DashFilters {
  year: string;
  interval: DashInterval;
  period: string; // meaning depends on interval; "all" or a specific bucket
  provinces: SelectedLocation[];
  stations: SelectedStation[];
  city: RefFilter;
  category: RefFilter;
}

const empty: RefFilter = { no: "all", name: "", code: "" };

export const DEFAULT_FILTERS: DashFilters = {
  year: String(new Date().getFullYear()),
  interval: "MONTHLY",
  period: "all",
  provinces: [],
  stations: [],
  city: empty,
  category: empty,
};

/** Expands the interval/period selection into the concrete list of months. */
export function resolveReportMonths(interval: DashInterval, period: string): number[] {
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (interval === "ANNUAL") return ALL;
  if (period === "all" || !period) return ALL;
  if (interval === "MONTHLY") {
    const m = Number(period);
    return m >= 1 && m <= 12 ? [m] : ALL;
  }
  if (interval === "QUARTERLY") {
    switch (period) {
      case "q1": return [1, 2, 3];
      case "q2": return [4, 5, 6];
      case "q3": return [7, 8, 9];
      case "q4": return [10, 11, 12];
      default: return ALL;
    }
  }
  if (interval === "SEMESTER") {
    switch (period) {
      case "s1": return [1, 2, 3, 4, 5, 6];
      case "s2": return [7, 8, 9, 10, 11, 12];
      default: return ALL;
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
