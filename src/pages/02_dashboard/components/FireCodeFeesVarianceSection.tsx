import * as React from "react";
import { ChevronDown, Coins, Filter, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { buildYears, cn } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";

import { unwrap } from "@/lib/api-envelope";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
} from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type {
  DashboardFireCodeFeeVarianceModel,
  DashboardStationFeeCollectionModel,
} from "@/types/dashboardType";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { resolveReportMonths, toISODate } from "@/lib/filters";
import { REPORT_INTERVAL_CODES } from "@/lib/fsims-constants";
import type { DashInterval } from "@/lib/filters";
import {
  ModuleFilterBar,
  type ModuleFilterState,
} from "@/components/shared/ModuleFilterBar";
import FilterField from "@/components/filter-field";

import { peso } from "./fees/feeColumns";

/* -------------------------------------------------------------------------- */
/*  Period filters                                                             */
/* -------------------------------------------------------------------------- */

type Interval = Extract<DashInterval, "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL">;

const INTERVALS: { value: Interval; label: string }[] = [
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

const SUB_OPTIONS: Record<Interval, { value: string; label: string }[]> = {
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

export const FIRE_CODE_FEES_VARIANCE_STATION_HEADERS = [
  "STATION",
  "FCCT + Filing Fees",
  "FSI Fee (Business)",
  "FSI Fee (Occupancy)",
  "Fire Code Tax & Clearances",
  "Administrative Fines",
  "Other Fees",
  "TOTAL",
] as const;

const VARIANCE_GROUPS = [
  { code: "FCCT", label: "FCCT + Filing Fees", categoryNos: [541, 560] },
  { code: "FSIB", label: "FSI Fee (Business)", categoryNos: [547] },
  { code: "FSIO", label: "FSI Fee (Occupancy)", categoryNos: [546] },
  {
    code: "FCTC",
    label: "Fire Code Tax & Clearances",
    categoryNos: [542, 543, 544, 545, 548, 549, 550, 551, 552, 553, 554, 555, 556],
  },
  { code: "AF", label: "Administrative Fines", categoryNos: [557] },
  {
    code: "OF",
    label: "Other Fees",
    categoryNos: [558, 559, 561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572],
  },
] as const;

function buildVarianceTotals(
  payload: DashboardFireCodeFeeVarianceModel[] | null,
  years: number[],
): Record<number, Record<string, number>> {
  const totals: Record<number, Record<string, number>> = {};
  for (const year of years) {
    totals[year] = Object.fromEntries(VARIANCE_GROUPS.map((group) => [group.code, 0]));
  }

  for (const row of payload ?? []) {
    const year = Number(row?.reportyear) || 0;
    if (!totals[year]) continue;

    const categoryNo = Number(row?.feecateg ?? 0) || 0;
    const amount = Number(row?.collectionamount ?? 0) || 0;
    const group = VARIANCE_GROUPS.find((item) =>
      (item.categoryNos as readonly number[]).includes(categoryNo),
    );
    if (!group) continue;
    totals[year][group.code] += amount;
  }

  return totals;
}

/* -------------------------------------------------------------------------- */
/*  Station performance — per-station totals for the same fee groups           */
/* -------------------------------------------------------------------------- */

interface StationVarianceRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provincename: string;
  logourl: string;
  amounts: Record<string, number>;
  total: number;
}

/**
 * Aggregates the PerStation payload into one row per station for `year`,
 * summing collection amounts into the same VARIANCE_GROUPS used by the
 * main comparison table. Category numbers not in a group are ignored, so
 * the row totals stay comparable with the main table.
 */
export function buildStationVarianceRows(
  payload: DashboardStationFeeCollectionModel[] | null,
  year: number,
): StationVarianceRow[] {
  const rows: StationVarianceRow[] = [];

  for (const station of (payload ?? []) as unknown as Record<string, unknown>[]) {
    const stationno = String(station?.Stationno ?? station?.stationno ?? "");
    const stationname = String(station?.Stationname ?? station?.stationname ?? "");
    const yearlyList = (station?.yearlyFeeList ?? []) as Record<string, unknown>[];

    const amounts: Record<string, number> = {};
    for (const group of VARIANCE_GROUPS) amounts[group.code] = 0;
    let total = 0;

    for (const yearEntry of yearlyList) {
      if (Number(yearEntry?.reportyear) !== year) continue;
      for (const fee of (yearEntry?.feeList ?? []) as Record<string, unknown>[]) {
        const categoryNo = Number(fee?.feecateg ?? 0) || 0;
        const amount = Number(fee?.collectionamount ?? 0) || 0;
        const group = VARIANCE_GROUPS.find((item) =>
          (item.categoryNos as readonly number[]).includes(categoryNo),
        );
        if (!group) continue;
        amounts[group.code] += amount;
        total += amount;
      }
    }

    rows.push({
      stationno,
      stationcode: String(station?.Stationcode ?? station?.stationcode ?? ""),
      stationname,
      provincename: String(station?.Provincename ?? station?.provincename ?? ""),
      logourl: String(station?.Logourl ?? station?.logourl ?? ""),
      amounts,
      total,
    });
  }

  return rows.sort(
    (a, b) =>
      a.provincename.localeCompare(b.provincename) ||
      a.stationname.localeCompare(b.stationname) ||
      a.stationno.localeCompare(b.stationno),
  );
}

/** Column caption, e.g. "1st Semester 2026". */
function periodLabel(interval: Interval, sub: string, year: number) {
  if (interval === "ANNUAL") return `Annual ${year}`;
  const option = SUB_OPTIONS[interval].find((o) => o.value === sub);
  return `${option?.label ?? ""} ${year}`.trim();
}

/* -------------------------------------------------------------------------- */
/*  Station Detail dialog filters                                              */
/* -------------------------------------------------------------------------- */

/**
 * Filter state owned by the Station Detail dialog. It is seeded from the
 * section's own filters when the dialog opens and never writes back, so
 * tweaking the dialog does not disturb the year-over-year comparison.
 */
interface StationDialogFilters {
  year: string;
  interval: Interval;
  period: string;
  provinces: SelectedLocation[];
  stations: SelectedStation[];
}

/* -------------------------------------------------------------------------- */
/*  Year selector — exactly two years                                          */
/* -------------------------------------------------------------------------- */

const REQUIRED_YEARS = 2;

function defaultYears(): number[] {
  const now = new Date().getFullYear();
  return [now - 1, now];
}

function TwoYearSelect({
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
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesVarianceSection() {
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const [years, setYears] = React.useState<number[]>(defaultYears);
  const [interval, setInterval] = React.useState<Interval>("SEMESTER");
  const [subPeriod, setSubPeriod] = React.useState<string>("1");
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>([]);
  const [stations, setStations] = React.useState<SelectedStation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [stationModalOpen, setStationModalOpen] = React.useState(false);
  const [groupTotals, setGroupTotals] = React.useState<Record<number, Record<string, number>>>({});
  const [stationPayload, setStationPayload] = React.useState<
    DashboardStationFeeCollectionModel[] | null
  >(null);
  const [stationLoading, setStationLoading] = React.useState(false);
  /** Filters owned by the Station Detail dialog; seeded from the section on open. */
  const [stationFilters, setStationFilters] = React.useState<StationDialogFilters>({
    year: "",
    interval: "SEMESTER",
    period: "all",
    provinces: [],
    stations: [],
  });

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (scope.provinceLocked && scope.provinceno) {
      setProvinces((prev) =>
        prev.length === 1 && prev[0].locationno === scope.provinceno
          ? prev
          : [{ locationno: scope.provinceno, locationname: scope.provincename }],
      );
    }
    if (scope.stationLocked && scope.stationno) {
      setStations((prev) =>
        prev.length === 1 && prev[0].stationno === scope.stationno
          ? prev
          : [
              {
                stationno: scope.stationno,
                stationname: scope.stationname,
                provinceno: scope.provinceno,
                provincename: scope.provincename,
              },
            ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
  ]);

  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinces(next);
    if (next.length === 0) {
      setStations([]);
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    setStations((prev) => prev.filter((s) => allowed.has(s.provinceno)));
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStations(next);
    setProvinces((prev) => {
      const merged = [...prev];
      const known = new Set(merged.map((p) => p.locationno));
      next.forEach((s) => {
        if (!s.provinceno || known.has(s.provinceno)) return;
        known.add(s.provinceno);
        merged.push({ locationno: s.provinceno, locationname: s.provincename });
      });
      return merged;
    });
  };

  const handleIntervalChange = (next: Interval) => {
    setInterval(next);
    setSubPeriod(SUB_OPTIONS[next][0]?.value ?? "all");
  };

  const sortedYears = React.useMemo(() => [...years].sort((a, b) => a - b), [years]);
  const [baseYear, compareYear] = sortedYears;

  const provincesPayload = React.useMemo(
    () => buildDashboardProvinces(provinces, stations),
    [provinces, stations],
  );
  const scopeKey = provincesPayloadKey(provincesPayload);
  const yearsKey = sortedYears.join(",");
  const periodKey = `${interval}|${subPeriod}`;

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const yearList = sortedYears.filter(Boolean);
      const months = resolveReportMonths(interval as DashInterval, subPeriod);
      const intervalCode = REPORT_INTERVAL_CODES[interval] ?? 6;
      try {
        const resp = await dashboardAPI.getYearlyFireCodeVariance(
          {
            reportyear: yearList,
            reportmonth: months,
            interval: intervalCode,
            provinces: provincesPayload,
          },
          { suppressGlobalLoading: true, suppressErrorToast: true },
        );
        const { ok, data: payload } = unwrap<DashboardFireCodeFeeVarianceModel[]>(resp);

        if (cancelled) return;
        setGroupTotals(
          ok ? buildVarianceTotals(payload, yearList) : buildVarianceTotals(null, yearList),
        );
      } catch {
        if (!cancelled) setGroupTotals(buildVarianceTotals(null, yearList));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsKey, scopeKey, periodKey]);

  /* --- Station Detail dialog filter wiring ----------------------------- */
  const stationSeedRef = React.useRef<StationDialogFilters | null>(null);

  /** Opens the dialog and seeds its filters from the section's current filters. */
  const openStationDialog = React.useCallback(() => {
    const seed: StationDialogFilters = {
      year: String(compareYear),
      interval,
      period: subPeriod,
      provinces,
      stations,
    };
    stationSeedRef.current = seed;
    setStationFilters(seed);
    setStationModalOpen(true);
  }, [compareYear, interval, subPeriod, provinces, stations]);

  const resetStationFilters = React.useCallback(() => {
    if (stationSeedRef.current) setStationFilters(stationSeedRef.current);
  }, []);

  const stationFilterYear = Number(stationFilters.year) || compareYear;
  const stationProvincesPayload = React.useMemo(
    () => buildDashboardProvinces(stationFilters.provinces, stationFilters.stations),
    [stationFilters.provinces, stationFilters.stations],
  );
  const stationScopeKey = provincesPayloadKey(stationProvincesPayload);

  // Shared bar state <-> dialog filter state adapter (MONTHLY / QUARTERLY /
  // SEMESTER / ANNUAL only — the dialog bar does not offer daily or weekly).
  const stationFilterState: ModuleFilterState = React.useMemo(() => {
    const months =
      stationFilters.interval === "MONTHLY"
        ? (stationFilters.period ?? "")
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((m) => m >= 1 && m <= 12)
        : [];
    return {
      year: stationFilters.year,
      interval: stationFilters.interval,
      date: `all:${toISODate(new Date())}`,
      months,
      week: "all",
      quarter: stationFilters.interval === "QUARTERLY" ? stationFilters.period || "all" : "all",
      semester: stationFilters.interval === "SEMESTER" ? stationFilters.period || "all" : "all",
    };
  }, [stationFilters]);

  const handleStationFilterChange = (patch: Partial<ModuleFilterState>) => {
    const next = { ...stationFilterState, ...patch };
    const nextInterval = next.interval as Interval;
    const periodFor = (it: Interval): string => {
      if (it === "MONTHLY") {
        const months = [...new Set(next.months)].sort((a, b) => a - b);
        return months.length === 0 || months.length === 12 ? "all" : months.join(",");
      }
      if (it === "QUARTERLY") return next.quarter || "all";
      if (it === "SEMESTER") return next.semester || "all";
      return "all";
    };
    setStationFilters((prev) => ({
      ...prev,
      year: next.year,
      interval: nextInterval,
      period: periodFor(nextInterval),
    }));
  };

  // Station performance — fetched when the dialog opens (or its own
  // year/station filters change). The PerStation endpoint takes years and
  // provinces only, so amounts are full-year totals regardless of the period.
  React.useEffect(() => {
    if (!stationModalOpen) return;
    let cancelled = false;
    (async () => {
      setStationLoading(true);
      try {
        const resp = await dashboardAPI.getYearlyFireCodeFeeStation(
          {
            reportyear: [stationFilterYear].filter(Boolean),
            feeparentno: [],
            provinces: stationProvincesPayload,
          },
          { suppressGlobalLoading: true, suppressErrorToast: true },
        );
        const { ok, data: payload } = unwrap<DashboardStationFeeCollectionModel[]>(resp);
        if (!cancelled) setStationPayload(ok ? (payload ?? null) : null);
      } catch {
        if (!cancelled) setStationPayload(null);
      } finally {
        if (!cancelled) setStationLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationModalOpen, stationFilterYear, stationScopeKey]);

  const baseTotals =
    groupTotals[baseYear] ?? Object.fromEntries(VARIANCE_GROUPS.map((g) => [g.code, 0]));
  const compareTotals =
    groupTotals[compareYear] ?? Object.fromEntries(VARIANCE_GROUPS.map((g) => [g.code, 0]));
  const totalBase = VARIANCE_GROUPS.reduce((sum, row) => sum + (baseTotals[row.code] ?? 0), 0);
  const totalCompare = VARIANCE_GROUPS.reduce(
    (sum, row) => sum + (compareTotals[row.code] ?? 0),
    0,
  );

  /**
   * Comparison rules (base = first year, compare = second year):
   * - Variance: shortfall vs. base — max(0, base - compare). Zero when the
   *   compare year meets or exceeds the base.
   * - Positive listing: gain vs. base — max(0, compare - base).
   * - Percentage: compare / base * 100 ("—" when the base is zero).
   */
  const varianceOf = (base: number, compare: number) => Math.max(0, base - compare);
  const positiveOf = (base: number, compare: number) => Math.max(0, compare - base);
  const percentOf = (base: number, compare: number): number | null =>
    base === 0 ? null : (compare / base) * 100;
  const percentText = (pct: number | null): string =>
    pct === null ? "—" : `${Math.round(pct * 100) / 100}%`;
  /** Green when performance reaches or exceeds 100% of the base year. */
  const percentClass = (pct: number | null) =>
    pct !== null && pct >= 100 ? "text-success" : "text-muted-foreground";

  const valueCellClass =
    "w-28 min-w-28 px-3 py-2.5 text-right tabular-nums text-muted-foreground sm:w-40 sm:min-w-40 sm:px-4";

  const varianceRows = VARIANCE_GROUPS.map((row) => {
    const baseAmt = baseTotals[row.code] ?? 0;
    const compareAmt = compareTotals[row.code] ?? 0;
    return {
      ...row,
      baseAmt,
      compareAmt,
      variance: varianceOf(baseAmt, compareAmt),
      positive: positiveOf(baseAmt, compareAmt),
      percentage: percentOf(baseAmt, compareAmt),
    };
  });

  const stationRows = React.useMemo(
    () => buildStationVarianceRows(stationPayload, stationFilterYear),
    [stationPayload, stationFilterYear],
  );
  const stationTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const group of VARIANCE_GROUPS) totals[group.code] = 0;
    let total = 0;
    for (const row of stationRows) {
      for (const group of VARIANCE_GROUPS) totals[group.code] += row.amounts[group.code] ?? 0;
      total += row.total;
    }
    return { totals, total };
  }, [stationRows]);


  const filterControls = (
    <>
      <TwoYearSelect value={years} onChange={setYears} />

      <Select value={interval} onValueChange={(v) => handleIntervalChange(v as Interval)}>
        <SelectTrigger className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:min-w-[140px] md:w-[150px] md:rounded-md">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {INTERVALS.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {interval !== "ANNUAL" && (
        <Select value={subPeriod} onValueChange={setSubPeriod}>
          <SelectTrigger className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:min-w-[150px] md:w-[160px] md:rounded-md">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {SUB_OPTIONS[interval].map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {scope.provinceLocked ? (
        <ReadOnlyField
          value={scope.provincename}
          placeholder="All provinces"
          title="Restricted to your assigned province"
          className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
        />
      ) : (
        <LocationMultiSelect
          mode="location"
          value={provinces}
          locationtype="PROVINCE"
          parentcode={MIMAROPA_REGION_CODE}
          onChange={handleProvincesChange}
          placeholder="All provinces"
          hideCode
          className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
        />
      )}

      {scope.stationLocked ? (
        <ReadOnlyField
          value={scope.stationname}
          placeholder="All stations"
          title="Restricted to your assigned station"
          className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
        />
      ) : (
        <StationMultiSelect
          mode="station"
          value={stations}
          provinces={provinces.map((p) => ({ provinceno: p.locationno }))}
          reportyear={compareYear}
          onChange={handleStationsChange}
          placeholder="All stations"
          alwaysEnabled
          className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
        />
      )}
    </>
  );

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 p-3 sm:p-4">
        <div className="space-y-3">
          <div className="min-w-0 border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/8 text-primary ring-1 ring-primary/15">
                <Coins className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold leading-tight tracking-tight">
                Fire Code Fees Variance Comparison
              </h3>
            </div>
            <p className="mt-2 pl-10 text-sm text-muted-foreground">
              Combination of Manual Collection and Online Collection
            </p>
          </div>

          {/* Desktop: inline filters (unchanged on large screens) */}
          <div className="hidden rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:block md:bg-muted/20 md:p-2">
            <div className="flex w-full flex-wrap items-center justify-end gap-2">
              {filterControls}
            </div>
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
                <div className="grid grid-cols-1 gap-2">{filterControls}</div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <Dialog open={stationModalOpen} onOpenChange={setStationModalOpen}>
        <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border/60 bg-card p-0 shadow-soft">
          <div className="border-b border-border/60 bg-background/95 px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="pr-6 text-lg font-semibold">Station Detail</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Fire Code Fees variance by station for the selected year. Collections are
                full-year totals for the selected year.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 overflow-auto px-4 pb-5 pt-4 sm:px-5">
            {/* Dialog-owned filters — seeded from the section when it opens. */}
            <ModuleFilterBar
              title="Station Detail Filters"
              years={buildYears()}
              state={stationFilterState}
              onChange={handleStationFilterChange}
              onReset={resetStationFilters}
              intervals={["MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
              className="mb-3 rounded-xl bg-card/70"
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
                    value={stationFilters.provinces}
                    locationtype="PROVINCE"
                    parentcode={MIMAROPA_REGION_CODE}
                    onChange={(next) => {
                      setStationFilters((prev) => {
                        if (next.length === 0) return { ...prev, provinces: [], stations: [] };
                        const allowed = new Set(next.map((p) => p.locationno));
                        return {
                          ...prev,
                          provinces: next,
                          stations: prev.stations.filter((s) => allowed.has(s.provinceno)),
                        };
                      });
                    }}
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
                    value={stationFilters.stations}
                    provinces={stationFilters.provinces.map((p) => ({
                      provinceno: p.locationno,
                    }))}
                    reportyear={stationFilterYear}
                    onChange={(next) => {
                      setStationFilters((prev) => {
                        const merged = [...prev.provinces];
                        const known = new Set(merged.map((p) => p.locationno));
                        next.forEach((s) => {
                          if (!s.provinceno || known.has(s.provinceno)) return;
                          known.add(s.provinceno);
                          merged.push({
                            locationno: s.provinceno,
                            locationname: s.provincename,
                          });
                        });
                        return { ...prev, stations: next, provinces: merged };
                      });
                    }}
                    placeholder="All stations"
                    alwaysEnabled
                    className="w-full"
                  />
                )}
              </FilterField>
            </ModuleFilterBar>


            {stationLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card p-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading station performance…
              </div>
            ) : stationRows.length === 0 ? (
              <div className="rounded-lg border border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                No station data available for this view.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
                    <thead className="bg-muted/60 text-foreground/90">
                      <tr>
                        <th className="sticky left-0 z-20 w-56 min-w-56 border-b border-r border-border/60 bg-muted/60 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider">
                          Station
                        </th>
                        {VARIANCE_GROUPS.map((group) => (
                          <th
                            key={group.code}
                            className="border-b border-r border-border/60 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider last:border-r-0"
                          >
                            {group.label}
                          </th>
                        ))}
                        <th className="border-b border-border/60 px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stationRows.map((row, index) => (
                        <tr
                          key={row.stationno || `${row.stationname}-${index}`}
                          className="transition-colors hover:bg-muted/20"
                        >
                          <td className="sticky left-0 z-10 w-56 min-w-56 border-b border-r border-border/60 bg-card px-3 py-2">
                            <div className="flex items-center gap-2">
                              <AvatarWithFallback
                                src={row.logourl}
                                name={row.stationname}
                                className="h-6 w-6 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground/90">
                                  {row.stationname || "—"}
                                </div>
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {row.provincename}
                                </div>
                              </div>
                            </div>
                          </td>
                          {VARIANCE_GROUPS.map((group) => (
                            <td
                              key={group.code}
                              className="border-b border-r border-border/60 px-3 py-2 text-right tabular-nums text-muted-foreground"
                            >
                              {peso(row.amounts[group.code] ?? 0)}
                            </td>
                          ))}
                          <td className="border-b border-border/60 px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                            {peso(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--total-row)] text-[var(--total-row-foreground)]">
                        <td className="sticky left-0 z-20 w-56 min-w-56 border-r border-border/60 bg-[var(--total-row)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider">
                          Total
                        </td>
                        {VARIANCE_GROUPS.map((group) => (
                          <td
                            key={group.code}
                            className="border-r border-border/60 px-3 py-2.5 text-right font-bold tabular-nums"
                          >
                            {peso(stationTotals.totals[group.code] ?? 0)}
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                          {peso(stationTotals.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="m-4 flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading variance comparison…
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-3 p-3 md:hidden">
            {varianceRows.map((row) => (
              <article
                key={row.code}
                className="overflow-hidden rounded-lg border border-border/60 bg-card"
              >
                <div className="border-b border-border/60 bg-muted/40 px-3 py-2.5 text-sm font-semibold">
                  {row.label}
                </div>
                <dl className="grid grid-cols-2 gap-px bg-border/60 text-xs">
                  <div className="bg-card p-3">
                    <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {periodLabel(interval, subPeriod, baseYear)}
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">{peso(row.baseAmt)}</dd>
                  </div>
                  <div className="bg-card p-3 text-right">
                    <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {periodLabel(interval, subPeriod, compareYear)}
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums">{peso(row.compareAmt)}</dd>
                  </div>
                  <div className="bg-card p-3">
                    <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Variance
                    </dt>
                    <dd className="mt-1 tabular-nums text-muted-foreground">
                      {peso(row.variance)}
                    </dd>
                  </div>
                  <div className="bg-card p-3 text-right">
                    <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Positive listing
                    </dt>
                    <dd className="mt-1 tabular-nums text-muted-foreground">
                      {peso(row.positive)}
                    </dd>
                  </div>
                </dl>
                <div className="flex items-center justify-between border-t border-border/60 px-3 py-2.5 text-xs">
                  <span className="font-semibold uppercase text-muted-foreground">Performance</span>
                  <span className={cn("font-bold tabular-nums", percentClass(row.percentage))}>
                    {percentText(row.percentage)}
                  </span>
                </div>
              </article>
            ))}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-2 text-xs font-bold uppercase text-primary">Total</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="block text-muted-foreground">{baseYear}</span>
                  <strong className="tabular-nums">{peso(totalBase)}</strong>
                </div>
                <div className="text-right">
                  <span className="block text-muted-foreground">{compareYear}</span>
                  <strong className="tabular-nums">{peso(totalCompare)}</strong>
                </div>
                <div>
                  <span className="block text-muted-foreground">Variance</span>
                  <strong className="tabular-nums">
                    {peso(varianceOf(totalBase, totalCompare))}
                  </strong>
                </div>
                <div className="text-right">
                  <span className="block text-muted-foreground">Performance</span>
                  <strong
                    className={cn("tabular-nums", percentClass(percentOf(totalBase, totalCompare)))}
                  >
                    {percentText(percentOf(totalBase, totalCompare))}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 hidden px-3 pb-3 md:block">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-separate border-spacing-0 text-xs">
                  <thead className="bg-[var(--head-soft)] text-[var(--head-soft-foreground)]">
                    <tr>
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-30 w-52 min-w-52 border-r border-grid bg-[var(--head-soft)] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider sm:w-64 sm:min-w-64 sm:px-4"
                      >
                        Fire Code Fee Collection
                      </th>
                      <th
                        colSpan={5}
                        className="border-l border-grid bg-[var(--head-soft)] px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] sm:px-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex-1 text-center">
                            Combination of Manual Collection and Online Collection
                          </span>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-8 shrink-0 bg-primary/90 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm hover:bg-primary"
                            onClick={openStationDialog}
                          >
                            View Station Performance
                          </Button>
                        </div>
                      </th>
                    </tr>
                    <tr>
                      <th className="w-28 min-w-28 border-l border-r border-grid bg-[var(--head-soft)] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider sm:w-40 sm:min-w-40 sm:px-3">
                        {periodLabel(interval, subPeriod, baseYear)}
                      </th>
                      <th className="w-28 min-w-28 border-r border-grid bg-[var(--head-soft)] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider sm:w-40 sm:min-w-40 sm:px-3">
                        {periodLabel(interval, subPeriod, compareYear)}
                      </th>
                      <th className="w-24 min-w-24 border-r border-grid bg-[var(--head-soft)] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider sm:w-32 sm:min-w-32 sm:px-3">
                        Variance
                      </th>
                      <th className="w-24 min-w-24 border-r border-grid bg-[var(--head-soft)] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider sm:w-32 sm:min-w-32 sm:px-3">
                        Positive Listing
                      </th>
                      <th className="w-20 min-w-20 border-r border-grid bg-[var(--head-soft)] px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider sm:w-24 sm:min-w-24 sm:px-3">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card">
                    {varianceRows.map((row) => {
                      const { baseAmt, compareAmt, percentage: pct } = row;
                      return (
                        <tr
                          key={row.code}
                          className="border-b border-grid transition-colors hover:bg-muted/20"
                        >
                          <td className="sticky left-0 z-20 w-52 min-w-52 border-r border-grid bg-card px-3 py-2.5 align-middle font-medium text-foreground/90 sm:w-64 sm:min-w-64 sm:px-4">
                            {row.label}
                          </td>
                          <td className={cn("border-r border-grid bg-card", valueCellClass)}>
                            {peso(baseAmt)}
                          </td>
                          <td className={cn("border-r border-grid bg-card", valueCellClass)}>
                            {peso(compareAmt)}
                          </td>
                          <td className="w-24 min-w-24 border-r border-grid bg-card px-2 py-2 text-right tabular-nums text-muted-foreground sm:w-32 sm:min-w-32 sm:px-3">
                            {peso(varianceOf(baseAmt, compareAmt))}
                          </td>
                          <td className="w-24 min-w-24 border-r border-grid bg-card px-2 py-2 text-right tabular-nums text-muted-foreground sm:w-32 sm:min-w-32 sm:px-3">
                            {peso(positiveOf(baseAmt, compareAmt))}
                          </td>
                          <td
                            className={cn(
                              "w-20 min-w-20 border-r border-grid bg-card px-2 py-2 text-right font-semibold tabular-nums sm:w-24 sm:min-w-24 sm:px-3",
                              percentClass(pct),
                            )}
                          >
                            {percentText(pct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[var(--total-row)] text-[var(--total-row-foreground)]">
                      <td className="sticky left-0 z-30 w-52 min-w-52 border-r border-grid bg-[var(--total-row)] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider sm:w-64 sm:min-w-64 sm:px-4">
                        Total
                      </td>
                      <td className="w-28 min-w-28 border-r border-grid bg-[var(--total-row)] px-2 py-2.5 text-right font-bold tabular-nums sm:w-40 sm:min-w-40 sm:px-3">
                        {peso(totalBase)}
                      </td>
                      <td className="w-28 min-w-28 border-r border-grid bg-[var(--total-row)] px-2 py-2.5 text-right font-bold tabular-nums sm:w-40 sm:min-w-40 sm:px-3">
                        {peso(totalCompare)}
                      </td>
                      <td className="w-24 min-w-24 border-r border-grid bg-[var(--total-row)] px-2 py-2.5 text-right font-bold tabular-nums sm:w-32 sm:min-w-32 sm:px-3">
                        {peso(varianceOf(totalBase, totalCompare))}
                      </td>
                      <td className="w-24 min-w-24 border-r border-grid bg-[var(--total-row)] px-2 py-2.5 text-right font-bold tabular-nums sm:w-32 sm:min-w-32 sm:px-3">
                        {peso(positiveOf(totalBase, totalCompare))}
                      </td>
                      <td
                        className={cn(
                          "w-20 min-w-20 border-r border-grid bg-[var(--total-row)] px-2 py-2.5 text-right font-bold tabular-nums sm:w-24 sm:min-w-24 sm:px-3",
                          percentClass(percentOf(totalBase, totalCompare)),
                        )}
                      >
                        {percentText(percentOf(totalBase, totalCompare))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
