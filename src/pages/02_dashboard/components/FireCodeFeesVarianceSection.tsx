import * as React from "react";
import { ChevronDown, Coins, Loader2 } from "lucide-react";

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
import type { DashboardFeeCollectionModel } from "@/types/dashboardType";

import { peso } from "./fees/feeColumns";

/* -------------------------------------------------------------------------- */
/*  Period filters                                                             */
/* -------------------------------------------------------------------------- */

type Interval = "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL";

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

const VARIANCE_GROUPS = [
  { code: "FCCT", label: "FCCT + Filing Fees", categoryNos: [541, 560] },
  { code: "FSIB", label: "FSI Fee (Business)", categoryNos: [547] },
  { code: "FSIO", label: "FSI Fee (Occupancy)", categoryNos: [546] },
  {
    code: "FCTC",
    label: "Fire Code Tax & Clearances",
    categoryNos: [542, 543, 544, 545, 548, 549, 550, 551, 552, 553, 554, 555, 556],
  },
  { code: "AF", label: "Admin Fees", categoryNos: [557] },
  {
    code: "OF",
    label: "Other Fees",
    categoryNos: [558, 559, 561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572],
  },
] as const;

function buildVarianceTotals(
  payload: DashboardFeeCollectionModel | null,
  years: number[],
): Record<number, Record<string, number>> {
  const totals: Record<number, Record<string, number>> = {};
  for (const year of years) {
    totals[year] = Object.fromEntries(VARIANCE_GROUPS.map((group) => [group.code, 0]));
  }

  for (const fee of payload?.feeList ?? []) {
    const categoryNo = Number(fee?.feecateg) || 0;
    const group = VARIANCE_GROUPS.find((item) =>
      (item.categoryNos as readonly number[]).includes(categoryNo),
    );
    if (!group) continue;

    for (const yearEntry of fee.yearList ?? []) {
      const year = Number(yearEntry?.reportyear) || 0;
      if (!totals[year]) continue;
      const totalForCategory = (yearEntry?.sectors ?? []).reduce(
        (sum, sector) => sum + (Number(sector?.collectionamount ?? 0) || 0),
        0,
      );
      totals[year][group.code] += totalForCategory;
    }
  }

  return totals;
}

/** Column caption, e.g. "1st Semester 2026". */
function periodLabel(interval: Interval, sub: string, year: number) {
  if (interval === "ANNUAL") return `Annual ${year}`;
  const option = SUB_OPTIONS[interval].find((o) => o.value === sub);
  return `${option?.label ?? ""} ${year}`.trim();
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
          className="w-full shrink-0 justify-between sm:w-[176px]"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4" />
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
  const [groupTotals, setGroupTotals] = React.useState<Record<number, Record<string, number>>>({});

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

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const yearList = sortedYears.filter(Boolean);
      const resp = await dashboardAPI.getYearlyFireCodeFees(
        {
          reportyear: yearList,
          Provinces: provincesPayload,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      const { ok, data: payload } = unwrap<DashboardFeeCollectionModel>(resp);

      if (cancelled) return;
      setGroupTotals(
        ok ? buildVarianceTotals(payload, yearList) : buildVarianceTotals(null, yearList),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsKey, scopeKey]);

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
    pct !== null && pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

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

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 p-4 sm:p-5">
        <div className="space-y-4">
          <div className="min-w-0 border-b border-border/60 pb-3">
            <div className="mb-1 flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold leading-tight">
                Fire Code Fees Variance Comparison
              </h3>
            </div>
            <p className="pl-6 text-sm text-muted-foreground">
              Combination of Manual Collection and Online Collection
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[176px_150px_160px_minmax(200px,1fr)_minmax(200px,1fr)]">
            <TwoYearSelect value={years} onChange={setYears} />

            <Select value={interval} onValueChange={(v) => handleIntervalChange(v as Interval)}>
              <SelectTrigger className="h-9 w-full shrink-0 text-sm sm:w-[150px]">
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
                <SelectTrigger className="h-9 w-full shrink-0 text-sm sm:w-[160px]">
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
                className="w-full shrink-0 sm:w-[240px]"
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
                className="w-full shrink-0 sm:w-[240px]"
              />
            )}

            {scope.stationLocked ? (
              <ReadOnlyField
                value={scope.stationname}
                placeholder="All stations"
                title="Restricted to your assigned station"
                className="w-full shrink-0 sm:w-[240px]"
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
                className="w-full shrink-0 sm:w-[240px]"
              />
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="m-4 flex items-center justify-center gap-2 rounded-lg border border-border/60 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading variance comparison…
        </div>
      ) : null}

      <div className="space-y-3 p-3 md:hidden">
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
                <dd className="mt-1 tabular-nums text-muted-foreground">{peso(row.variance)}</dd>
              </div>
              <div className="bg-card p-3 text-right">
                <dt className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Positive listing
                </dt>
                <dd className="mt-1 tabular-nums text-muted-foreground">{peso(row.positive)}</dd>
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
              <strong className="tabular-nums">{peso(varianceOf(totalBase, totalCompare))}</strong>
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

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="head-soft sticky left-0 z-30 w-52 min-w-52 px-2 py-2 text-center align-middle text-[10px] font-bold uppercase tracking-wider sm:w-64 sm:min-w-64 sm:px-3"
              >
                Fire Code Fee Collection
              </th>
              <th
                colSpan={5}
                className="head-soft border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
              >
                Combination of Manual Collection and Online Collection
              </th>
            </tr>
            <tr>
              <th className="head-soft w-28 min-w-28 border-l border-grid px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider sm:w-40 sm:min-w-40 sm:px-3">
                {periodLabel(interval, subPeriod, baseYear)}
              </th>
              <th className="head-soft w-28 min-w-28 border-l border-grid px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider sm:w-40 sm:min-w-40 sm:px-3">
                {periodLabel(interval, subPeriod, compareYear)}
              </th>
              <th className="head-soft w-24 min-w-24 border-l border-grid px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider sm:w-32 sm:min-w-32 sm:px-3">
                Variance
              </th>
              <th className="head-soft w-24 min-w-24 border-l border-grid px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider sm:w-32 sm:min-w-32 sm:px-3">
                Positive Listing
              </th>
              <th className="head-soft w-20 min-w-20 border-l border-grid px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider sm:w-24 sm:min-w-24 sm:px-3">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {varianceRows.map((row) => {
              const { baseAmt, compareAmt, percentage: pct } = row;
              return (
                <tr key={row.code} className="border-t border-grid">
                  <td className="sticky left-0 z-20 w-52 min-w-52 border-t border-grid bg-card px-3 py-2.5 align-middle font-medium text-foreground/90 sm:w-64 sm:min-w-64 sm:px-4">
                    {row.label}
                  </td>
                  <td className={cn("border-l border-t border-grid", valueCellClass)}>
                    {peso(baseAmt)}
                  </td>
                  <td className={cn("border-l border-t border-grid", valueCellClass)}>
                    {peso(compareAmt)}
                  </td>
                  <td className="w-24 min-w-24 border-l border-t border-grid px-2 py-1.5 text-right tabular-nums text-muted-foreground sm:w-32 sm:min-w-32 sm:px-3">
                    {peso(varianceOf(baseAmt, compareAmt))}
                  </td>
                  <td className="w-24 min-w-24 border-l border-t border-grid px-2 py-1.5 text-right tabular-nums text-muted-foreground sm:w-32 sm:min-w-32 sm:px-3">
                    {peso(positiveOf(baseAmt, compareAmt))}
                  </td>
                  <td
                    className={cn(
                      "w-20 min-w-20 border-l border-t border-grid px-2 py-1.5 text-right font-semibold tabular-nums sm:w-24 sm:min-w-24 sm:px-3",
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
            <tr className="border-t border-grid bg-muted/60">
              <td className="sticky left-0 z-30 w-52 min-w-52 bg-muted px-2 py-2 text-[10px] font-bold uppercase tracking-wider sm:w-64 sm:min-w-64 sm:px-3">
                Total
              </td>
              <td className="w-28 min-w-28 border-l border-grid px-2 py-2 text-right font-bold tabular-nums sm:w-40 sm:min-w-40 sm:px-3">
                {peso(totalBase)}
              </td>
              <td className="w-28 min-w-28 border-l border-grid px-2 py-2 text-right font-bold tabular-nums sm:w-40 sm:min-w-40 sm:px-3">
                {peso(totalCompare)}
              </td>
              <td className="w-24 min-w-24 border-l border-grid px-2 py-2 text-right font-bold tabular-nums sm:w-32 sm:min-w-32 sm:px-3">
                {peso(varianceOf(totalBase, totalCompare))}
              </td>
              <td className="w-24 min-w-24 border-l border-grid px-2 py-2 text-right font-bold tabular-nums sm:w-32 sm:min-w-32 sm:px-3">
                {peso(positiveOf(totalBase, totalCompare))}
              </td>
              <td
                className={cn(
                  "w-20 min-w-20 border-l border-grid px-2 py-2 text-right font-bold tabular-nums sm:w-24 sm:min-w-24 sm:px-3",
                  percentClass(percentOf(totalBase, totalCompare)),
                )}
              >
                {percentText(percentOf(totalBase, totalCompare))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
