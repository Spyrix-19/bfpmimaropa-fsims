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
  Check,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "@/lib/toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SECTORS, SECTOR_COLORS, CHART_COLORS as C } from "@/lib/chart-constants";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useComplianceSummary, getNotice, sumBy } from "@/pages/02_dashboard/useComplianceSummary";
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
import StationMultiSelect, { type SelectedStation } from "@/components/station-multi-select";
import { useAuth } from "@/lib/auth";
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

  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Inspections by Sector
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {sectorTotals.accomplished.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              / {sectorTotals.target.toLocaleString()} target
            </span>
            <span className="text-sm font-semibold text-success tabular-nums">{completion}%</span>
          </div>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 overflow-x-auto border-t border-border/60 pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-1 text-left">Sector</th>
              <th className="py-1 text-center">Target</th>
              <th className="py-1 text-center">Accomplished</th>
              <th className="py-1 text-center">Remaining</th>
              <th className="py-1 text-center">Positive Listing</th>
              <th className="py-1 text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {sectorProgress.map((s) => {
              const remaining = s.target - s.accomplished;
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
                    className={`py-1.5 text-center tabular-nums ${remaining < 0 ? "text-success" : "text-warning"}`}
                    title={remaining < 0 ? "Accomplishment exceeded target" : undefined}
                  >
                    {remaining.toLocaleString()}
                  </td>
                  <td className="py-1.5 text-center tabular-nums text-success">
                    {positive ? positive.toLocaleString() : "—"}
                  </td>
                  <td
                    className={`py-1.5 text-center font-semibold tabular-nums ${pct >= 100 ? "text-success" : ""}`}
                  >
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
            {total.toLocaleString()}
          </div>
        </div>
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 divide-y divide-border/40 border-t border-border/60 pt-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2 py-1.5">
            <span className="truncate text-xs text-muted-foreground">{r.label}</span>
            <span className="text-sm font-semibold tabular-nums">{r.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
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
}: {
  label: string;
  icon: React.ReactNode;
  accent?: string;
  data: { pending: number; accomplished: number };
}) {
  const total = data.pending;
  const remaining = data.pending - data.accomplished;
  const pct = total ? Math.round((data.accomplished / total) * 100) : 0;

  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight tabular-nums">
            {total.toLocaleString()}
          </div>
        </div>
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
        {[
          { k: "Pending", v: data.pending, dot: "bg-warning", text: "text-warning" },
          { k: "Accomplished", v: data.accomplished, dot: "bg-success", text: "text-success" },
          {
            k: remaining < 0 ? "Over Target" : "Remaining",
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
    </Card>
  );
}

function YoYYearMultiSelect({
  value,
  onChange,
  options,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  options: number[];
}) {
  const [open, setOpen] = useState(false);
  const toggle = (year: number) => {
    if (value.includes(year)) {
      if (value.length <= 2) return;
      onChange(value.filter((item) => item !== year).sort((a, b) => a - b));
      return;
    }
    onChange([...value, year].sort((a, b) => a - b));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 min-w-[180px] justify-between gap-2">
          <span className="truncate text-left">{value.length ? value.join(", ") : "Select years"}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="start">
        <div className="space-y-1">
          {options.map((year) => {
            const selected = value.includes(year);
            return (
              <button
                key={year}
                type="button"
                onClick={() => toggle(year)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>{year}</span>
                {selected ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
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
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2" data-html2canvas-ignore="true">
          {actions}
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

  const { data, series } = useMemo(() => {
    if (groupBy === "province") {
      return {
        data: rows.map((r) => ({
          name: r.name,
          ...Object.fromEntries(SECTORS.map((s) => [s, r[s]])),
        })),
        series: SECTORS.map((s) => ({ key: s as string, color: SECTOR_COLORS[s] })),
      };
    }
    return {
      data: SECTORS.map((s) => ({
        name: s as string,
        ...Object.fromEntries(rows.map((r) => [r.name, r[s]])),
      })),
      series: rows.map((r, i) => ({
        key: r.name,
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      })),
    };
  }, [rows, groupBy]);

  return (
    <ChartCard
      title="Target Gap by Province"
      subtitle={
        groupBy === "province"
          ? "Remaining gap per province · line per sector"
          : "Remaining gap per sector · line per province"
      }
      height="h-72"
      actions={
        <div className="flex items-center rounded-md border border-border/60 p-0.5">
          {(["province", "sector"] as const).map((g) => (
            <Button
              key={g}
              variant={groupBy === g ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[11px] capitalize"
              onClick={() => setGroupBy(g)}
            >
              By {g}
            </Button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          No data for the selected year.
        </div>
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

  const { data, series } = useMemo(() => {
    if (groupBy === "province") {
      return {
        data: rows.map((r) => ({
          name: r.name,
          ...Object.fromEntries(SECTORS.map((s) => [s, r[s]])),
        })),
        series: SECTORS.map((s) => ({ key: s as string, color: SECTOR_COLORS[s] })),
      };
    }
    return {
      data: SECTORS.map((s) => ({
        name: s as string,
        ...Object.fromEntries(rows.map((r) => [r.name, r[s]])),
      })),
      series: rows.map((r, i) => ({
        key: r.name,
        color: PROVINCE_LINE_COLORS[i % PROVINCE_LINE_COLORS.length],
      })),
    };
  }, [rows, groupBy]);

  return (
    <ChartCard
      title="Inspections by Sector"
      subtitle={
        groupBy === "province"
          ? "Actual inspections per province · line per sector"
          : "Actual inspections per sector · line per province"
      }
      height="h-72"
      actions={
        <div className="flex items-center rounded-md border border-border/60 p-0.5">
          {(["province", "sector"] as const).map((g) => (
            <Button
              key={g}
              variant={groupBy === g ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-[11px] capitalize"
              onClick={() => setGroupBy(g)}
            >
              By {g}
            </Button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">
          No data for the selected year.
        </div>
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

export function DashboardBody() {
  const { isAuthenticated } = useAuth();
  const { compliance } = useComplianceSummary();
  const { gapRows, loading: gapLoading } = useIssuanceGap();
  const { rows: inspectionRows, loading: inspectionLoading } = useInspectionSummary();
  const { rows: targetVsActualRows, loading: targetVsActualLoading } = useTargetVsActual();
  const { rows: monthlyTrendRows, loading: monthlyTrendLoading } = useMonthlyTargetVsActual();
  const { rows: monthlySectorRows, loading: monthlySectorLoading } = useMonthlySectorTrend();
  const currentYear = new Date().getFullYear();
  const yoYYearOptions = useMemo(() => buildYears(), []);
  const [yoYSelectedYears, setYoYSelectedYears] = useState<number[]>([
    currentYear,
    currentYear - 1,
    currentYear - 2,
  ]);
  const [yoYSelectedStations, setYoYSelectedStations] = useState<SelectedStation[]>([]);
  const yoYStationYear = useMemo(
    () => (yoYSelectedYears.length ? Math.max(...yoYSelectedYears) : currentYear),
    [yoYSelectedYears, currentYear],
  );
  const { rows: yoYRows, years: yoYYears, loading: yoYLoading } = useYearlyComparison({
    selectedYears: yoYSelectedYears,
    selectedStations: yoYSelectedStations,
  });
  const {
    activity: recentActivity,
    loading: recentActivityLoading,
    error: recentActivityError,
    refresh: refreshRecentActivity,
  } = useRecentActivity(isAuthenticated);

  const inspectionBreakdown = [
    { label: "During", value: sumBy(compliance?.inspectionList, (r) => r.totalduring) },
    { label: "After", value: sumBy(compliance?.inspectionList, (r) => r.totalafter) },
    { label: "1st BPLO", value: sumBy(compliance?.inspectionList, (r) => r.totalbplo) },
    { label: "1st GOV", value: sumBy(compliance?.inspectionList, (r) => r.totalgov) },
    { label: "1st PEZA", value: sumBy(compliance?.inspectionList, (r) => r.totalpeza) },
    { label: "1st TIEZA", value: sumBy(compliance?.inspectionList, (r) => r.totaltieza) },
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownCard
          label="Inspection"
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <NoticeCard
          label="NTC"
          icon={<AlertCircle className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
          data={getNotice(compliance, "NTC")}
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
          data={getNotice(compliance, "NTCV")}
        />
        <NoticeCard
          label="Abatement"
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
          data={getNotice(compliance, "ABATEMENT")}
        />
        <NoticeCard
          label="Closure Cases"
          icon={<Ban className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
          data={getNotice(compliance, "CLOSURE")}
        />
      </div>

      {/* Row 1: Target Gap by Province | Inspections by Sector (50/50) */}
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
          <div className="flex flex-wrap items-center gap-2">
            <YoYYearMultiSelect
              value={yoYSelectedYears}
              onChange={setYoYSelectedYears}
              options={yoYYearOptions}
            />
            <StationMultiSelect
              mode="station"
              value={yoYSelectedStations}
              provinces={[]}
              reportyear={yoYStationYear}
              onChange={setYoYSelectedStations}
              placeholder="All stations"
              alwaysEnabled
              className="w-[220px]"
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

      {/* Row 6: Recent Dashboard Activity (100%) — signed-in users only */}
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
