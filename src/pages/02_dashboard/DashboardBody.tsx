import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Target,
  FileText,
  ClipboardCheck,
  AlertCircle,
  FileWarning,
  Ban,
  ShieldAlert,
  ClipboardList,
  Download,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "@/lib/toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SECTORS, SECTOR_COLORS, CHART_COLORS as C } from "@/lib/chart-constants";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useComplianceSummary,
  getNotice,
  sumBy,
  normalizeNoticeName,
} from "@/pages/02_dashboard/useComplianceSummary";
import { useIssuanceGap } from "@/pages/02_dashboard/useIssuanceGap";
import { useInspectionSummary } from "@/pages/02_dashboard/useInspectionSummary";
import { useTargetVsActual } from "@/pages/02_dashboard/useTargetVsActual";
import {
  useMonthlyTargetVsActual,
  useMonthlySectorTrend,
} from "@/pages/02_dashboard/useMonthlyTrend";
import { useYearlyComparison } from "@/pages/02_dashboard/useYearlyComparison";
import { useRecentActivity } from "@/pages/02_dashboard/useRecentActivity";
import { Skeleton } from "@/components/ui/skeleton";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { formatDateTime } from "@/lib/date-format";
import type { JournalModel } from "@/types/journalType";
import type { DashboardComplianceModel } from "@/types/dashboardType";
import type { SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { StationMultiSelect } from "@/components/station-multi-select";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import StationPerformanceSections from "@/pages/02_dashboard/components/StationPerformanceSections";

import { resolveLocationScope, useAuth } from "@/lib/auth";
import { buildYears } from "@/lib/utils";

/**
 * Dashboard body.
 *
 * Every number, chart series and activity row is served by the API — there is
 * no mock/sample data left in this page.
 */

function SectorProgressCard({ compliance }: { compliance: DashboardComplianceModel | null }) {
  const sectorProgress: Array<{
    name: (typeof SECTORS)[number];
    target: number;
    accomplished: number;
  }> = [
    {
      name: "BPLO",
      target: compliance?.totaltargetbplo ?? 0,
      accomplished: compliance?.totalAccomplishmentbplo ?? 0,
    },
    {
      name: "GOVT",
      target: compliance?.totaltargetgov ?? 0,
      accomplished: compliance?.totalAccomplishmentgov ?? 0,
    },
    {
      name: "PEZA",
      target: compliance?.totaltargetpeza ?? 0,
      accomplished: compliance?.totalAccomplishmentpeza ?? 0,
    },
    {
      name: "TIEZA",
      target: compliance?.totaltargettieza ?? 0,
      accomplished: compliance?.totalAccomplishmenttieza ?? 0,
    },
  ];

  const sectorTotals = sectorProgress.reduce(
    (acc, s) => ({
      target: acc.target + s.target,
      accomplished: acc.accomplished + s.accomplished,
    }),
    { target: 0, accomplished: 0 },
  );

  const completion = sectorTotals.target
    ? Math.round((sectorTotals.accomplished / sectorTotals.target) * 100)
    : 0;

  const remaining = Math.max(sectorTotals.target - sectorTotals.accomplished, 0);
  const positive = Math.max(sectorTotals.accomplished - sectorTotals.target, 0);

  const [expanded, setExpanded] = useState(false);

  const metrics = [
    { label: "Total Target", value: sectorTotals.target.toLocaleString(), tone: "text-foreground" },
    {
      label: "Total Accomplished",
      value: sectorTotals.accomplished.toLocaleString(),
      tone: "text-success",
    },
    {
      label: "Remaining",
      value: remaining.toLocaleString(),
      tone: remaining > 0 ? "text-warning" : "text-success",
    },
    {
      label: "Positive Listing",
      value: positive ? positive.toLocaleString() : "—",
      tone: "text-success",
    },
  ];

  return (
    <Card className="overflow-hidden border-border/60 bg-card p-0 shadow-soft transition-shadow hover:shadow-elegant">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-4 px-5 pb-4 pt-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
              <Target className="h-4.5 w-4.5" />
            </div>
            <div className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Inspections
            </div>
            <span
              className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
                completion >= 100 ? "tone-success-soft" : "tone-info-soft"
              }`}
            >
              {completion}%
            </span>
          </div>

          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-primary transition-[width] duration-500"
              style={{ width: `${Math.min(completion, 100)}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-border/60 bg-card p-3 shadow-soft"
              >
                <div className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className={`mt-1 text-base font-semibold tabular-nums ${m.tone}`}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3 py-3 sm:px-5">
          <table className="w-full table-fixed text-[11px] sm:text-sm">
            <thead>
              <tr className="text-[9px] font-semibold uppercase leading-tight tracking-tight text-muted-foreground sm:text-[10px] sm:tracking-wider">
                <th className="w-[22%] px-0.5 py-1 text-left">Sector</th>
                <th className="px-0.5 py-1 text-center">Target</th>
                <th className="px-0.5 py-1 text-center">Accompl.</th>
                <th className="px-0.5 py-1 text-center">Remain.</th>
                <th className="px-0.5 py-1 text-center">Positive</th>
                <th className="w-[12%] px-0.5 py-1 text-center">%</th>
              </tr>
            </thead>

            <tbody>
              {sectorProgress.map((s) => {
                const remaining = Math.max(s.target - s.accomplished, 0);
                const positive = Math.max(s.accomplished - s.target, 0);
                const pct = s.target ? Math.round((s.accomplished / s.target) * 100) : 0;
                return (
                  <tr key={s.name} className="border-t border-border/40">
                    <td className="py-1.5 text-left font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: SECTOR_COLORS[s.name] }}
                        />
                        {s.name}
                      </span>
                    </td>
                    <td className="py-1.5 text-center tabular-nums">{s.target.toLocaleString()}</td>
                    <td className="py-1.5 text-center font-semibold tabular-nums text-success">
                      {s.accomplished.toLocaleString()}
                    </td>
                    <td
                      className={`py-1.5 text-center tabular-nums ${
                        remaining > 0 ? "text-warning" : "text-success"
                      }`}
                    >
                      {remaining.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-center tabular-nums text-success">
                      {positive ? positive.toLocaleString() : "—"}
                    </td>
                    <td
                      className={`py-1.5 text-center font-semibold tabular-nums ${
                        pct >= 100 ? "text-success" : ""
                      }`}
                    >
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function BreakdownCard({
  label,
  icon,
  accent,
  rows,
}: {
  label: string;
  icon: React.ReactNode;
  accent?: string;
  rows: { label: string; value: number }[];
}) {
  const total = rows.reduce((a, r) => a + r.value, 0);
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
            {total.toLocaleString()}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              accent ?? "bg-primary/10 text-primary"
            }`}
          >
            {icon}
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 divide-y divide-border/40 border-t border-border/60 pt-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate text-xs text-muted-foreground">{r.label}</span>
              <span className="text-sm font-semibold tabular-nums">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: string;
  hint?: string;
}) {
  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">{value}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function NoticeCard({
  label,
  icon,
  accent,
  data,
  singleValue = false,
}: {
  label: string;
  icon: React.ReactNode;
  accent?: string;
  data: {
    pending: number;
    accomplished: number;
    ntcvPending?: number;
    abatementPending?: number;
  };
  singleValue?: boolean;
}) {
  const total = singleValue ? data.accomplished : data.pending;
  const ntcvPending = data.ntcvPending ?? 0;
  const abatementPending = data.abatementPending ?? 0;
  const normalized = normalizeNoticeName(label);
  const isNtc = normalized === "NTC";
  const isNtcv = normalized === "NTCV";
  const rawRemaining = isNtc
    ? data.pending - data.accomplished - ntcvPending
    : isNtcv
      ? data.pending - data.accomplished - abatementPending
      : data.pending - data.accomplished;
  const remaining = rawRemaining;
  const pct = total ? Math.round((data.accomplished / total) * 100) : 0;
  const [expanded, setExpanded] = useState(false);
  const [showStationList, setShowStationList] = useState(false);

  const isExpandable = !singleValue;
  const showSeeListButton = normalized === "NTCV";

  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <button
        type="button"
        aria-expanded={isExpandable ? expanded : undefined}
        onClick={() => isExpandable && setExpanded((v) => !v)}
        className="flex w-full flex-col text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                accent ?? "bg-primary/10 text-primary"
              }`}
            >
              {icon}
            </div>
            {!singleValue &&
              (expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ))}
          </div>
        </div>

        <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
          {singleValue ? (
            total.toLocaleString()
          ) : expanded ? (
            total.toLocaleString()
          ) : (
            <>
              {data.accomplished.toLocaleString()}
              <span className="mx-1 text-muted-foreground">/</span>
              {data.pending.toLocaleString()}
            </>
          )}
        </div>

        <div className="mt-auto pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {singleValue ? "Total Non Operational" : expanded ? null : "Complied / Issued"}
        </div>
      </button>

      {isExpandable && expanded && (
        <>
          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
            {[
              { k: "Issued", v: data.pending, dot: "bg-warning", text: "text-warning" },
              { k: "Complied", v: data.accomplished, dot: "bg-success", text: "text-success" },
              {
                k: remaining < 0 ? "Over Target" : "Pending",
                v: remaining,
                dot: remaining < 0 ? "bg-success" : "bg-destructive",
                text: remaining < 0 ? "text-success" : "text-destructive",
              },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.dot}`} />
                  <span className="truncate">{row.k}</span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${row.text}`}>
                  {row.v.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Accomplishment</span>
              <span className="tabular-nums text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>

          {showSeeListButton && (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-center text-[11px]"
                onClick={() => setShowStationList(true)}
              >
                See List of Stations
              </Button>
            </div>
          )}
        </>
      )}

      {showSeeListButton && (
        <Dialog open={showStationList} onOpenChange={setShowStationList}>
          <DialogContent className="max-w-md gap-0 p-0 sm:rounded-lg">
            <DialogHeader className="border-b border-border/60 bg-muted/30 px-5 py-4 text-left">
              <DialogTitle className="text-base font-semibold">NTCV Stations</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Station list for NTCV.
              </DialogDescription>
            </DialogHeader>
            <div className="p-5">
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                No station list available yet.
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function YoYYearMultiSelect({
  selectedYears,
  onChange,
  options,
}: {
  selectedYears: number[];
  onChange: (next: number[]) => void;
  options: number[];
}) {
  const label = selectedYears.length > 0 ? selectedYears.join(", ") : "Select years";

  const toggleYear = (year: number) => {
    const selected = selectedYears.includes(year);
    if (selected) {
      if (selectedYears.length <= 2) return;
      onChange(selectedYears.filter((y) => y !== year));
      return;
    }
    onChange([...selectedYears, year].sort((a, b) => a - b));
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
            {options.map((year) => {
              const checked = selectedYears.includes(year);
              return (
                <label
                  key={year}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleYear(year)}
                    aria-label={`Toggle ${year}`}
                  />
                  <span className="text-sm">{year}</span>
                </label>
              );
            })}
          </div>
          <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Select at least 2 years. Default is current year and previous 2 years.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
  fileName,
  height = "h-72",
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  fileName?: string;
  height?: string;
  actions?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const download = async () => {
    if (!ref.current) return;
    try {
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const dataUrl = await toPng(ref.current, {
        backgroundColor: bg,
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${fileName ?? title.replace(/\s+/g, "_").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`${title} saved as PNG`);
    } catch (err) {
      console.error(err);
      toast.error("Could not export chart");
    }
  };

  return (
    <Card ref={ref} className={`border-border/60 bg-card p-5 shadow-soft ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <div className="order-1 min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && (
          <div
            className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:w-auto sm:shrink-0"
            data-html2canvas-ignore="true"
          >
            {actions}
          </div>
        )}
        <div className="order-2 shrink-0 sm:order-3" data-html2canvas-ignore="true">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={download}
            aria-label={`Download ${title}`}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className={`${height} w-full`}>{children}</div>
    </Card>
  );
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  CREATE: "bg-success/10 text-success",
  INSERT: "bg-success/10 text-success",
  UPDATE: "bg-primary/10 text-primary",
  EDIT: "bg-primary/10 text-primary",
  DELETE: "bg-destructive/10 text-destructive",
  LOGIN: "bg-secondary/10 text-secondary",
  LOGOUT: "bg-muted text-muted-foreground",
  EXPORT: "bg-warning/10 text-warning",
};

function ActivitySkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

function ActivityCard({
  title,
  subtitle,
  items,
  loading,
  error,
  onRetry,
}: {
  title: string;
  subtitle?: string;
  items: JournalModel[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-border/60 bg-card p-5 shadow-soft">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {loading ? (
        <ActivitySkeleton />
      ) : error ? (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{error} It will retry automatically.</span>
          {onRetry && (
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onRetry}>
              Retry now
            </Button>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-background p-4 text-xs text-muted-foreground">
          No recent activity recorded.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const action = (item.actiontype ?? "").trim();
            const badgeClass =
              ACTION_BADGE_COLORS[action.toUpperCase()] ?? "bg-muted text-muted-foreground";
            return (
              <div
                key={item.journalno}
                className="rounded-2xl border border-border/60 bg-background p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <AvatarWithFallback
                      entity="station"
                      name={item.stationname || item.stationcode}
                      src={item.logourl}
                      alt={item.stationname || "Station"}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.stationname || item.stationcode || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.description || item.tablename || "—"}
                      </p>
                    </div>
                  </div>
                  {action && (
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${badgeClass}`}
                    >
                      {action}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{formatDateTime(item.dateencoded, "—")}</span>
                  {item.modulename && (
                    <span className="font-semibold text-foreground">{item.modulename}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* Announcements moved to the top-nav notifications popover
   (see src/components/NotificationsPopover.tsx). */

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
};

const axisProps = {
  tick: { fontSize: 11 },
  stroke: "var(--color-muted-foreground)",
};

const PROVINCE_LINE_COLORS = [C.primary, C.success, C.warning, C.danger, C.purple, C.teal];

type GapRow = { name: string; BPLO: number; GOVT: number; PEZA: number; TIEZA: number };

function GapChartCard({ rows, loading }: { rows: GapRow[]; loading: boolean }) {
  const [groupBy, setGroupBy] = useState<"province" | "sector">("province");
  const [chartType, setChartType] = useState<"line" | "pie">("line");

  const { data, series, pieData } = useMemo(() => {
    if (groupBy === "province") {
      const nextData = rows.map((r) => ({
        name: r.name,
        ...Object.fromEntries(SECTORS.map((s) => [s, r[s]])),
      }));
      const provinceTotals = rows.map((r, i) => ({
        name: r.name,
        value: SECTORS.reduce((sum, sector) => sum + (r[sector] ?? 0), 0),
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      }));
      return {
        data: nextData,
        series: SECTORS.map((s) => ({ key: s as string, color: SECTOR_COLORS[s] })),
        pieData: provinceTotals,
      };
    }
    const nextData = SECTORS.map((s) => ({
      name: s as string,
      ...Object.fromEntries(rows.map((r) => [r.name, r[s]])),
    }));
    const sectorTotals = SECTORS.map((sector, i) => ({
      name: sector,
      value: rows.reduce((total, r) => total + (r[sector] ?? 0), 0),
      color: SECTOR_COLORS[sector],
    }));
    return {
      data: nextData,
      series: rows.map((r, i) => ({
        key: r.name,
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      })),
      pieData: sectorTotals,
    };
  }, [rows, groupBy]);

  return (
    <ChartCard
      title="Target Gap by Province"
      subtitle={
        groupBy === "province"
          ? chartType === "line"
            ? "Remaining gap per province · line per sector"
            : "Remaining gap per province · pie by province"
          : chartType === "line"
            ? "Remaining gap per sector · line per province"
            : "Remaining gap per sector · pie by sector"
      }
      height="h-72"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex w-full items-center rounded-md border border-border/60 p-0.5 sm:w-auto">
            {(["province", "sector"] as const).map((g) => (
              <Button
                key={g}
                variant={groupBy === g ? "secondary" : "ghost"}
                size="sm"
                className="h-6 flex-1 px-2 text-[11px] capitalize sm:flex-none"
                onClick={() => setGroupBy(g)}
              >
                By {g}
              </Button>
            ))}
          </div>
          <div className="flex w-full items-center rounded-md border border-border/60 p-0.5 sm:w-auto">
            {(["line", "pie"] as const).map((type) => (
              <Button
                key={type}
                variant={chartType === type ? "secondary" : "ghost"}
                size="sm"
                className="h-6 flex-1 px-2 text-[11px] capitalize sm:flex-none"
                onClick={() => setChartType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          No data for the selected year.
        </div>
      ) : chartType === "pie" ? (
        <ResponsiveContainer>
          <PieChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              innerRadius={36}
              paddingAngle={2}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Gap"]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function InspectionSummaryChartCard({ rows, loading }: { rows: GapRow[]; loading: boolean }) {
  const [groupBy, setGroupBy] = useState<"province" | "sector">("province");
  const [chartType, setChartType] = useState<"line" | "pie">("line");

  const { data, series, pieData } = useMemo(() => {
    if (groupBy === "province") {
      const nextData = rows.map((r) => ({
        name: r.name,
        ...Object.fromEntries(SECTORS.map((s) => [s, r[s]])),
      }));
      const provinceTotals = rows.map((r, i) => ({
        name: r.name,
        value: SECTORS.reduce((sum, sector) => sum + (r[sector] ?? 0), 0),
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      }));
      return {
        data: nextData,
        series: SECTORS.map((s) => ({ key: s as string, color: SECTOR_COLORS[s] })),
        pieData: provinceTotals,
      };
    }
    const nextData = SECTORS.map((s) => ({
      name: s as string,
      ...Object.fromEntries(rows.map((r) => [r.name, r[s]])),
    }));
    const sectorTotals = SECTORS.map((sector, i) => ({
      name: sector,
      value: rows.reduce((total, r) => total + (r[sector] ?? 0), 0),
      color: SECTOR_COLORS[sector],
    }));
    return {
      data: nextData,
      series: rows.map((r, i) => ({
        key: r.name,
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      })),
      pieData: sectorTotals,
    };
  }, [rows, groupBy]);

  return (
    <ChartCard
      title="Inspections"
      subtitle={
        groupBy === "province"
          ? chartType === "line"
            ? "Actual inspections per province · line per sector"
            : "Actual inspections per province · pie by province"
          : chartType === "line"
            ? "Actual inspections per sector · line per province"
            : "Actual inspections per sector · pie by sector"
      }
      height="h-72"
      actions={
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex w-full items-center rounded-md border border-border/60 p-0.5 sm:w-auto">
            {(["province", "sector"] as const).map((g) => (
              <Button
                key={g}
                variant={groupBy === g ? "secondary" : "ghost"}
                size="sm"
                className="h-6 flex-1 px-2 text-[11px] capitalize sm:flex-none"
                onClick={() => setGroupBy(g)}
              >
                By {g}
              </Button>
            ))}
          </div>
          <div className="flex w-full items-center rounded-md border border-border/60 p-0.5 sm:w-auto">
            {(["line", "pie"] as const).map((type) => (
              <Button
                key={type}
                variant={chartType === type ? "secondary" : "ghost"}
                size="sm"
                className="h-6 flex-1 px-2 text-[11px] capitalize sm:flex-none"
                onClick={() => setChartType(type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          No data for the selected year.
        </div>
      ) : chartType === "pie" ? (
        <ResponsiveContainer>
          <PieChart margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              innerRadius={36}
              paddingAngle={2}
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, "Inspections"]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/** Per-chart Province + Station scope (multi-select, searchable). */
type ChartScope = { provinces: SelectedLocation[]; stations: SelectedStation[] };
const EMPTY_CHART_SCOPE: ChartScope = { provinces: [], stations: [] };

function ChartScopeFilters({
  isAuthenticated,
  scope,
  value,
  onChange,
  reportyear,
  provinceOnly = false,
  forceProvinceLock = false,
}: {
  isAuthenticated: boolean;
  scope: ReturnType<typeof resolveLocationScope>;
  value: ChartScope;
  onChange: (next: ChartScope) => void;
  reportyear?: number;
  /** Hide the Station picker (province-scoped charts). */
  provinceOnly?: boolean;
  /** Lock the Province picker to the signed-in user's province. */
  forceProvinceLock?: boolean;
}) {
  // Visible to everyone; role-based locks below still apply when signed in.
  const provinceLocked = scope.provinceLocked || forceProvinceLock;

  const handleProvinces = (provinces: SelectedLocation[]) => {
    if (provinces.length === 0) {
      onChange({ provinces: [], stations: [] });
      return;
    }
    const allowed = new Set(provinces.map((p) => p.locationno));
    onChange({ provinces, stations: value.stations.filter((s) => allowed.has(s.provinceno)) });
  };

  const handleStations = (stations: SelectedStation[]) => {
    const merged = [...value.provinces];
    const known = new Set(merged.map((p) => p.locationno));
    stations.forEach((s) => {
      if (!s.provinceno || known.has(s.provinceno)) return;
      known.add(s.provinceno);
      merged.push({ locationno: s.provinceno, locationname: s.provincename });
    });
    onChange({ provinces: merged, stations });
  };

  return (
    <>
      {provinceLocked ? (
        <ReadOnlyField
          value={scope.provincename}
          placeholder="All provinces"
          title="Restricted to your assigned province"
          className="w-full shrink-0 sm:w-[240px]"
        />
      ) : (
        <LocationMultiSelect
          mode="location"
          value={value.provinces}
          locationtype="PROVINCE"
          parentcode={MIMAROPA_REGION_CODE}
          onChange={handleProvinces}
          placeholder="All provinces"
          hideCode
          className="w-full shrink-0 sm:w-[240px]"
        />
      )}

      {provinceOnly ? null : scope.stationLocked ? (
        <ReadOnlyField
          value={scope.stationname}
          placeholder="All stations"
          title="Restricted to your assigned station"
          className="w-full shrink-0 sm:w-[240px]"
        />
      ) : (
        <StationMultiSelect
          mode="station"
          value={value.stations}
          provinces={value.provinces.map((p) => ({ provinceno: p.locationno }))}
          reportyear={reportyear}
          onChange={handleStations}
          placeholder="All stations"
          alwaysEnabled
          className="w-full shrink-0 sm:w-[240px]"
        />
      )}
    </>
  );
}

export function DashboardBody() {
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const currentYear = new Date().getFullYear();
  const { compliance } = useComplianceSummary();
  const { gapRows, loading: gapLoading } = useIssuanceGap();
  const { rows: inspectionRows, loading: inspectionLoading } = useInspectionSummary();
  // Target vs Actual is province-scoped only; station types 27–31 are pinned
  // to the signed-in user's province (read-only).
  const targetProvinceLocked =
    isAuthenticated && [27, 28, 29, 30, 31].includes(Number(user?.stationtype ?? 0));
  const [targetVsActualYear, setTargetVsActualYear] = useState<number>(currentYear);
  const [targetVsActualScope, setTargetVsActualScope] = useState<ChartScope>(EMPTY_CHART_SCOPE);
  useEffect(() => {
    if (targetProvinceLocked && scope.provinceno) {
      setTargetVsActualScope({
        provinces: [{ locationno: scope.provinceno, locationname: scope.provincename }],
        stations: [],
      });
    } else {
      setTargetVsActualScope(EMPTY_CHART_SCOPE);
    }
  }, [targetProvinceLocked, scope.provinceno, scope.provincename]);
  const { rows: targetVsActualRows, loading: targetVsActualLoading } = useTargetVsActual({
    selectedYear: targetVsActualYear,
    selectedProvinces: targetVsActualScope.provinces,
    selectedStations: [],
  });

  const [monthlyTrendYear, setMonthlyTrendYear] = useState<number>(currentYear);
  const [monthlyTrendScope, setMonthlyTrendScope] = useState<ChartScope>(EMPTY_CHART_SCOPE);
  const { rows: monthlyTrendRows, loading: monthlyTrendLoading } = useMonthlyTargetVsActual({
    selectedYear: monthlyTrendYear,
    selectedProvinces: monthlyTrendScope.provinces,
    selectedStations: monthlyTrendScope.stations,
  });
  const [monthlySectorYear, setMonthlySectorYear] = useState<number>(currentYear);
  const [monthlySectorScope, setMonthlySectorScope] = useState<ChartScope>(EMPTY_CHART_SCOPE);
  const { rows: monthlySectorRows, loading: monthlySectorLoading } = useMonthlySectorTrend({
    selectedYear: monthlySectorYear,
    selectedProvinces: monthlySectorScope.provinces,
    selectedStations: monthlySectorScope.stations,
  });
  const yoYYearOptions = useMemo(() => buildYears(), []);
  const [yoYSelectedYears, setYoYSelectedYears] = useState<number[]>([
    currentYear - 2,
    currentYear - 1,
    currentYear,
  ]);
  const [yoYScope, setYoYScope] = useState<ChartScope>(EMPTY_CHART_SCOPE);
  const {
    rows: yoYRows,
    years: yoYYears,
    loading: yoYLoading,
  } = useYearlyComparison({
    selectedYears: yoYSelectedYears,
    selectedProvinces: yoYScope.provinces,
    selectedStations: yoYScope.stations,
  });

  // Seed / enforce the user's assigned scope on every chart-level filter.
  useEffect(() => {
    if (!isAuthenticated) {
      // Public view: chart filters are freely selectable, nothing to enforce.
      return;
    }

    const lockedProvinces: SelectedLocation[] =
      scope.provinceLocked && scope.provinceno
        ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
        : [];
    const lockedStations: SelectedStation[] =
      scope.stationLocked && scope.stationno
        ? [
            {
              stationno: scope.stationno,
              stationname: scope.stationname,
              provinceno: scope.provinceno,
              provincename: scope.provincename,
            },
          ]
        : [];
    if (!lockedProvinces.length && !lockedStations.length) return;

    const apply = (prev: ChartScope): ChartScope => {
      const provinces = lockedProvinces.length ? lockedProvinces : prev.provinces;
      const stations = lockedStations.length ? lockedStations : prev.stations;
      const sameProvinces =
        provinces.length === prev.provinces.length &&
        provinces.every((p, i) => p.locationno === prev.provinces[i]?.locationno);
      const sameStations =
        stations.length === prev.stations.length &&
        stations.every((s, i) => s.stationno === prev.stations[i]?.stationno);
      return sameProvinces && sameStations ? prev : { provinces, stations };
    };

    setTargetVsActualScope(apply);
    setMonthlyTrendScope(apply);
    setMonthlySectorScope(apply);
    setYoYScope(apply);
  }, [
    isAuthenticated,
    scope.provinceLocked,
    scope.stationLocked,
    scope.stationno,
    scope.stationname,
    scope.provinceno,
    scope.provincename,
  ]);
  const {
    activity: recentActivity,
    loading: recentActivityLoading,
    error: recentActivityError,
    refresh: refreshRecentActivity,
  } = useRecentActivity(isAuthenticated);

  const inspectionBreakdown = [
    {
      label: "During Construction",
      value: sumBy(compliance?.inspectionList, (r) => r.totalduring),
    },
    { label: "After Completion", value: sumBy(compliance?.inspectionList, (r) => r.totalafter) },
    { label: "Reinspection", value: sumBy(compliance?.inspectionList, (r) => r.totalreinspection) },
  ];

  const fsecBreakdown = [
    { label: "Building", value: sumBy(compliance?.fsecList, (r) => r.totalbuilding) },
    { label: "Gov", value: sumBy(compliance?.fsecList, (r) => r.totalgov) },
    { label: "PEZA", value: sumBy(compliance?.fsecList, (r) => r.totalpeza) },
    { label: "TIEZA", value: sumBy(compliance?.fsecList, (r) => r.totaltieza) },
  ];

  const fsicBreakdown = [
    { label: "Occupancy", value: sumBy(compliance?.fsicList, (r) => r.totaloccupancy) },
    { label: "BPLO New", value: sumBy(compliance?.fsicList, (r) => r.totalbplonew) },
    { label: "BPLO Renew", value: sumBy(compliance?.fsicList, (r) => r.totalbplorenew) },
    { label: "Gov", value: sumBy(compliance?.fsicList, (r) => r.totalgov) },
    { label: "PEZA", value: sumBy(compliance?.fsicList, (r) => r.totalpeza) },
    { label: "TIEZA", value: sumBy(compliance?.fsicList, (r) => r.totaltieza) },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs — sector progress full width */}
      <SectorProgressCard compliance={compliance} />

      {/* Breakdowns — Inspection / FSEC / FSIC */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownCard
          label="Other Inspections"
          icon={<ClipboardList className="h-5 w-5" />}
          rows={inspectionBreakdown}
        />
        <BreakdownCard
          label="FSEC"
          icon={<FileText className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
          rows={fsecBreakdown}
        />
        <BreakdownCard
          label="FSIC"
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="bg-success/10 text-success"
          rows={fsicBreakdown}
        />
      </div>

      {/* Running notices — pending / accomplished / remaining */}
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <NoticeCard
          label="NTC"
          icon={<AlertCircle className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
          data={{
            ...getNotice(compliance, "NTC"),
            ntcvPending: getNotice(compliance, "NTCV").pending,
          }}
        />
        <NoticeCard
          label="NOD"
          icon={<FileWarning className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
          data={getNotice(compliance, "NOD")}
        />
        <NoticeCard
          label="NTCV"
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
          data={{
            ...getNotice(compliance, "NTCV"),
            abatementPending: getNotice(compliance, "ABATEMENT").pending,
          }}
        />
        <NoticeCard
          label="Abatement"
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
          data={getNotice(compliance, "ABATEMENT")}
        />
        <NoticeCard
          label="Closure"
          icon={<Ban className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
          data={getNotice(compliance, "CLOSURE")}
        />
        <NoticeCard
          label="Non Operational"
          icon={<Ban className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
          data={getNotice(compliance, "NON OPERATIONAL")}
          singleValue
        />
      </div>

      {/* Row 1: Target Gap by Province | Inspections (50/50) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GapChartCard rows={gapRows} loading={gapLoading} />

        <InspectionSummaryChartCard rows={inspectionRows} loading={inspectionLoading} />
      </div>

      {/* Supplementary row: Target vs Actual by Province */}
      <div className="grid grid-cols-1 gap-6">
        <ChartCard
          title="Target vs Actual by Province"
          subtitle="Provincial accomplishment"
          height="h-72"
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Select
                value={String(targetVsActualYear)}
                onValueChange={(v) => setTargetVsActualYear(Number(v))}
              >
                <SelectTrigger className="h-9 w-full shrink-0 sm:w-[96px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yoYYearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ChartScopeFilters
                isAuthenticated={isAuthenticated}
                scope={scope}
                value={targetVsActualScope}
                onChange={setTargetVsActualScope}
                reportyear={targetVsActualYear}
                provinceOnly
                forceProvinceLock={targetProvinceLocked}
              />
            </div>
          }
        >
          {targetVsActualLoading ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : targetVsActualRows.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              No data for the selected year.
            </div>
          ) : (
            <ResponsiveContainer>
              <BarChart
                data={targetVsActualRows}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="target" fill={C.warning} radius={[4, 4, 0, 0]} name="Target" />
                <Bar dataKey="actual" fill={C.primary} radius={[4, 4, 0, 0]} name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Monthly Accomplishment Trend (100%) */}
      <ChartCard
        title="Monthly Accomplishment Trend"
        subtitle="Target vs Actual per month"
        height="h-[420px] xl:h-[500px]"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Select
              value={String(monthlyTrendYear)}
              onValueChange={(v) => setMonthlyTrendYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-full shrink-0 sm:w-[96px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yoYYearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ChartScopeFilters
              isAuthenticated={isAuthenticated}
              scope={scope}
              value={monthlyTrendScope}
              onChange={setMonthlyTrendScope}
              reportyear={monthlyTrendYear}
            />
          </div>
        }
      >
        {monthlyTrendLoading ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : monthlyTrendRows.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No data for the selected year.
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={monthlyTrendRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="target"
                stroke={C.warning}
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Target"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={C.primary}
                strokeWidth={3}
                dot={{ r: 3 }}
                name="Actual"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 4: Monthly Trend by Sector (100%) */}
      <ChartCard
        title="Monthly Trend by Sector"
        subtitle="Actual inspections per sector"
        height="h-[420px] xl:h-[500px]"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Select
              value={String(monthlySectorYear)}
              onValueChange={(v) => setMonthlySectorYear(Number(v))}
            >
              <SelectTrigger className="h-9 w-full shrink-0 sm:w-[96px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yoYYearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ChartScopeFilters
              isAuthenticated={isAuthenticated}
              scope={scope}
              value={monthlySectorScope}
              onChange={setMonthlySectorScope}
              reportyear={monthlySectorYear}
            />
          </div>
        }
      >
        {monthlySectorLoading ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : monthlySectorRows.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No data for the selected year.
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={monthlySectorRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SECTORS.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={SECTOR_COLORS[s]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 5: Year-over-Year Comparison (100%) */}
      <ChartCard
        title="Year-over-Year Inspection Comparison"
        subtitle={
          yoYYears.length
            ? `${yoYYears.join(" vs ")} monthly actuals`
            : "Monthly actual inspection comparisons per report year"
        }
        height="h-[420px] xl:h-[500px]"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <YoYYearMultiSelect
                selectedYears={yoYSelectedYears}
                onChange={setYoYSelectedYears}
                options={yoYYearOptions}
              />
            </div>

            <ChartScopeFilters
              isAuthenticated={isAuthenticated}
              scope={scope}
              value={yoYScope}
              onChange={setYoYScope}
              reportyear={yoYSelectedYears[yoYSelectedYears.length - 1] ?? currentYear}
            />
          </div>
        }
      >
        {yoYLoading ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : yoYYears.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            No data for the selected period.
          </div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={yoYRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {yoYYears.map((yr, i) => {
                const isLatest = i === yoYYears.length - 1;
                const palette = [C.teal, C.warning, C.primary];
                return (
                  <Line
                    key={yr}
                    type="monotone"
                    dataKey={String(yr)}
                    name={String(yr)}
                    stroke={isLatest ? C.primary : palette[i % palette.length]}
                    strokeWidth={isLatest ? 3 : 2}
                    dot={isLatest ? { r: 3 } : false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Row 6: Station performance leaderboards */}
      <StationPerformanceSections selectedYear={currentYear} />

      {/* Row 7: Recent Dashboard Activity (100%) — signed-in users only */}
      {isAuthenticated && (
        <ActivityCard
          title="Recent Dashboard Activity"
          subtitle="Latest system journal entries · auto-refreshes every 60s"
          items={recentActivity}
          loading={recentActivityLoading}
          error={recentActivityError}
          onRetry={refreshRecentActivity}
        />
      )}

      {/* Announcements now live in the top-nav notifications popover. */}
    </div>
  );
}
