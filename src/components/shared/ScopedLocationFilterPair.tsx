import * as React from "react";
import FilterField from "@/components/filter-field";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { EMPTY_GUID } from "@/lib/api-envelope";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import type { SearchLocationModel } from "@/types/locationType";
import type { SearchStationModel } from "@/types/stationTypes";

/**
 * Reusable "Province + Station" filter pair with scope-aware locking.
 * Extracted from Monitoring and Target Reference where the exact same
 * markup was duplicated.
 *
 * The `onProvinceChange` / `onStationChange` signatures match the
 * underlying `LocationSearchSelect` and `StationSearchSelect` components
 * so callers can pass their existing handlers unchanged.
 */
export interface LocationScopeInfo {
  provinceLocked: boolean;
  stationLocked: boolean;
  provinceno: string;
  provincename: string;
  stationno: string;
  stationname: string;
}

export function ScopedLocationFilterPair({
  scope,
  provinceValue,
  provinceLabel,
  stationValue,
  stationLabel,
  onProvinceChange,
  onStationChange,
  showAllOption = true,
  hideLabels = false,
}: {
  scope: LocationScopeInfo;
  provinceValue: string;
  provinceLabel: string;
  stationValue: string;
  stationLabel: string;
  onProvinceChange: (
    locationno: string,
    locationname: string,
    location?: SearchLocationModel,
  ) => void;
  onStationChange: (
    stationno: string,
    stationname: string,
    provinceno?: string,
    station?: SearchStationModel,
  ) => void;
  showAllOption?: boolean;
  hideLabels?: boolean;
}) {
  const stationProvinceNo =
    provinceValue && provinceValue !== EMPTY_GUID
      ? provinceValue
      : scope.provinceLocked
        ? scope.provinceno
        : undefined;

  const Field = hideLabels
    ? ({ children }: { label: string; children: React.ReactNode }) => <>{children}</>
    : FilterField;

  return (
    <>
      <Field label="Province">
        {scope.provinceLocked ? (
          <ReadOnlyField
            value={provinceLabel || scope.provincename}
            placeholder="Select province"
            title="Restricted to your assigned province"
          />
        ) : (
          <LocationSearchSelect
            value={provinceValue}
            valueName={provinceLabel || undefined}
            locationtype="PROVINCE"
            parentcode={MIMAROPA_REGION_CODE}
            onChange={onProvinceChange}
            placeholder="Select province"
            className="w-full"
            hideCode
            showAllOption={showAllOption}
          />
        )}
      </Field>

      <Field label="Station">
        {scope.stationLocked ? (
          <ReadOnlyField
            value={stationLabel || scope.stationname}
            placeholder="Select station"
            title="Restricted to your assigned station"
          />
        ) : (
          <StationSearchSelect
            value={stationValue}
            valueName={stationLabel || undefined}
            provinceno={stationProvinceNo}
            onChange={onStationChange}
            placeholder="Select station"
            className="w-full"
            showAllOption={showAllOption}
          />
        )}
      </Field>
    </>
  );
}
