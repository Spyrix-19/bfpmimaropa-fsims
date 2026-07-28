import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import React from "react";
import { useFilters } from "@/lib/filters";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";

export function FilterBar() {
  const { filters, setFilters, reset } = useFilters();
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const YEARS = React.useMemo(buildYears, []);
  const MONTHS = [
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
  const set = (patch: Partial<typeof filters>) => setFilters({ ...filters, ...patch });

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

        <Select value={filters.month} onValueChange={(v) => set({ month: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="col-span-2 justify-self-end self-center md:col-span-1"
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}
