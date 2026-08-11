import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilters, toISODate } from "@/lib/filters";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import FilterField from "@/components/filter-field";
import { ModuleFilterBar, type ModuleFilterState } from "@/components/shared/ModuleFilterBar";

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
    const months =
      p === "all"
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : p
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((m) => m >= 1 && m <= 12);
    const legacyWeeklyMatch = /^week:(\d{1,2}):([1-6](?:,[1-6])*)$/.exec(p);
    const weeklyMatch = /^week:(\d{4}):([1-5]?\d(?:,[1-5]?\d)*)$/.exec(p);
    const weeklyMonth = legacyWeeklyMatch ? Number(legacyWeeklyMatch[1]) : null;
    const weeklyYear = weeklyMatch ? Number(weeklyMatch[1]) : null;
    const weeklyWeeks = weeklyMatch
      ? weeklyMatch[2]
          .split(",")
          .map((v) => Number(v.trim()))
          .filter((v) => v >= 1 && v <= 53)
          .map((v) => `w${v}`)
      : legacyWeeklyMatch
        ? legacyWeeklyMatch[2]
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((v) => v >= 1 && v <= 53)
            .map((v) => `w${v}`)
        : [];
    const weeklyDate =
      filters.interval === "WEEKLY" && weeklyMonth
        ? `all:${new Date(Number(filters.year), weeklyMonth - 1, 1).toISOString().slice(0, 10)}`
        : filters.interval === "WEEKLY" && weeklyYear
          ? `all:${new Date(weeklyYear, 0, 1).toISOString().slice(0, 10)}`
          : `all:${toISODate(today)}`;
    return {
      year: filters.year,
      interval: filters.interval,
      date:
        filters.interval === "DAILY"
          ? p && p !== "all"
            ? p
            : `all:${toISODate(today)}`
          : filters.interval === "WEEKLY"
            ? weeklyDate
            : `all:${toISODate(today)}`,
      months: filters.interval === "MONTHLY" ? (months.length ? months : []) : [],
      week: weeklyWeeks.length ? weeklyWeeks.join(",") : "all",
      quarter: /^q[1-4]$/.test(p) ? p : p === "all" ? "all" : "all",
      semester: /^s[12]$/.test(p) ? p : p === "all" ? "all" : "all",
    };
  }, [filters.year, filters.interval, filters.period, today]);

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
      case "WEEKLY": {
        const weekValue =
          next.week === "all"
            ? "all"
            : next.week
                .split(",")
                .map((part) => part.trim().replace(/^w/i, ""))
                .filter((part) => /^\d+$/.test(part))
                .map((part) => Number(part))
                .filter((part) => part >= 1 && part <= 53)
                .sort((a, b) => a - b)
                .join(",");
        period = weekValue === "all" ? "all" : `week:${next.year}:${weekValue}`;
        break;
      }
      case "MONTHLY":
        period =
          next.months.length === 0 || next.months.length === 12 ? "all" : next.months.join(",");
        break;
      case "QUARTERLY":
        period = next.quarter === "all" ? "all" : next.quarter;
        break;
      case "SEMESTER":
        period = next.semester === "all" ? "all" : next.semester;
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
        filters.provinces.length === 1 && filters.provinces[0].locationno === locked.locationno;
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
        filters.stations.length === 1 && filters.stations[0].stationno === locked.stationno;
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

  // Public (not logged in): the full filter bar is exposed. Role-based
  // province/station locking below still applies once signed in.

  return (
    <ModuleFilterBar
      title="Dashboard Filters"
      years={YEARS}
      state={filterState}
      onChange={handleFilterChange}
      onReset={reset}
      intervals={["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
    >
      <FilterField label="Provinces">
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
      </FilterField>

      <FilterField label="Stations">
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
      </FilterField>
    </ModuleFilterBar>
  );
}
