import * as React from "react";
import FilterField from "@/components/filter-field";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { EMPTY_GUID } from "@/lib/api-envelope";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import type { LocationScopeInfo } from "@/components/shared/ScopedLocationFilterPair";

/**
 * Multi-select variant of `ScopedLocationFilterPair`.
 *
 * Mirrors the Dashboard filter bar: provinces and stations are both
 * multi-select, role scope still locks the fields, and the selections are
 * projected into the `provinces: [{ provinceno, stationnos[] }]` payload the
 * Ledger / Export endpoints expect.
 */

export interface ProvinceStationParam {
  provinceno: string;
  stationnos: string[];
}

export interface ScopedLocationMulti {
  provinces: SelectedLocation[];
  stations: SelectedStation[];
  setProvinces: (next: SelectedLocation[]) => void;
  setStations: (next: SelectedStation[]) => void;
  reset: () => void;
  /** `provinces` payload for Ledger / Export requests. */
  provinceParams: ProvinceStationParam[];
  /** Stable primitive key for effect dependencies. */
  paramsKey: string;
  /** Back-compat single-value projections (EMPTY_GUID / "ALL" when not exactly one). */
  provinceno: string;
  provincename: string;
  stationno: string;
  stationname: string;
}

export function useScopedLocationMulti(scope: LocationScopeInfo): ScopedLocationMulti {
  const lockedProvinces = React.useMemo<SelectedLocation[]>(
    () =>
      scope.provinceLocked && scope.provinceno
        ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
        : [],
    [scope.provinceLocked, scope.provinceno, scope.provincename],
  );
  const lockedStations = React.useMemo<SelectedStation[]>(
    () =>
      scope.stationLocked && scope.stationno
        ? [
            {
              stationno: scope.stationno,
              stationname: scope.stationname,
              provinceno: scope.provinceno,
              provincename: scope.provincename,
            },
          ]
        : [],
    [scope.stationLocked, scope.stationno, scope.stationname, scope.provinceno, scope.provincename],
  );

  const [provinces, setProvincesState] = React.useState<SelectedLocation[]>(lockedProvinces);
  const [stations, setStationsState] = React.useState<SelectedStation[]>(lockedStations);

  // Re-apply scope defaults whenever the authenticated scope resolves/changes.
  React.useEffect(() => {
    setProvincesState(lockedProvinces);
    setStationsState(lockedStations);
  }, [lockedProvinces, lockedStations]);

  const setProvinces = React.useCallback(
    (next: SelectedLocation[]) => {
      if (scope.provinceLocked) return;
      setProvincesState(next);
      if (next.length === 0) {
        if (!scope.stationLocked) setStationsState([]);
        return;
      }
      const allowed = new Set(next.map((p) => p.locationno));
      if (!scope.stationLocked) {
        setStationsState((prev) => prev.filter((s) => allowed.has(s.provinceno)));
      }
    },
    [scope.provinceLocked, scope.stationLocked],
  );

  const setStations = React.useCallback(
    (next: SelectedStation[]) => {
      if (scope.stationLocked) return;
      setStationsState(next);
      if (scope.provinceLocked) return;
      // Merge provinces implied by the station picks.
      setProvincesState((prev) => {
        const merged = [...prev];
        const known = new Set(merged.map((p) => p.locationno));
        next.forEach((s) => {
          if (!s.provinceno || known.has(s.provinceno)) return;
          known.add(s.provinceno);
          merged.push({ locationno: s.provinceno, locationname: s.provincename });
        });
        return merged;
      });
    },
    [scope.provinceLocked, scope.stationLocked],
  );

  const reset = React.useCallback(() => {
    setProvincesState(lockedProvinces);
    setStationsState(lockedStations);
  }, [lockedProvinces, lockedStations]);

  const provinceParams = React.useMemo<ProvinceStationParam[]>(() => {
    const byProvince = new Map<string, string[]>();
    provinces.forEach((p) => byProvince.set(p.locationno, []));
    stations.forEach((s) => {
      const key = s.provinceno || EMPTY_GUID;
      if (!byProvince.has(key)) byProvince.set(key, []);
      byProvince.get(key)!.push(s.stationno);
    });
    return Array.from(byProvince.entries()).map(([provinceno, stationnos]) => ({
      provinceno,
      stationnos,
    }));
  }, [provinces, stations]);

  const paramsKey = React.useMemo(() => JSON.stringify(provinceParams), [provinceParams]);

  return {
    provinces,
    stations,
    setProvinces,
    setStations,
    reset,
    provinceParams,
    paramsKey,
    provinceno: provinces.length === 1 ? provinces[0].locationno : EMPTY_GUID,
    provincename: provinces.length === 1 ? provinces[0].locationname : "ALL",
    stationno: stations.length === 1 ? stations[0].stationno : EMPTY_GUID,
    stationname: stations.length === 1 ? stations[0].stationname : "ALL",
  };
}

export function ScopedLocationMultiFilterPair({
  scope,
  selection,
  reportyear,
  hideLabels = false,
}: {
  scope: LocationScopeInfo;
  selection: ScopedLocationMulti;
  reportyear?: number;
  hideLabels?: boolean;
}) {
  const Field = hideLabels
    ? ({ children }: { label: string; children: React.ReactNode }) => <>{children}</>
    : FilterField;

  return (
    <>
      <Field label="Provinces">
        {scope.provinceLocked ? (
          <ReadOnlyField
            value={scope.provincename}
            placeholder="All provinces"
            title="Restricted to your assigned province"
          />
        ) : (
          <LocationMultiSelect
            mode="location"
            value={selection.provinces}
            locationtype="PROVINCE"
            parentcode={MIMAROPA_REGION_CODE}
            onChange={selection.setProvinces}
            placeholder="All provinces"
            hideCode
            className="w-full"
          />
        )}
      </Field>

      <Field label="Stations">
        {scope.stationLocked ? (
          <ReadOnlyField
            value={scope.stationname}
            placeholder="All stations"
            title="Restricted to your assigned station"
          />
        ) : (
          <StationMultiSelect
            mode="station"
            value={selection.stations}
            provinces={selection.provinces.map((p) => ({ provinceno: p.locationno }))}
            reportyear={reportyear}
            onChange={selection.setStations}
            placeholder="All stations"
            alwaysEnabled
            className="w-full"
          />
        )}
      </Field>
    </>
  );
}

export default ScopedLocationMultiFilterPair;
