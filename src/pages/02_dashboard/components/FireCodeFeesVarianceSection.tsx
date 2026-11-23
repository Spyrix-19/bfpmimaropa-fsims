import * as React from "react";
import { Building2, Coins, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SelectedLocation } from "@/components/location-multi-select";
import type { SelectedStation } from "@/components/station-multi-select";
import { resolveLocationScope, useAuth } from "@/lib/auth";

import { unwrap } from "@/lib/api-envelope";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
} from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardFireCodeFeeVarianceModel } from "@/types/dashboardType";
import { resolveReportMonths } from "@/lib/filters";
import { REPORT_INTERVAL_CODES } from "@/lib/fsims-constants";
import type { DashInterval } from "@/lib/filters";

import { peso } from "./fees/feeColumns";
import { FireCodeFeesVarianceStationDetailModal } from "./FireCodeFeesVarianceStationDetailModal";
import {
  DEFAULT_VARIANCE_INTERVAL,
  DEFAULT_VARIANCE_SUB_PERIOD,
  VarianceFilterBar,
  defaultVarianceYears,
  firstSubOption,
  periodLabel,
  provincesIncludingStations,
  stationsWithinProvinces,
  type VarianceInterval as Interval,
} from "./fees/varianceFilters";

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
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesVarianceSection() {
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const [years, setYears] = React.useState<number[]>(defaultVarianceYears);
  const [interval, setInterval] = React.useState<Interval>(DEFAULT_VARIANCE_INTERVAL);
  const [subPeriod, setSubPeriod] = React.useState<string>(DEFAULT_VARIANCE_SUB_PERIOD);
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>([]);
  const [stations, setStations] = React.useState<SelectedStation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [stationModalOpen, setStationModalOpen] = React.useState(false);
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
    setStations((prev) => stationsWithinProvinces(next, prev));
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStations(next);
    setProvinces((prev) => provincesIncludingStations(prev, next));
  };

  const handleIntervalChange = (next: Interval) => {
    setInterval(next);
    setSubPeriod(firstSubOption(next));
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

  const openStationDialog = React.useCallback(() => {
    setStationModalOpen(true);
  }, []);

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

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 p-3 sm:p-4">
        <div className="space-y-3">
          <div className="min-w-0 border-b border-border/60 pb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary ring-1 ring-primary/15">
                  <Coins className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold leading-tight tracking-tight">
                  Fire Code Fees Variance Comparison
                </h3>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={openStationDialog}
                className="h-9 w-full gap-1.5 sm:w-auto"
              >
                <Building2 className="h-4 w-4" />
                View Station Performance
              </Button>
            </div>
            <p className="mt-2 pl-10 text-sm text-muted-foreground">
              Combination of Manual Collection and Online Collection
            </p>
          </div>

          <VarianceFilterBar
            years={years}
            onYearsChange={setYears}
            interval={interval}
            onIntervalChange={handleIntervalChange}
            subPeriod={subPeriod}
            onSubPeriodChange={setSubPeriod}
            provinces={provinces}
            onProvincesChange={handleProvincesChange}
            stations={stations}
            onStationsChange={handleStationsChange}
            stationYear={compareYear}
            provinceLocked={scope.provinceLocked}
            provincename={scope.provincename}
            stationLocked={scope.stationLocked}
            stationname={scope.stationname}
          />
        </div>
      </div>

      <FireCodeFeesVarianceStationDetailModal
        open={stationModalOpen}
        onOpenChange={setStationModalOpen}
        baseYear={baseYear}
        compareYear={compareYear}
        initialInterval={interval}
        initialSubPeriod={subPeriod}
        initialProvinces={provinces}
        initialStations={stations}
        provinceLocked={scope.provinceLocked}
        provincename={scope.provincename}
        stationLocked={scope.stationLocked}
        stationname={scope.stationname}
      />

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
                        Combination of Manual Collection and Online Collection
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
