import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  TrendingDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { resolveDateRange, useFilters, type DashFilters } from "@/lib/filters";
import { unwrap } from "@/lib/api-envelope";
import { cn } from "@/lib/utils";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardStationSummaryComplianceModel } from "@/types/dashboardType";
import { DashboardFilterControls } from "@/pages/02_dashboard/FilterBar";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
} from "@/pages/02_dashboard/buildProvincesPayload";
import {
  filterStationPerformanceRows,
  getStationPercentage,
  getStationPositiveListing,
  getStationRemaining,
  getStationTargetStatus,
  getStationTotalAccomplished,
  getStationTotalTarget,
  sortStationPerformanceRows,
  summarizeStationPerformanceRows,
  type StationPerformanceSortDirection,
  type StationPerformanceSortKey,
  type StationTargetStatusFilter,
} from "@/pages/02_dashboard/stationPerformanceSort";

type SortKey = StationPerformanceSortKey | "station";
type SortState = { key: SortKey; direction: StationPerformanceSortDirection };

const DEFAULT_SORT: SortState = { key: "totalAccomplished", direction: "desc" };

const STATUS_OPTIONS: { value: StationTargetStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "met", label: "Target met" },
  { value: "below", label: "Below target" },
  { value: "none", label: "No activity" },
];

const COLUMNS: { key: StationPerformanceSortKey; label: string }[] = [
  { key: "totalTarget", label: "Total Target" },
  { key: "totalAccomplished", label: "Accomplished" },
  { key: "remaining", label: "Remaining" },
  { key: "positiveListing", label: "Positive Listing" },
  { key: "percentage", label: "%" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const num = (value: number) => value.toLocaleString();
const pctText = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const pctTone = (value: number | null) =>
  value === null ? "text-muted-foreground" : value >= 100 ? "text-success" : "text-warning";
const rowPct = (row: DashboardStationSummaryComplianceModel) =>
  getStationTotalTarget(row) > 0 ? getStationPercentage(row) : null;

/** Human caption for the chosen period, e.g. "March 2026" or "1st Quarter 2026". */
function describePeriod(f: DashFilters): string {
  const year = f.year;
  const p = f.period ?? "all";
  switch (f.interval) {
    case "ANNUAL":
    case "ALL":
      return `Annual ${year}`;
    case "MONTHLY": {
      if (p === "all") return `All months ${year}`;
      const months = p.split(",").map(Number).filter((m) => m >= 1 && m <= 12);
      if (months.length === 1) return `${MONTH_NAMES[months[0] - 1]} ${year}`;
      return `${months.length} months ${year}`;
    }
    case "QUARTERLY": {
      const q = /^q([1-4])$/.exec(p)?.[1];
      return q ? `${["1st", "2nd", "3rd", "4th"][Number(q) - 1]} Quarter ${year}` : `All quarters ${year}`;
    }
    case "SEMESTER": {
      const s = /^s([12])$/.exec(p)?.[1];
      return s ? `${s === "1" ? "1st" : "2nd"} Semester ${year}` : `All semesters ${year}`;
    }
    case "WEEKLY":
      return p === "all" ? `All weeks ${year}` : `Selected weeks ${year}`;
    case "DAILY": {
      const iso = p.startsWith("all:") ? p.slice(4) : p;
      const d = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(d.getTime())) return year;
      return p.startsWith("all:")
        ? `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
        : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
    }
    default:
      return year;
  }
}

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
  align = "center",
}: {
  label: string;
  column: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "left" | "center";
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      title={`Sort by ${label}`}
      className={cn(
        "group inline-flex w-full items-center gap-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        align === "left" ? "justify-start text-left" : "justify-center text-center",
        active && "text-primary",
      )}
    >
      <span>{label}</span>
      <Icon
        className={cn("h-3.5 w-3.5 shrink-0", active ? "opacity-100" : "opacity-40 group-hover:opacity-80")}
      />
    </button>
  );
}

export function InspectionStationPerformanceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { filters: dashboardFilters } = useFilters();
  const [filters, setFilters] = React.useState<DashFilters>(dashboardFilters);
  const [status, setStatus] = React.useState<StationTargetStatusFilter>("all");
  const [sort, setSort] = React.useState<SortState>(DEFAULT_SORT);
  const [rows, setRows] = React.useState<DashboardStationSummaryComplianceModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);

  const resetFilters = React.useCallback(() => {
    setFilters(dashboardFilters);
    setStatus("all");
    setSort(DEFAULT_SORT);
  }, [dashboardFilters]);

  // Each time the popup opens it starts from the dashboard's current choices.
  React.useEffect(() => {
    if (!open) return;
    resetFilters();
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reportyear = Number(filters.year) || new Date().getFullYear();
  const range = React.useMemo(
    () => resolveDateRange(reportyear, filters.interval, filters.period),
    [reportyear, filters.interval, filters.period],
  );
  const provinces = React.useMemo(
    () => buildDashboardProvinces(filters.provinces, filters.stations),
    [filters.provinces, filters.stations],
  );
  const scopeKey = provincesPayloadKey(provinces);
  const rangeKey = `${range.interval}|${range.startdate}|${range.enddate}`;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    (async () => {
      try {
        const response = await dashboardAPI.getStationComplianceSummary(
          { reportyear, ...range, provinces },
          { signal: controller.signal, suppressGlobalLoading: true, suppressErrorToast: true },
        );
        const result = unwrap<DashboardStationSummaryComplianceModel[]>(response);
        if (cancelled || result.canceled) return;
        if (!result.ok || (result.data !== null && !Array.isArray(result.data))) {
          setRows([]);
          setError(result.error || "Unable to load station performance.");
        } else {
          setRows(result.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Unable to load station performance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reportyear, rangeKey, scopeKey, retry]);

  const overall = React.useMemo(() => summarizeStationPerformanceRows(rows), [rows]);
  const visibleRows = React.useMemo(
    () => sortStationPerformanceRows(filterStationPerformanceRows(rows, status), sort.key, sort.direction),
    [rows, status, sort],
  );
  const totals = React.useMemo(() => summarizeStationPerformanceRows(visibleRows), [visibleRows]);

  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0 });
  }, [status, sort, rows]);

  const handleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "desc" ? "asc" : "desc" }
        : { key, direction: key === "station" ? "asc" : "desc" },
    );

  const statusCount = (value: StationTargetStatusFilter) =>
    value === "all" ? rows.length : overall[value];

  const periodText = describePeriod(filters);
  const ariaSort = (key: SortKey) =>
    sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none";

  const th =
    "sticky top-0 z-20 border-b border-r border-grid bg-[var(--head-soft)] px-3 py-3 text-[var(--head-soft-foreground)]";
  const td = "border-b border-r border-grid bg-card px-3 py-2.5 text-center tabular-nums group-hover:bg-muted/60";
  const tf =
    "sticky bottom-0 z-20 border-r border-t border-grid bg-[var(--total-row)] px-3 py-3 text-center font-bold tabular-nums text-[var(--total-row-foreground)]";

  const statusAndSort = (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Target status">
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
      <div className="ml-auto md:hidden">
        <Select
          value={`${sort.key}:${sort.direction}`}
          onValueChange={(value) => {
            const [key, direction] = value.split(":") as [SortKey, StationPerformanceSortDirection];
            setSort({ key, direction });
          }}
        >
          <SelectTrigger className="h-7 w-[180px] bg-background text-xs" aria-label="Sort stations">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalAccomplished:desc">Accomplished · highest</SelectItem>
            <SelectItem value="totalAccomplished:asc">Accomplished · lowest</SelectItem>
            <SelectItem value="totalTarget:desc">Target · highest</SelectItem>
            <SelectItem value="remaining:desc">Remaining · highest</SelectItem>
            <SelectItem value="remaining:asc">Remaining · lowest</SelectItem>
            <SelectItem value="positiveListing:desc">Positive listing · highest</SelectItem>
            <SelectItem value="percentage:desc">% · highest</SelectItem>
            <SelectItem value="percentage:asc">% · lowest</SelectItem>
            <SelectItem value="station:asc">Station · A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border/60 bg-card p-0 shadow-soft">
        <div className="shrink-0 border-b border-border/60 bg-card px-5 py-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="pr-6 text-lg font-semibold">
              Inspections · Station Performance
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Inspection target vs accomplished by station for {periodText}.{" "}
              <span className="hidden md:inline">Click a column header to sort.</span>
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-4 sm:px-5 md:overflow-hidden">
          <section aria-label="Station performance filters" className="shrink-0" {...stopScrollLock}>
            <DashboardFilterControls
              title="Filters"
              filters={filters}
              onChange={setFilters}
              onReset={resetFilters}
              footer={statusAndSort}
            />
          </section>

          {!loading && !error && rows.length > 0 ? (
            <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total target
                </div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{num(totals.target)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Accomplished
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {num(totals.accomplished)}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Remaining · positive
                </div>
                <div className="mt-0.5 flex items-baseline gap-2 text-sm font-bold tabular-nums">
                  <span className={cn("flex items-center gap-1", totals.remaining > 0 ? "text-warning" : "text-muted-foreground")}>
                    {totals.remaining > 0 ? <TrendingDown className="h-4 w-4" /> : null}
                    {num(totals.remaining)}
                  </span>
                  <span className="text-[11px] font-semibold text-success">+{num(totals.positiveListing)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Performance · {visibleRows.length} of {rows.length} stations
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className={cn("text-sm font-bold tabular-nums", pctTone(totals.percentage))}>
                    {pctText(totals.percentage)}
                  </span>
                  <span className="text-[11px] text-muted-foreground" title="Target met / below target / no activity">
                    <span className="text-success">{totals.met} met</span>{" · "}
                    <span className="text-warning">{totals.below} below</span>{" · "}
                    <span>{totals.none} none</span>
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
              {rows.length === 0 ? "No station data for the selected filters." : "No stations match this status."}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-card md:flex">
                <div ref={tableScrollRef} className="min-h-0 w-full overflow-auto">
                  <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th aria-sort={ariaSort("station")} className={cn(th, "left-0 z-30 w-[34%] min-w-[280px] text-left")}>
                          <SortHeader label="Station" column="station" sort={sort} onSort={handleSort} align="left" />
                        </th>
                        {COLUMNS.map((column, i) => (
                          <th
                            key={column.key}
                            aria-sort={ariaSort(column.key)}
                            className={cn(th, i === COLUMNS.length - 1 && "border-r-0", column.key === "percentage" ? "w-[110px]" : "w-[140px]")}
                          >
                            <SortHeader label={column.label} column={column.key} sort={sort} onSort={handleSort} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row, index) => {
                        const remaining = getStationRemaining(row);
                        const positive = getStationPositiveListing(row);
                        const pct = rowPct(row);
                        return (
                          <tr key={row.stationno || index} className="group">
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
                            <td className={td}>{num(getStationTotalTarget(row))}</td>
                            <td className={cn(td, "font-semibold text-success")}>{num(getStationTotalAccomplished(row))}</td>
                            <td className={cn(td, remaining > 0 ? "text-warning" : "text-muted-foreground")}>{num(remaining)}</td>
                            <td className={cn(td, positive > 0 ? "font-semibold text-success" : "text-muted-foreground")}>{num(positive)}</td>
                            <td className={cn(td, "border-r-0 font-semibold", pctTone(pct))}>{pctText(pct)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className={cn(tf, "left-0 z-30 text-left text-xs uppercase")}>
                          Total · {visibleRows.length} station{visibleRows.length === 1 ? "" : "s"}
                        </td>
                        <td className={tf}>{num(totals.target)}</td>
                        <td className={tf}>{num(totals.accomplished)}</td>
                        <td className={tf}>{num(totals.remaining)}</td>
                        <td className={tf}>{num(totals.positiveListing)}</td>
                        <td className={cn(tf, "border-r-0")}>{pctText(totals.percentage)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {visibleRows.map((row, index) => {
                  const remaining = getStationRemaining(row);
                  const positive = getStationPositiveListing(row);
                  const pct = rowPct(row);
                  const state = getStationTargetStatus(row);
                  return (
                    <article key={row.stationno || index} className="overflow-hidden rounded-lg border border-border/60 bg-card">
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
                        <span className={cn("text-sm font-bold tabular-nums", pctTone(pct))} title={state}>
                          {pctText(pct)}
                        </span>
                      </div>
                      <dl className="grid grid-cols-2 gap-px bg-border/60 text-xs">
                        <div className="bg-card p-3">
                          <dt className="text-muted-foreground">Total Target</dt>
                          <dd className="mt-1 font-semibold tabular-nums">{num(getStationTotalTarget(row))}</dd>
                        </div>
                        <div className="bg-card p-3 text-right">
                          <dt className="text-muted-foreground">Accomplished</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-success">{num(getStationTotalAccomplished(row))}</dd>
                        </div>
                        <div className="bg-card p-3">
                          <dt className="text-muted-foreground">Remaining</dt>
                          <dd className={cn("mt-1 tabular-nums", remaining > 0 && "text-warning")}>{num(remaining)}</dd>
                        </div>
                        <div className="bg-card p-3 text-right">
                          <dt className="text-muted-foreground">Positive Listing</dt>
                          <dd className={cn("mt-1 tabular-nums", positive > 0 && "text-success")}>{num(positive)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
                <div className="rounded-lg border border-border/60 bg-[var(--total-row)] p-3 text-xs text-[var(--total-row-foreground)]">
                  <div className="mb-2 font-bold uppercase">
                    Total · {visibleRows.length} stations · {pctText(totals.percentage)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="block opacity-80">Total Target</span><strong className="tabular-nums">{num(totals.target)}</strong></div>
                    <div className="text-right"><span className="block opacity-80">Accomplished</span><strong className="tabular-nums">{num(totals.accomplished)}</strong></div>
                    <div><span className="block opacity-80">Remaining</span><strong className="tabular-nums">{num(totals.remaining)}</strong></div>
                    <div className="text-right"><span className="block opacity-80">Positive Listing</span><strong className="tabular-nums">{num(totals.positiveListing)}</strong></div>
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
