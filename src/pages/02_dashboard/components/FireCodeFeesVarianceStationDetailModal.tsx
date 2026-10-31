import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { unwrap } from "@/lib/api-envelope";
import { buildDashboardProvinces, provincesPayloadKey } from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardStationFeeCollectionModel } from "@/types/dashboardType";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { toISODate } from "@/lib/filters";
import type { DashInterval } from "@/lib/filters";
import { ModuleFilterBar, type ModuleFilterState } from "@/components/shared/ModuleFilterBar";
import FilterField from "@/components/filter-field";
import { buildYears } from "@/lib/utils";

import { peso } from "./fees/feeColumns";

type Interval = Extract<DashInterval, "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL">;

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

export const VARIANCE_GROUPS = [
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

interface StationVarianceRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provincename: string;
  logourl: string;
  amounts: Record<string, number>;
  total: number;
}

interface StationDialogFilters {
  year: string;
  interval: Interval;
  period: string;
  provinces: SelectedLocation[];
  stations: SelectedStation[];
}

function toModuleQuarter(period: string): string {
  if (!period || period === "all") return "all";
  if (period === "1") return "q1";
  if (period === "2") return "q2";
  if (period === "3") return "q3";
  if (period === "4") return "q4";
  return period;
}

function fromModuleQuarter(period: string): string {
  if (!period || period === "all") return "all";
  if (period === "q1") return "1";
  if (period === "q2") return "2";
  if (period === "q3") return "3";
  if (period === "q4") return "4";
  return period;
}

function toModuleSemester(period: string): string {
  if (!period || period === "all") return "all";
  if (period === "1") return "s1";
  if (period === "2") return "s2";
  return period;
}

function fromModuleSemester(period: string): string {
  if (!period || period === "all") return "all";
  if (period === "s1") return "1";
  if (period === "s2") return "2";
  return period;
}

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
      b.total - a.total ||
      a.provincename.localeCompare(b.provincename) ||
      a.stationname.localeCompare(b.stationname) ||
      a.stationno.localeCompare(b.stationno),
  );
}

interface FireCodeFeesVarianceStationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compareYear: number;
  initialInterval: Interval;
  initialPeriod: string;
  initialProvinces: SelectedLocation[];
  initialStations: SelectedStation[];
  provinceLocked: boolean;
  provincename?: string;
  stationLocked: boolean;
  stationname?: string;
}

export function FireCodeFeesVarianceStationDetailModal({
  open,
  onOpenChange,
  compareYear,
  initialInterval,
  initialPeriod,
  initialProvinces,
  initialStations,
  provinceLocked,
  provincename,
  stationLocked,
  stationname,
}: FireCodeFeesVarianceStationDetailModalProps) {
  const [stationFilters, setStationFilters] = React.useState<StationDialogFilters>({
    year: String(compareYear),
    interval: initialInterval,
    period: initialPeriod,
    provinces: initialProvinces,
    stations: initialStations,
  });
  const [stationPayload, setStationPayload] = React.useState<
    DashboardStationFeeCollectionModel[] | null
  >(null);
  const [stationLoading, setStationLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStationFilters({
      year: String(compareYear),
      interval: initialInterval,
      period: initialPeriod,
      provinces: initialProvinces,
      stations: initialStations,
    });
  }, [open, compareYear, initialInterval, initialPeriod, initialProvinces, initialStations]);

  const stationFilterYear = Number(stationFilters.year) || compareYear;
  const stationProvincesPayload = React.useMemo(
    () => buildDashboardProvinces(stationFilters.provinces, stationFilters.stations),
    [stationFilters.provinces, stationFilters.stations],
  );
  const stationScopeKey = provincesPayloadKey(stationProvincesPayload);

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
      quarter:
        stationFilters.interval === "QUARTERLY"
          ? toModuleQuarter(stationFilters.period || "all")
          : "all",
      semester:
        stationFilters.interval === "SEMESTER"
          ? toModuleSemester(stationFilters.period || "all")
          : "all",
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
      if (it === "QUARTERLY") return fromModuleQuarter(next.quarter || "all");
      if (it === "SEMESTER") return fromModuleSemester(next.semester || "all");
      return "all";
    };

    setStationFilters((prev) => ({
      ...prev,
      year: next.year,
      interval: nextInterval,
      period: periodFor(nextInterval),
    }));
  };

  React.useEffect(() => {
    if (!open) return;
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
  }, [open, stationFilterYear, stationScopeKey]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border/60 bg-card p-0 shadow-soft">
        <div className="border-b border-border/60 bg-background/95 px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="pr-6 text-lg font-semibold">Station Performance</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Fire Code Fee collections by station for the selected year. Totals shown are for the
              selected year and current station scope.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 overflow-auto px-4 pb-5 pt-4 sm:px-5">
          <ModuleFilterBar
            title="Station Performance Filters"
            years={buildYears()}
            state={stationFilterState}
            onChange={handleStationFilterChange}
            onReset={() =>
              setStationFilters({
                year: String(compareYear),
                interval: initialInterval,
                period: initialPeriod,
                provinces: initialProvinces,
                stations: initialStations,
              })
            }
            intervals={["MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
            className="mb-3 rounded-xl bg-card/70"
          >
            <FilterField label="Provinces">
              {provinceLocked ? (
                <ReadOnlyField
                  value={provincename ?? ""}
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
              {stationLocked ? (
                <ReadOnlyField
                  value={stationname ?? ""}
                  placeholder="All stations"
                  title="Restricted to your assigned station"
                />
              ) : (
                <StationMultiSelect
                  mode="station"
                  value={stationFilters.stations}
                  provinces={stationFilters.provinces.map((p) => ({ provinceno: p.locationno }))}
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
  );
}
