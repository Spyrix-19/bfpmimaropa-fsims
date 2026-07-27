import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Target,
  CheckCircle2,
  TrendingUp,
  FileText,
  ClipboardCheck,
  AlertCircle,
  FileWarning,
  Ban,
  ShieldAlert,
  Download,
  Info,
} from "lucide-react";
import { useRef } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
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
import { dashboardMockData } from "@/mock/dashboard.mock";

/**
 * Dashboard body — sample/representation data only.
 *
 * All visualizations below use the centralized `dashboardMockData` mock.
 * Filters on this page do NOT affect any of these values; they will be
 * wired up once the backend exposes a real aggregation endpoint.
 */

const {
  summary,
  byMonth,
  byMonthSector,
  byProvince,
  targetGapByProvince,
  recentActivity,
  bySector,
  byApplication,
  sectorByApp,
  byStation,
  yoY,
  SECTORS,
  SECTOR_COLORS,
  CHART_COLORS: C,
} = dashboardMockData;

const completion = summary.target
  ? Math.round((summary.actual / summary.target) * 100)
  : 0;

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

function ChartCard({
  title,
  subtitle,
  children,
  className,
  fileName,
  height = "h-72",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  fileName?: string;
  height?: string;
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
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={download}
          aria-label={`Download ${title}`}
          data-html2canvas-ignore="true"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className={`${height} w-full`}>{children}</div>
    </Card>
  );
}

function ActivityCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ station: string; action: string; value: string; time: string; badge: string }>;
}) {
  const badgeColors: Record<string, string> = {
    FSEC: "bg-primary/10 text-primary",
    FSIC: "bg-success/10 text-success",
    NTC: "bg-warning/10 text-warning",
    NOD: "bg-destructive/10 text-destructive",
    Closure: "bg-secondary/10 text-secondary",
  };

  return (
    <Card className="border-border/60 bg-card p-5 shadow-soft">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="rounded-2xl border border-border/60 bg-background p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.station}</p>
                <p className="text-xs text-muted-foreground">{item.action}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  badgeColors[item.badge] ?? "bg-muted/10 text-muted-foreground"
                }`}
              >
                {item.badge}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{item.time}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

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

export function DashboardBody() {
  return (
    <div className="space-y-6">
      {/* Representation banner */}
      <Card className="flex items-start gap-3 border-primary/30 bg-primary/5 p-3 text-sm shadow-none">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-foreground/80">
          <span className="font-semibold text-primary">Sample data for representation.</span>{" "}
          The values, charts and activity below are placeholders to preview the dashboard layout.
          Filters do not affect these numbers.
          <div className="mt-1 text-xs text-muted-foreground">Last updated: {summary.lastUpdated}</div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Target Inspections"
          value={summary.target.toLocaleString()}
          icon={<Target className="h-5 w-5" />}
        />
        <KpiCard
          label="Actual Inspections"
          value={summary.actual.toLocaleString()}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="bg-success/10 text-success"
        />
        <KpiCard
          label="Completion Rate"
          value={`${completion}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
          hint={`${summary.records.toLocaleString()} establishments`}
        />
        <KpiCard label="FSEC" value={summary.fsec} icon={<FileText className="h-5 w-5" />} />
        <KpiCard
          label="FSIC"
          value={summary.fsic}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="bg-success/10 text-success"
        />
        <KpiCard
          label="NTC"
          value={summary.ntc}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
        />
        <KpiCard
          label="NOD"
          value={summary.nod}
          icon={<FileWarning className="h-5 w-5" />}
          accent="bg-warning/10 text-warning"
        />
        <KpiCard
          label="NTCV"
          value={summary.ntcv}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
        />
        <KpiCard
          label="Abatement"
          value={summary.abatement}
          icon={<ShieldAlert className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
        />
        <KpiCard
          label="Closure Cases"
          value={summary.closure}
          icon={<Ban className="h-5 w-5" />}
          accent="bg-destructive/10 text-destructive"
        />
      </div>

      {/* Row 1: Target Gap by Province | Monthly Accomplishment Trend (50/50) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Target Gap by Province"
          subtitle="How far each province is from target"
          height="h-72"
        >
          <ResponsiveContainer>
            <BarChart data={targetGapByProvince} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="gap" fill={C.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly Accomplishment Trend"
          subtitle="Target vs Actual per month"
          height="h-72"
        >
          <ResponsiveContainer>
            <LineChart data={byMonth} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
        </ChartCard>
      </div>

      {/* Row 2: Inspections by Application Type (40) | Sector Composition (40) | Top Fire Stations (20) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
        <ChartCard
          title="Inspections by Application Type"
          subtitle="FSEC · FSIC · NTC · NOD · NTCV · Closure"
          className="xl:col-span-2"
          height="h-80"
        >
          <ResponsiveContainer>
            <BarChart data={byApplication} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Actual" fill={C.success} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Sector Composition per Application Type"
          subtitle="Stacked by sector"
          className="xl:col-span-2"
          height="h-80"
        >
          <ResponsiveContainer>
            <BarChart data={sectorByApp} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SECTORS.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="sec"
                  fill={SECTOR_COLORS[s]}
                  radius={i === SECTORS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Top Fire Stations"
          subtitle="Top 10 performing stations"
          className="md:col-span-2 xl:col-span-1"
          height="h-80"
        >
          <ResponsiveContainer>
            <BarChart
              data={byStation}
              layout="vertical"
              margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="name" {...axisProps} width={100} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="actual" fill={C.teal} radius={[0, 4, 4, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Supplementary row: preserved charts (Inspections by Sector, Target vs Actual by Province) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Inspections by Sector" subtitle="BPLO · GOVT · PEZA · TIEZA" height="h-72">
          <ResponsiveContainer>
            <BarChart data={bySector} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Actual" fill={C.primary} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Target vs Actual by Province"
          subtitle="Provincial accomplishment"
          height="h-72"
        >
          <ResponsiveContainer>
            <BarChart data={byProvince} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="target" fill={C.warning} radius={[4, 4, 0, 0]} name="Target" />
              <Bar dataKey="actual" fill={C.primary} radius={[4, 4, 0, 0]} name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: Monthly Trend by Sector (100%) */}
      <ChartCard
        title="Monthly Trend by Sector"
        subtitle="Actual inspections per sector"
        height="h-[420px] xl:h-[500px]"
      >
        <ResponsiveContainer>
          <LineChart data={byMonthSector} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
      </ChartCard>

      {/* Row 4: Year-over-Year Comparison (100%) */}
      <ChartCard
        title="Year-over-Year Comparison"
        subtitle={`${yoY.prevYear} vs ${yoY.currentYear} monthly actuals`}
        height="h-[420px] xl:h-[500px]"
      >
        <ResponsiveContainer>
          <LineChart data={yoY.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey={String(yoY.prevYear)}
              stroke={C.warning}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey={String(yoY.currentYear)}
              stroke={C.primary}
              strokeWidth={3}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Row 5: Recent Dashboard Activity (100%) */}
      <ActivityCard
        title="Recent Dashboard Activity"
        subtitle="Latest FSIS events from stations"
        items={recentActivity}
      />
    </div>
  );
}
