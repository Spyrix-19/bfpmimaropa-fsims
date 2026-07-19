import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

export interface DashFilters {
  year: string;
  semester: "all" | "1" | "2";
  month: string;
  province: RefFilter;
  city: RefFilter;
  station: RefFilter;
  category: RefFilter;
}

const empty: RefFilter = { no: "all", name: "", code: "" };

export const DEFAULT_FILTERS: DashFilters = {
  year: String(new Date().getFullYear()),
  semester: "all",
  month: "all",
  province: empty,
  city: empty,
  station: empty,
  category: empty,
};

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
