import * as React from "react";
import {
  Building2,
  CalendarIcon,
  ChevronsDown,
  ChevronsUp,
  Lock,
  Pencil,
  RotateCcw,
  Table2,
  Target,
  X,
} from "lucide-react";
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
import StationInfoCard from "@/components/station-info-card";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

import { cn, buildYears } from "@/lib/utils";
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
  { key: "manual" as const, label: "Manual" },
  { key: "fsis" as const, label: "FSIS" },
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

type ModeCounts = Record<NoticeCategory, number>;

function emptyMode(): ModeCounts {
  return NOTICE_CATEGORIES.reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as ModeCounts);
}

interface DayRow {
  day: number;
  date: string;
  label: string;
  remarks: string;
  breakdown: Record<NoticeCategory, NoticeCategoryCounts>;
  modes: { manual: ModeCounts; fsis: ModeCounts };
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

function NoticeAccomplishmentPanel({ days, periodLabel }: { days: DayRow[]; periodLabel: string }) {
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
          <div className="text-sm font-semibold">Accomplished Notices vs. Issued</div>
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
  /** Opens the edit modal for the period currently shown in this view. */
  onEdit?: (year: number, month: number) => void;
}

const YEAR_OPTIONS = buildYears();

export function NoticeViewModal({ open, onOpenChange, record, onEdit }: NoticeViewModalProps) {
  const [viewMonth, setViewMonth] = React.useState<number>(record?.reportMonth ?? 1);
  const [viewYear, setViewYear] = React.useState<number>(record?.reportYear ?? new Date().getFullYear());

  // Reset to the record's period whenever a new record is opened.
  React.useEffect(() => {
    if (record) {
      setViewMonth(record.reportMonth);
      setViewYear(record.reportYear);
    }
  }, [record?.key]);

  const days = React.useMemo<DayRow[]>(() => {
    if (!record) return [];
    const y = viewYear;
    const m = viewMonth;
    const periodPrefix = `${y}-${String(m).padStart(2, "0")}`;
    const scopedEntries = record.dailyEntries.filter((e) => e.date.startsWith(periodPrefix));
    const byDate = new Map(scopedEntries.map((e) => [e.date.slice(0, 10), e]));
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
        modes: existing?.modes ?? { manual: emptyMode(), fsis: emptyMode() },
      };
    });
  }, [record, viewMonth, viewYear]);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = React.useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollHeight - el.clientHeight > 40);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, record?.key, viewMonth, viewYear, days.length]);

  const scrollTo = (dir: "top" | "bottom") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: dir === "top" ? 0 : el.scrollHeight, behavior: "smooth" });
  };

  if (!record) return null;

  const month = viewMonth;
  const year = viewYear;
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? String(month);
  const isPeriodChanged = month !== record.reportMonth || year !== record.reportYear;

  const rowTotal = (entry: DayRow) =>
    NOTICE_CATEGORIES.reduce(
      (sum, c) => sum + (entry.modes.manual[c] ?? 0) + (entry.modes.fsis[c] ?? 0),
      0,
    );

  const columnTotal = (category: NoticeCategory) =>
    days.reduce(
      (sum, d) => sum + (d.modes.manual[category] ?? 0) + (d.modes.fsis[category] ?? 0),
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
              <DialogTitle className="text-base font-bold">
                Accomplished Notices Details
              </DialogTitle>
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

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-5 py-5"
        >
          {/* Reporting Period ---------------------------------------------- */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle icon={<CalendarIcon className="h-4 w-4" />} title="Reporting Period" />
              {isPeriodChanged && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setViewMonth(record.reportMonth);
                    setViewYear(record.reportYear);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to {MONTHS.find((mo) => mo.value === record.reportMonth)?.name} {record.reportYear}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Month</span>
                <Select
                  value={String(viewMonth)}
                  onValueChange={(value) => setViewMonth(Number(value))}
                >
                  <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((mo) => (
                      <SelectItem key={mo.value} value={String(mo.value)}>
                        {mo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Year</span>
                <Select
                  value={String(viewYear)}
                  onValueChange={(value) => setViewYear(Number(value))}
                >
                  <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Station Information ------------------------------------------- */}
          <StationInfoCard
            stationName={record.stationname || ""}
            unitCode={record.stationcode || ""}
            logoUrl={record.logourl || null}
            fields={[
              { label: "Station Code", value: record.stationcode ?? "" },
              { label: "City / Municipality", value: record.cityname ?? "" },
              { label: "Province", value: record.provincename || record.province || "" },
            ]}
          />

          {/* Issued vs. Accomplished ---------------------------------------- */}
          <NoticeAccomplishmentPanel days={days} periodLabel={`${monthName} ${year}`} />

          {/* Daily Accomplished Notices Details ------------------------------------------- */}
          <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                title="Daily Accomplished Notices Details"
                subtitle="Accomplished Notices per day"
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
                      Other Accomplished Notices
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
                              const value = entry.modes[mode.key][category] ?? 0;
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
        </div>

          {canScroll && (
            <div className="pointer-events-none absolute bottom-3 right-4 flex flex-col gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Scroll to top"
                onClick={() => scrollTo("top")}
                className="pointer-events-auto h-8 w-8 rounded-full border border-border/60 shadow-soft"
              >
                <ChevronsUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Scroll to bottom"
                onClick={() => scrollTo("bottom")}
                className="pointer-events-auto h-8 w-8 rounded-full border border-border/60 shadow-soft"
              >
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>


        <DialogFooter className="border-t bg-background px-5 py-3">
          {onEdit && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onEdit(year, month);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeViewModal;
