import * as React from "react";
import { Building2, CalendarIcon, Lock, Table2, Target } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth } from "@/lib/complianceHelpers";
import { MONITORING_THEME } from "@/pages/04_compliance/components/complianceTheme";
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type { NoticeCategory, NoticeCategoryCounts } from "@/types/noticeType";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

const MODE_ROWS = [
  { key: "pending" as const, label: "Issuance" },
  { key: "accomplished" as const, label: "Accomplished" },
];

const SERIES = {
  issued: "var(--color-warning)",
  accomplished: "var(--color-primary)",
  pending: "var(--color-destructive)",
  positive: "var(--color-success)",
} as const;

function emptyBreakdown(): Record<NoticeCategory, NoticeCategoryCounts> {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: { pending: 0, accomplished: 0 } }),
    {} as Record<NoticeCategory, NoticeCategoryCounts>,
  );
}

interface DayRow {
  day: number;
  date: string;
  label: string;
  remarks: string;
  breakdown: Record<NoticeCategory, NoticeCategoryCounts>;
}

/* -------------------------------------------------------------------------- */
/*  Presentational helpers                                                     */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  required,
}: {
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
        <span className="truncate">{value || "—"}</span>
      </div>
    </div>
  );
}


function Dot({ color }: { color: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
      style={{ background: color }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Issued vs. Accomplished panel                                              */
/* -------------------------------------------------------------------------- */

function NoticeAccomplishmentPanel({
  days,
  periodLabel,
}: {
  days: DayRow[];
  periodLabel: string;
}) {
  const rows = NOTICE_CATEGORIES.map((category) => {
    const issued = days.reduce((s, d) => s + (d.breakdown[category]?.pending ?? 0), 0);
    const accomplished = days.reduce((s, d) => s + (d.breakdown[category]?.accomplished ?? 0), 0);
    const pending = Math.max(issued - accomplished, 0);
    const positive = Math.max(accomplished - issued, 0);
    const percentage = issued > 0 ? (accomplished / issued) * 100 : 0;
    return { category, issued, accomplished, pending, positive, percentage };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      issued: acc.issued + r.issued,
      accomplished: acc.accomplished + r.accomplished,
      pending: acc.pending + r.pending,
      positive: acc.positive + r.positive,
    }),
    { issued: 0, accomplished: 0, pending: 0, positive: 0 },
  );
  const totalPct = totals.issued > 0 ? (totals.accomplished / totals.issued) * 100 : 0;

  const chartData = rows.map((r) => ({
    name: CATEGORY_LABEL[r.category].toUpperCase(),
    Issuance: r.issued,
    Accomplished: r.accomplished,
  }));

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Target className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Notice Accomplishment vs. Issued</div>
          <div className="text-[11px] text-muted-foreground">{periodLabel}</div>
        </div>
      </div>

      <div className="border-b border-border/50 bg-card/40 p-4">
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" {...axisProps} allowDecimals={false} />
              <YAxis {...axisProps} allowDecimals={false} />
              <RechartsTooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Issuance" fill={SERIES.issued} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Accomplished" fill={SERIES.accomplished} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.issued} />
                Issuance
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.accomplished} />
                Accomplished
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.pending} />
                Pending
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.positive} />
                Positive Listing
              </th>
              <th className="px-4 py-2 text-center">% Accomplishment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.category}
                className={cn("border-t border-border/50", i % 2 === 1 && "bg-muted/20")}
              >
                <td className="px-4 py-2 font-semibold uppercase text-foreground">
                  {CATEGORY_LABEL[r.category]}
                </td>
                <td className="px-4 py-2 text-center tabular-nums" style={{ color: SERIES.issued }}>
                  {r.issued.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center tabular-nums"
                  style={{ color: SERIES.accomplished }}
                >
                  {r.accomplished.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={r.pending > 0 ? { color: SERIES.pending } : undefined}
                >
                  {r.pending.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={r.positive > 0 ? { color: SERIES.positive } : undefined}
                >
                  {r.positive.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={{ color: r.percentage >= 100 ? SERIES.positive : SERIES.accomplished }}
                >
                  {r.percentage.toFixed(2)}%
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-primary/5 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-center tabular-nums" style={{ color: SERIES.issued }}>
                {totals.issued.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={{ color: SERIES.accomplished }}
              >
                {totals.accomplished.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={totals.pending > 0 ? { color: SERIES.pending } : undefined}
              >
                {totals.pending.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={totals.positive > 0 ? { color: SERIES.positive } : undefined}
              >
                {totals.positive.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={{ color: totalPct >= 100 ? SERIES.positive : SERIES.accomplished }}
              >
                {totalPct.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal                                                                      */
/* -------------------------------------------------------------------------- */

interface NoticeViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
}

export function NoticeViewModal({ open, onOpenChange, record }: NoticeViewModalProps) {
  const days = React.useMemo<DayRow[]>(() => {
    if (!record) return [];
    const y = record.reportYear;
    const m = record.reportMonth;
    const byDate = new Map(record.dailyEntries.map((e) => [e.date.slice(0, 10), e]));
    const total = calendarDaysInMonth(y, m);
    return Array.from({ length: total }, (_, i) => {
      const day = i + 1;
      const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const existing = byDate.get(date);
      return {
        day,
        date,
        label: new Date(y, m - 1, day).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        remarks: existing?.remarks ?? "",
        breakdown: existing?.breakdown ?? emptyBreakdown(),
      };
    });
  }, [record]);

  if (!record) return null;

  const month = record.reportMonth;
  const year = record.reportYear;
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;

  const rowTotal = (entry: DayRow) =>
    NOTICE_CATEGORIES.reduce(
      (sum, c) => sum + (entry.breakdown[c].pending ?? 0) + (entry.breakdown[c].accomplished ?? 0),
      0,
    );

  const columnTotal = (category: NoticeCategory) =>
    days.reduce(
      (sum, d) =>
        sum + (d.breakdown[category].pending ?? 0) + (d.breakdown[category].accomplished ?? 0),
      0,
    );

  const grandTotal = days.reduce((sum, d) => sum + rowTotal(d), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] min-h-0 max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Notice Accomplishment Details</DialogTitle>
              <DialogDescription>
                {record.stationname ? `${record.stationname} · ` : ""}
                {monthName} {year}
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                View only — values are displayed as recorded and cannot be modified here.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden bg-muted/20 px-5 py-5">
          {/* Reporting Period ---------------------------------------------- */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <SectionTitle icon={<CalendarIcon className="h-4 w-4" />} title="Reporting Period" />
            <div className="grid grid-cols-1 gap-4 sm:max-w-md">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Reporting Period As Of <span className="text-destructive">*</span>
                </span>
                <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {monthName} {year}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Station Information ------------------------------------------- */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField
                label="Province"
                required
                value={record.provincename || record.province}
              />
              <ReadOnlyField label="Station" required value={record.stationname} />
            </div>
          </Card>


          {/* Issued vs. Accomplished ---------------------------------------- */}
          <NoticeAccomplishmentPanel days={days} periodLabel={`${monthName} ${year}`} />

          {/* Daily Notice Details ------------------------------------------- */}
          <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                title="Daily Notice Details"
                subtitle="Issuance and accomplishment per day"
              />
              <div className="rounded-md border border-border/70 bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {monthName} {year}
              </div>
            </div>

            <div
              className="w-full max-w-full overflow-auto rounded-lg border border-grid shadow-soft"
              style={{ maxHeight: "70vh" }}
            >
              <table className="min-w-max border-separate border-spacing-0 text-[11px] text-foreground">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th
                      rowSpan={2}
                      className={cn(
                        "sticky left-0 top-0 z-40 min-w-[170px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerPrimary,
                      )}
                    >
                      Date
                    </th>
                    <th
                      rowSpan={2}
                      className={cn(
                        "sticky left-[170px] top-0 z-40 min-w-[140px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerPrimary,
                      )}
                    >
                      Mode of Issuance
                    </th>
                    <th
                      colSpan={NOTICE_CATEGORIES.length}
                      className={cn(
                        "border-b border-r px-2 py-2 text-center font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerGroup,
                      )}
                    >
                      Other Notices
                    </th>
                    <th
                      rowSpan={2}
                      className={cn(
                        "min-w-[80px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerPrimary,
                      )}
                    >
                      Total
                    </th>
                    <th
                      rowSpan={2}
                      className={cn(
                        "min-w-[220px] border-b px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerSub,
                      )}
                    >
                      Remarks
                    </th>
                  </tr>
                  <tr>
                    {NOTICE_CATEGORIES.map((category) => (
                      <th
                        key={category}
                        className={cn(
                          "min-w-[86px] border-b border-r px-2 py-1.5 text-center font-semibold uppercase tracking-wider",
                          MONITORING_THEME.headerSoft,
                        )}
                      >
                        {CATEGORY_LABEL[category]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((entry, index) => {
                    const zebra = index % 2 === 1;
                    const cellBg = zebra ? MONITORING_THEME.rowOdd : MONITORING_THEME.rowEven;
                    return (
                      <React.Fragment key={entry.day}>
                        {MODE_ROWS.map((mode, modeIndex) => (
                          <tr key={`${entry.day}-${mode.key}`} className={cellBg}>
                            {modeIndex === 0 && (
                              <td
                                rowSpan={2}
                                className={cn(
                                  "sticky left-0 z-20 min-w-[170px] border-b border-r px-3 py-1.5 align-middle font-medium",
                                  cellBg,
                                )}
                              >
                                <span className="whitespace-nowrap">{entry.label}</span>
                              </td>
                            )}
                            <td
                              className={cn(
                                "sticky left-[170px] z-20 min-w-[140px] border-b border-r px-3 py-1.5 text-center align-middle font-semibold uppercase tracking-wide text-primary",
                                cellBg,
                              )}
                            >
                              {mode.label}
                            </td>
                            {NOTICE_CATEGORIES.map((category) => {
                              const value = entry.breakdown[category][mode.key] ?? 0;
                              return (
                                <td
                                  key={`${entry.day}-${category}-${mode.key}`}
                                  className="border-b border-r px-1.5 py-1.5 text-center tabular-nums"
                                >
                                  {value.toLocaleString()}
                                </td>
                              );
                            })}
                            {modeIndex === 0 && (
                              <>
                                <td
                                  rowSpan={2}
                                  className="border-b border-r px-3 py-1.5 text-center align-middle font-bold tabular-nums"
                                >
                                  {rowTotal(entry).toLocaleString()}
                                </td>
                                <td
                                  rowSpan={2}
                                  className="border-b px-2 py-1.5 align-middle text-muted-foreground"
                                >
                                  {entry.remarks || "—"}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="sticky bottom-0 z-20">
                  <tr className="total-row font-bold text-foreground">
                    <td className="sticky left-0 z-30 total-row border-r border-t-2 border-grid-strong px-3 py-2 text-left uppercase tracking-wide">
                      Total
                    </td>
                    <td className="sticky left-[170px] z-30 total-row border-r border-t-2 border-grid-strong px-3 py-2" />
                    {NOTICE_CATEGORIES.map((category) => (
                      <td
                        key={`total-${category}`}
                        className="total-row border-r border-t-2 border-grid-strong px-2 py-2 text-center tabular-nums"
                      >
                        {columnTotal(category).toLocaleString()}
                      </td>
                    ))}
                    <td className="total-row-strong border-r border-t-2 border-grid-strong px-3 py-2 text-center tabular-nums">
                      {grandTotal.toLocaleString()}
                    </td>
                    <td className="total-row border-t-2 border-grid-strong px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeViewModal;
