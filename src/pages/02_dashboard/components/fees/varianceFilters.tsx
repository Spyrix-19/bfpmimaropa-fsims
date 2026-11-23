import * as React from "react";
import { ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import type { DashInterval } from "@/lib/filters";
import { buildYears } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Period options shared by the variance section and its station popup        */
/* -------------------------------------------------------------------------- */

export type VarianceInterval = Extract<DashInterval, "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL">;

export const VARIANCE_INTERVALS: { value: VarianceInterval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMESTER", label: "Semester" },
  { value: "ANNUAL", label: "Annual" },
];

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

export const VARIANCE_SUB_OPTIONS: Record<VarianceInterval, { value: string; label: string }[]> = {
  MONTHLY: [
    { value: "all", label: "All Month" },
    ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
  ],
  QUARTERLY: [
    { value: "all", label: "All Quarter" },
    { value: "1", label: "1st Quarter" },
    { value: "2", label: "2nd Quarter" },
    { value: "3", label: "3rd Quarter" },
    { value: "4", label: "4th Quarter" },
  ],
  SEMESTER: [
    { value: "all", label: "All Semester" },
    { value: "1", label: "1st Semester" },
    { value: "2", label: "2nd Semester" },
  ],
  ANNUAL: [],
};

export const DEFAULT_VARIANCE_INTERVAL: VarianceInterval = "SEMESTER";
export const DEFAULT_VARIANCE_SUB_PERIOD = "1";

export const firstSubOption = (interval: VarianceInterval) =>
  VARIANCE_SUB_OPTIONS[interval][0]?.value ?? "all";

/** Column caption, e.g. "1st Semester 2026". */
export function periodLabel(interval: VarianceInterval, sub: string, year: number) {
  if (interval === "ANNUAL") return `Annual ${year}`;
  const option = VARIANCE_SUB_OPTIONS[interval].find((o) => o.value === sub);
  return `${option?.label ?? ""} ${year}`.trim();
}

export function defaultVarianceYears(): number[] {
  const now = new Date().getFullYear();
  return [now - 1, now];
}

/** Picking provinces drops stations outside them. */
export function stationsWithinProvinces(
  provinces: SelectedLocation[],
  stations: SelectedStation[],
): SelectedStation[] {
  if (provinces.length === 0) return [];
  const allowed = new Set(provinces.map((p) => p.locationno));
  return stations.filter((s) => allowed.has(s.provinceno));
}

/** Picking stations adds their provinces. */
export function provincesIncludingStations(
  provinces: SelectedLocation[],
  stations: SelectedStation[],
): SelectedLocation[] {
  const merged = [...provinces];
  const known = new Set(merged.map((p) => p.locationno));
  stations.forEach((s) => {
    if (!s.provinceno || known.has(s.provinceno)) return;
    known.add(s.provinceno);
    merged.push({ locationno: s.provinceno, locationname: s.provincename });
  });
  return merged;
}

/* -------------------------------------------------------------------------- */
/*  Year selector — exactly two years                                          */
/* -------------------------------------------------------------------------- */

const REQUIRED_YEARS = 2;

export function TwoYearSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const options = React.useMemo(() => buildYears(), []);
  const label = value.length > 0 ? value.join(" vs ") : "Select 2 years";

  const toggleYear = (year: number) => {
    if (value.includes(year)) return; // always keep exactly two
    // Replace the oldest year so the picked one becomes part of the pair.
    const next = [...value.slice(1), year].sort((a, b) => a - b);
    onChange(next.slice(-REQUIRED_YEARS));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Comparison years"
          className="h-11 w-full shrink-0 justify-between rounded-lg border border-border/70 bg-card/80 px-3.5 text-sm font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:w-[180px] md:rounded-md"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose years
          </div>
          <div className="space-y-1">
            {options.map((year) => (
              <label
                key={year}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
              >
                <Checkbox
                  checked={value.includes(year)}
                  onCheckedChange={(checkedState: boolean | "indeterminate") => {
                    if (checkedState === "indeterminate") return;
                    toggleYear(year);
                  }}
                  aria-label={`Toggle ${year}`}
                />
                <span className="text-sm">{year}</span>
              </label>
            ))}
          </div>
          <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Only {REQUIRED_YEARS} years can be compared. Picking another year replaces the earlier
            one.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filter bar — identical on the dashboard section and the station popup      */
/* -------------------------------------------------------------------------- */

const fieldClass =
  "h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md";
const selectClass =
  "h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:rounded-md";

export interface VarianceFilterBarProps {
  years: number[];
  onYearsChange: (next: number[]) => void;
  interval: VarianceInterval;
  onIntervalChange: (next: VarianceInterval) => void;
  subPeriod: string;
  onSubPeriodChange: (next: string) => void;
  provinces: SelectedLocation[];
  onProvincesChange: (next: SelectedLocation[]) => void;
  stations: SelectedStation[];
  onStationsChange: (next: SelectedStation[]) => void;
  stationYear: number;
  provinceLocked: boolean;
  provincename?: string;
  stationLocked: boolean;
  stationname?: string;
  /** Extra controls rendered inside the filter group (e.g. status filter, reset). */
  children?: React.ReactNode;
}

export function VarianceFilterBar(props: VarianceFilterBarProps) {
  const {
    years,
    onYearsChange,
    interval,
    onIntervalChange,
    subPeriod,
    onSubPeriodChange,
    provinces,
    onProvincesChange,
    stations,
    onStationsChange,
    stationYear,
    provinceLocked,
    provincename,
    stationLocked,
    stationname,
    children,
  } = props;

  const controls = (
    <>
      <TwoYearSelect value={years} onChange={onYearsChange} />

      <Select value={interval} onValueChange={(v) => onIntervalChange(v as VarianceInterval)}>
        <SelectTrigger aria-label="Period" className={`${selectClass} md:min-w-[140px] md:w-[150px]`}>
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {VARIANCE_INTERVALS.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {interval !== "ANNUAL" && (
        <Select value={subPeriod} onValueChange={onSubPeriodChange}>
          <SelectTrigger aria-label="Sub-period" className={`${selectClass} md:min-w-[150px] md:w-[160px]`}>
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {VARIANCE_SUB_OPTIONS[interval].map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {provinceLocked ? (
        <ReadOnlyField
          value={provincename}
          placeholder="All provinces"
          title="Restricted to your assigned province"
          className={fieldClass}
        />
      ) : (
        <LocationMultiSelect
          mode="location"
          value={provinces}
          locationtype="PROVINCE"
          parentcode={MIMAROPA_REGION_CODE}
          onChange={onProvincesChange}
          placeholder="All provinces"
          hideCode
          className={fieldClass}
        />
      )}

      {stationLocked ? (
        <ReadOnlyField
          value={stationname}
          placeholder="All stations"
          title="Restricted to your assigned station"
          className={fieldClass}
        />
      ) : (
        <StationMultiSelect
          mode="station"
          value={stations}
          provinces={provinces.map((p) => ({ provinceno: p.locationno }))}
          reportyear={stationYear}
          onChange={onStationsChange}
          placeholder="All stations"
          alwaysEnabled
          className={fieldClass}
        />
      )}
    </>
  );

  return (
    <>
      {/* Desktop: inline filters */}
      <div className="hidden rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:block md:bg-muted/20 md:p-2">
        <div className="flex w-full flex-wrap items-center justify-end gap-2">{controls}</div>
        {children ? (
          <div className="mt-2 border-t border-border/60 pt-2">{children}</div>
        ) : null}
      </div>

      {/* Mobile: all filters inside a popover */}
      <div className="md:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2">
              <span className="flex items-center gap-2">
                <Filter className="h-4 w-4 shrink-0" />
                Filters
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] p-3" align="start">
            <div className="grid grid-cols-1 gap-2">{controls}</div>
            {children ? (
              <div className="mt-2 border-t border-border/60 pt-2">{children}</div>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
