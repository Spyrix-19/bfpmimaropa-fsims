import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  RotateCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SelectedLocation } from "@/components/location-multi-select";
import type { SelectedStation } from "@/components/station-multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_INTERVAL_CODES } from "@/lib/fsims-constants";
import { resolveReportMonths, type DashInterval } from "@/lib/filters";
import { unwrap } from "@/lib/api-envelope";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
} from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardFireCodeFeeStationModel } from "@/types/dashboardType";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { cn } from "@/lib/utils";
import { peso } from "./fees/feeColumns";
import {
  filterStationRows,
  sortStationRows,
  summarizeStationRows,
  toStationVarianceRows,
  type SortDirection,
  type StationSortKey,
  type StationStatusFilter,
} from "./fees/stationVariance";
import {
  VarianceFilterBar,
  firstSubOption,
  periodLabel,
  provincesIncludingStations,
  stationsWithinProvinces,
  type VarianceInterval,
} from "./fees/varianceFilters";

interface FireCodeFeesVarianceStationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseYear: number;
  compareYear: number;
  initialInterval: VarianceInterval;
  initialSubPeriod: string;
  initialProvinces: SelectedLocation[];
  initialStations: SelectedStation[];
  provinceLocked: boolean;
  provincename?: string;
  stationLocked: boolean;
  stationname?: string;
}

const STATUS_OPTIONS: { value: StationStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "improved", label: "Improved" },
  { value: "declined", label: "Declined" },
  { value: "same", label: "No change" },
];

const DEFAULT_SORT: { key: StationSortKey; direction: SortDirection } = {
  key: "second",
  direction: "desc",
};

const percentText = (pct: number | null) =>
  pct === null ? "—" : `${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

const percentTone = (pct: number | null) =>
  pct === null ? "text-muted-foreground" : pct >= 100 ? "text-success" : "text-destructive";

/** Popovers portal outside the dialog; keep wheel/touch scrolling inside them working. */
const stopScrollLock = {
  onWheelCapture: (event: React.WheelEvent) => event.stopPropagation(),
  onTouchMoveCapture: (event: React.TouchEvent) => event.stopPropagation(),
};

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = "right",
}: {
  label: React.ReactNode;
  column: StationSortKey;
  sort: { key: StationSortKey; direction: SortDirection };
  onSort: (key: StationSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={cn(
        "group inline-flex w-full items-center gap-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        align === "right" ? "justify-end text-right" : "justify-start text-left",
        active && "text-primary",
      )}
      title={`Sort by ${typeof label === "string" ? label : column}`}
    >
      <span>{label}</span>
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          active ? "opacity-100" : "opacity-40 group-hover:opacity-80",
        )}
      />
    </button>
  );
}

export function FireCodeFeesVarianceStationDetailModal({
  open,
  onOpenChange,
  baseYear,
  compareYear,
  initialInterval,
  initialSubPeriod,
  initialProvinces,
  initialStations,
  provinceLocked,
  provincename,
  stationLocked,
  stationname,
}: FireCodeFeesVarianceStationDetailModalProps) {
  const [years, setYears] = React.useState<number[]>([baseYear, compareYear]);
  const [interval, setInterval] = React.useState<VarianceInterval>(initialInterval);
  const [subPeriod, setSubPeriod] = React.useState<string>(initialSubPeriod);
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>(initialProvinces);
  const [stations, setStations] = React.useState<SelectedStation[]>(initialStations);
  const [status, setStatus] = React.useState<StationStatusFilter>("all");
  const [sort, setSort] = React.useState(DEFAULT_SORT);
  const [rows, setRows] = React.useState<DashboardFireCodeFeeStationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  const sortedYears = React.useMemo(() => [...years].sort((a, b) => a - b), [years]);
  const [firstYear, secondYear] = sortedYears;
  const firstLabel = periodLabel(interval, subPeriod, firstYear);
  const secondLabel = periodLabel(interval, subPeriod, secondYear);

  const resetFilters = React.useCallback(() => {
    setYears([baseYear, compareYear]);
    setInterval(initialInterval);
    setSubPeriod(initialSubPeriod);
    setProvinces(initialProvinces);
    setStations(initialStations);
    setStatus("all");
    setSort(DEFAULT_SORT);
  }, [baseYear, compareYear, initialInterval, initialSubPeriod, initialProvinces, initialStations]);

  React.useEffect(() => {
    if (!open) return;
    resetFilters();
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinces(next);
    setStations((current) => stationsWithinProvinces(next, current));
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStations(next);
    setProvinces((current) => provincesIncludingStations(current, next));
  };

  const handleIntervalChange = (next: VarianceInterval) => {
    setInterval(next);
    setSubPeriod(firstSubOption(next));
  };

  const provincePayload = React.useMemo(
    () => buildDashboardProvinces(provinces, stations),
    [provinces, stations],
  );
  const scopeKey = provincesPayloadKey(provincePayload);

  React.useEffect(() => {
    if (!open || !firstYear || !secondYear) return;
    let cancelled = false;
    const controller = new AbortController();

    const loadStations = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await dashboardAPI.getYearlyFireCodeFeeStation(
          {
            reportyear: [firstYear, secondYear],
            reportmonth: resolveReportMonths(interval as DashInterval, subPeriod),
            interval: REPORT_INTERVAL_CODES[interval] ?? 6,
            feeparentno: [],
            provinces: provincePayload,
          },
          {
            signal: controller.signal,
            suppressGlobalLoading: true,
            suppressErrorToast: true,
          },
        );
        const result = unwrap<DashboardFireCodeFeeStationModel[]>(response);
        if (cancelled || result.canceled) return;
        if (!result.ok || (result.data !== null && !Array.isArray(result.data))) {
          setRows([]);
          setError(result.error || "Unable to load station performance.");
          return;
        }
        setRows(result.data ?? []);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Unable to load station performance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStations();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firstYear, secondYear, interval, subPeriod, scopeKey, retry]);

  const allRows = React.useMemo(
    () => toStationVarianceRows(rows, firstYear, secondYear),
    [rows, firstYear, secondYear],
  );
  const visibleRows = React.useMemo(
    () => sortStationRows(filterStationRows(allRows, "", status), sort.key, sort.direction),
    [allRows, status, sort],
  );
  const totals = React.useMemo(() => summarizeStationRows(visibleRows), [visibleRows]);
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [status, sort, rows]);
  const overall = React.useMemo(() => summarizeStationRows(allRows), [allRows]);

  const handleSort = (key: StationSortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: key === "station" ? "asc" : "desc" },
    );
  };

  const statusCount = (value: StationStatusFilter) =>
    value === "all"
      ? allRows.length
      : value === "improved"
        ? overall.improved
        : value === "declined"
          ? overall.declined
          : allRows.length - overall.improved - overall.declined;

  const net = totals.second - totals.first;

  const th =
    "sticky top-0 z-20 border-b border-r border-grid bg-[var(--head-soft)] px-3 py-3 text-[var(--head-soft-foreground)]";
  const td = "border-b border-r border-grid px-3 py-2.5 text-right tabular-nums";
  const tf =
    "sticky bottom-0 z-20 border-r border-t border-grid bg-[var(--total-row)] px-3 py-3 text-right font-bold tabular-nums text-[var(--total-row-foreground)]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border/60 bg-card p-0 shadow-soft">
        <div className="shrink-0 border-b border-border/60 bg-card px-5 py-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="pr-6 text-lg font-semibold">
              Fire Code Fees Variance Comparison · Station Performance
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Station collections for {firstLabel} vs {secondLabel}.{" "}
              <span className="hidden md:inline">Click a column header to sort.</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4 sm:px-5 md:overflow-hidden">
          {/* Filters — same controls as the dashboard section */}
          <section aria-label="Station performance filters" className="shrink-0 space-y-2.5" {...stopScrollLock}>
            <VarianceFilterBar
              years={sortedYears}
              onYearsChange={setYears}
              interval={interval}
              onIntervalChange={handleIntervalChange}
              subPeriod={subPeriod}
              onSubPeriodChange={setSubPeriod}
              provinces={provinces}
              onProvincesChange={handleProvincesChange}
              stations={stations}
              onStationsChange={handleStationsChange}
              stationYear={secondYear}
              provinceLocked={provinceLocked}
              provincename={provincename}
              stationLocked={stationLocked}
              stationname={stationname}
            >
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Performance status">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Status
              </span>
              {STATUS_OPTIONS.map((option) => {
                const active = status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setStatus(option.value)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground/80 hover:border-primary/50 hover:text-primary",
                    )}
                  >
                    {option.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] tabular-nums",
                        active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {statusCount(option.value)}
                    </span>
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                <div className="md:hidden">
                <Select
                  value={`${sort.key}:${sort.direction}`}
                  onValueChange={(value) => {
                    const [key, direction] = value.split(":") as [StationSortKey, SortDirection];
                    setSort({ key, direction });
                  }}
                >
                  <SelectTrigger className="h-7 w-[170px] bg-background text-xs" aria-label="Sort stations">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="second:desc">{secondLabel} · highest</SelectItem>
                    <SelectItem value="first:desc">{firstLabel} · highest</SelectItem>
                    <SelectItem value="variance:desc">Variance · highest</SelectItem>
                    <SelectItem value="variance:asc">Variance · lowest</SelectItem>
                    <SelectItem value="positive:desc">Positive listing · highest</SelectItem>
                    <SelectItem value="positive:asc">Positive listing · lowest</SelectItem>
                    <SelectItem value="percentage:desc">% · highest</SelectItem>
                    <SelectItem value="percentage:asc">% · lowest</SelectItem>
                    <SelectItem value="station:asc">Station · A–Z</SelectItem>
                  </SelectContent>
                </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            </div>
            </VarianceFilterBar>
          </section>

          {/* Summary */}
          {!loading && !error && allRows.length > 0 ? (
            <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {firstLabel} total
                </div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{peso(totals.first)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {secondLabel} total
                </div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{peso(totals.second)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Net change
                </div>
                <div
                  className={cn(
                    "mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums",
                    net >= 0 ? "text-success" : "text-destructive",
                  )}
                >
                  {net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {net >= 0 ? "+" : "−"}
                  {peso(Math.abs(net))}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Performance · {visibleRows.length} of {allRows.length} stations
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className={cn("text-sm font-bold tabular-nums", percentTone(totals.percentage))}>
                    {percentText(totals.percentage)}
                  </span>
                  <span className="text-[11px] text-muted-foreground" title="Stations up / down / unchanged">
                    <span className="text-success">{totals.improved}↑</span>{" "}
                    <span className="text-destructive">{totals.declined}↓</span>{" "}
                    <span>{totals.same}=</span>
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div
              role="status"
              className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card p-8 text-sm text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 animate-spin" /> Loading station performance…
            </div>
          ) : error ? (
            <div role="alert" className="space-y-3 rounded-lg border border-border/60 bg-card px-4 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
                Retry
              </Button>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              {allRows.length === 0
                ? "No station data available for this view."
                : "No stations match these filters."}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-card md:flex">
                <div ref={tableScrollRef} className="min-h-0 w-full overflow-auto">
                  <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th
                          aria-sort={sort.key === "station" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                          className={cn(th, "left-0 z-30 w-[34%] min-w-[280px] text-left")}
                        >
                          <SortHeader label="Station" column="station" sort={sort} onSort={handleSort} align="left" />
                        </th>
                        {(
                          [
                            ["first", firstLabel],
                            ["second", secondLabel],
                            ["variance", "Variance"],
                            ["positive", "Positive Listing"],
                            ["percentage", "%"],
                          ] as [StationSortKey, string][]
                        ).map(([key, label], i, list) => (
                          <th
                            key={key}
                            aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                            className={cn(th, i === list.length - 1 && "border-r-0", key === "percentage" ? "w-[120px]" : "w-[150px]")}
                          >
                            <SortHeader label={label} column={key} sort={sort} onSort={handleSort} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => (
                        <tr key={row.key} className="group">
                          <td className="sticky left-0 z-10 border-b border-r border-grid bg-card px-3 py-2.5 group-hover:bg-muted">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                                {index + 1}
                              </span>
                              <AvatarWithFallback src={row.logourl} name={row.stationname} className="h-8 w-8 shrink-0" />
                              <div className="min-w-0">
                                <div className="break-words font-medium text-foreground">{row.stationname || "—"}</div>
                                <div className="break-words text-xs text-muted-foreground">
                                  {row.stationcode} · {row.provincename}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className={cn(td, "bg-card group-hover:bg-muted/60")}>{peso(row.first)}</td>
                          <td className={cn(td, "bg-card font-semibold group-hover:bg-muted/60")}>{peso(row.second)}</td>
                          <td className={cn(td, "bg-card group-hover:bg-muted/60", row.variance > 0 ? "text-destructive" : "text-muted-foreground")}>
                            {peso(row.variance)}
                          </td>
                          <td className={cn(td, "bg-card group-hover:bg-muted/60", row.positive > 0 ? "text-success" : "text-muted-foreground")}>
                            {peso(row.positive)}
                          </td>
                          <td className={cn(td, "border-r-0 bg-card font-semibold group-hover:bg-muted/60", percentTone(row.percentage))}>
                            {percentText(row.percentage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className={cn(tf, "left-0 z-30 text-left text-xs uppercase")}>
                          Total · {visibleRows.length} station{visibleRows.length === 1 ? "" : "s"}
                        </td>
                        <td className={tf}>{peso(totals.first)}</td>
                        <td className={tf}>{peso(totals.second)}</td>
                        <td className={tf}>{peso(totals.variance)}</td>
                        <td className={tf}>{peso(totals.positive)}</td>
                        <td className={cn(tf, "border-r-0")}>{percentText(totals.percentage)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {visibleRows.map((row, index) => (
                  <article key={row.key} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                    <div className="flex items-center gap-2.5 border-b border-border/60 p-3">
                      <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <AvatarWithFallback src={row.logourl} name={row.stationname} className="h-9 w-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words text-sm font-semibold">{row.stationname || "—"}</h3>
                        <p className="break-words text-xs text-muted-foreground">
                          {row.stationcode} · {row.provincename}
                        </p>
                      </div>
                      <span className={cn("text-sm font-bold tabular-nums", percentTone(row.percentage))}>
                        {percentText(row.percentage)}
                      </span>
                    </div>
                    <dl className="grid grid-cols-2 gap-px bg-border/60 text-xs">
                      <div className="bg-card p-3">
                        <dt className="text-muted-foreground">{firstLabel}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{peso(row.first)}</dd>
                      </div>
                      <div className="bg-card p-3 text-right">
                        <dt className="text-muted-foreground">{secondLabel}</dt>
                        <dd className="mt-1 font-semibold tabular-nums">{peso(row.second)}</dd>
                      </div>
                      <div className="bg-card p-3">
                        <dt className="text-muted-foreground">Variance</dt>
                        <dd className={cn("mt-1 tabular-nums", row.variance > 0 && "text-destructive")}>{peso(row.variance)}</dd>
                      </div>
                      <div className="bg-card p-3 text-right">
                        <dt className="text-muted-foreground">Positive Listing</dt>
                        <dd className={cn("mt-1 tabular-nums", row.positive > 0 && "text-success")}>{peso(row.positive)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
                <div className="rounded-lg border border-border/60 bg-[var(--total-row)] p-3 text-xs text-[var(--total-row-foreground)]">
                  <div className="mb-2 font-bold uppercase">Total · {visibleRows.length} stations</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="block opacity-80">{firstLabel}</span><strong className="tabular-nums">{peso(totals.first)}</strong></div>
                    <div className="text-right"><span className="block opacity-80">{secondLabel}</span><strong className="tabular-nums">{peso(totals.second)}</strong></div>
                    <div><span className="block opacity-80">Variance</span><strong className="tabular-nums">{peso(totals.variance)}</strong></div>
                    <div className="text-right"><span className="block opacity-80">Positive Listing</span><strong className="tabular-nums">{peso(totals.positive)}</strong></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
