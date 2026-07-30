import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useFilters, toISODate } from "@/lib/filters";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import {
  ModuleFilterBar,
  type ModuleFilterState,
} from "@/components/shared/ModuleFilterBar";

/**
 * Dashboard filter bar. Uses the shared `ModuleFilterBar` so the Dashboard
 * looks and behaves exactly like Monitoring / Accomplished Notice /
 * Target Reference. The global `DashFilters` state is unchanged; this
 * component only adapts it to the shared filter state shape.
 */
export function FilterBar() {
  const { filters, setFilters, reset } = useFilters();
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const YEARS = React.useMemo(buildYears, []);
  const set = (patch: Partial<typeof filters>) => setFilters({ ...filters, ...patch });

  /* --- Adapter: DashFilters <-> ModuleFilterState ------------------- */
  const today = React.useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;

  const filterState: ModuleFilterState = React.useMemo(() => {
    const p = filters.period ?? "";
    const months = p
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((m) => m >= 1 && m <= 12);
    return {
      year: filters.year,
      interval: filters.interval,
      date: filters.interval === "DAILY" && p ? p : toISODate(today),
      months: filters.interval === "MONTHLY" && months.length ? months : [currentMonth],
      quarter: /^q[1-4]$/.test(p) ? p : `q${Math.ceil(currentMonth / 3)}`,
      semester: /^s[12]$/.test(p) ? p : currentMonth <= 6 ? "s1" : "s2",
    };
  }, [filters.year, filters.interval, filters.period, today, currentMonth]);

  const handleFilterChange = (patch: Partial<ModuleFilterState>) => {
    const next = { ...filterState, ...patch };
    let period = filters.period;
    switch (next.interval) {
      case "ALL":
      case "ANNUAL":
        period = "all";
        break;
      case "DAILY":
        period = next.date;
        break;
      case "MONTHLY":
        period = next.months.join(",");
        break;
      case "QUARTERLY":
        period = next.quarter;
        break;
      case "SEMESTER":
        period = next.semester;
        break;
      default:
        period = "all";
    }
    set({ year: next.year, interval: next.interval, period });
  };

  // Enforce role-based scope: seed locked province/station into the filter
  // state so all dashboard queries respect the user's assigned scope.
  React.useEffect(() => {
    if (!isAuthenticated) return;
    const patch: Partial<typeof filters> = {};
    if (scope.provinceLocked && scope.provinceno) {
      const locked: SelectedLocation = {
        locationno: scope.provinceno,
        locationname: scope.provincename,
      };
      const same =
        filters.provinces.length === 1 &&
        filters.provinces[0].locationno === locked.locationno;
      if (!same) patch.provinces = [locked];
    }
    if (scope.stationLocked && scope.stationno) {
      const locked: SelectedStation = {
        stationno: scope.stationno,
        stationname: scope.stationname,
        provinceno: scope.provinceno,
        provincename: scope.provincename,
      };
      const same =
        filters.stations.length === 1 &&
        filters.stations[0].stationno === locked.stationno;
      if (!same) patch.stations = [locked];
    }
    if (Object.keys(patch).length) setFilters({ ...filters, ...patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
  ]);

  const handleProvincesChange = (next: SelectedLocation[]) => {
    if (next.length === 0) {
      set({ provinces: [], stations: [] });
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    set({
      provinces: next,
      stations: filters.stations.filter((s) => allowed.has(s.provinceno)),
    });
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    // Merge provinces derived from station picks with explicit selections.
    const merged = [...filters.provinces];
    const known = new Set(merged.map((p) => p.locationno));
    next.forEach((s) => {
      if (!s.provinceno || known.has(s.provinceno)) return;
      known.add(s.provinceno);
      merged.push({ locationno: s.provinceno, locationname: s.provincename });
    });
    set({ stations: next, provinces: merged });
  };

  // Public (not logged in): only the Year filter is exposed.
  if (!isAuthenticated) {
    return (
      <div className="glass-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Dashboard Filters
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <Select value={filters.year} onValueChange={(v) => set({ year: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <ModuleFilterBar
      title="Dashboard Filters"
      years={YEARS}
      state={filterState}
      onChange={handleFilterChange}
      onReset={reset}
    >
      {scope.provinceLocked ? (
        <ReadOnlyField
          value={scope.provincename}
          placeholder="All provinces"
          title="Restricted to your assigned province"
        />
      ) : (
        <LocationMultiSelect
          mode="location"
          value={filters.provinces}
          locationtype="PROVINCE"
          parentcode={MIMAROPA_REGION_CODE}
          onChange={handleProvincesChange}
          placeholder="All provinces"
          hideCode
          className="w-full"
        />
      )}

      {scope.stationLocked ? (
        <ReadOnlyField
          value={scope.stationname}
          placeholder="All stations"
          title="Restricted to your assigned station"
        />
      ) : (
        <StationMultiSelect
          mode="station"
          value={filters.stations}
          provinces={filters.provinces.map((p) => ({ provinceno: p.locationno }))}
          reportyear={Number(filters.year)}
          onChange={handleStationsChange}
          placeholder="All stations"
          alwaysEnabled
        />
      )}
    </ModuleFilterBar>
  );
}
