import * as React from "react";
import {
  AlertCircle,
  Building2,
  Loader2,
  Lock,
  Save,
  Table2,
  Target,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth } from "@/lib/complianceHelpers";
import { noticeAPI } from "@/services/noticeAPI";
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

/** Mode of issuance rows rendered per day. */
const MODE_ROWS = [
  { key: "pending" as const, label: "Issuance" },
  { key: "accomplished" as const, label: "Accomplished" },
];

const YEAR_OPTIONS: number[] = (() => {
  const current = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => current - 4 + i);
})();

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

/**
 * PST lock activation — mirrors the compliance editor.
 * A month locks on day 4 of the following calendar month at 00:00 PST.
 */
function hasPstLockActivated(year: number, month: number, now: Date = new Date()): boolean {
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const lockActivationMs = Date.UTC(year, month, 4, 0, 0, 0);
  return manilaNowMs >= lockActivationMs;
}

interface DayRow {
  day: number;
  date: string;
  label: string;
  remarks: string;
  isLocked: boolean;
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
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

interface NoticeEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
  onSaved: () => void;
}

export function NoticeEditModal({ open, onOpenChange, record, onSaved }: NoticeEditModalProps) {
  const { user } = useAuth();
  const [month, setMonth] = React.useState(1);
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [days, setDays] = React.useState<DayRow[]>([]);
  const [generalRemarks, setGeneralRemarks] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const buildDays = React.useCallback(
    (src: NoticeRecord, y: number, m: number): DayRow[] => {
      const monthLocked = hasPstLockActivated(y, m);
      const byDate = new Map(src.dailyEntries.map((e) => [e.date.slice(0, 10), e]));
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
          isLocked: monthLocked,
          breakdown: existing?.breakdown ?? emptyBreakdown(),
        };
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!record || !open) return;
    setMonth(record.reportMonth);
    setYear(record.reportYear);
    setDays(buildDays(record, record.reportYear, record.reportMonth));
    setGeneralRemarks("");
    setSaveError(null);
  }, [record, open, buildDays]);

  const changePeriod = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
    if (record) setDays(buildDays(record, nextYear, nextMonth));
  };

  if (!record) return null;

  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;
  const allLocked = days.length > 0 && days.every((d) => d.isLocked);

  const updateField = (
    day: number,
    category: NoticeCategory,
    field: keyof NoticeCategoryCounts,
    raw: string,
  ) => {
    const cleaned = raw.replace(/[^0-9]/g, "");
    const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
    setDays((prev) =>
      prev.map((entry) =>
        entry.day === day
          ? {
              ...entry,
              breakdown: {
                ...entry.breakdown,
                [category]: { ...entry.breakdown[category], [field]: value },
              },
            }
          : entry,
      ),
    );
  };

  const updateRemarks = (day: number, value: string) => {
    setDays((prev) =>
      prev.map((entry) => (entry.day === day ? { ...entry, remarks: value } : entry)),
    );
  };

  const rowTotal = (entry: DayRow) =>
    NOTICE_CATEGORIES.reduce(
      (sum, c) => sum + (entry.breakdown[c].pending ?? 0) + (entry.breakdown[c].accomplished ?? 0),
      0,
    );

  const columnTotal = (category: NoticeCategory) =>
    days.reduce(
      (sum, d) => sum + (d.breakdown[category].pending ?? 0) + (d.breakdown[category].accomplished ?? 0),
      0,
    );

  const grandTotal = days.reduce((sum, d) => sum + rowTotal(d), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        noticeno: EMPTY_GUID,
        stationno: record.stationno,
        dateaccomplish: `${days[0]?.date ?? `${year}-${String(month).padStart(2, "0")}-01`}T00:00:00`,
        encodedby: user?.memberno ?? "",
        accomnoticeList: days.map((entry) => ({
          accomplishno: EMPTY_GUID,
          noticeno: EMPTY_GUID,
          fsicmode: 0,
          nodcount: entry.breakdown.NOD.pending,
          ntccount: entry.breakdown.NTC.pending,
          ntcvcount: entry.breakdown.NTCV.pending,
          abatementcount: entry.breakdown.Abatement.pending,
          closurecount: entry.breakdown.Closure.pending,
        })),
      };
      const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        setSaveError(error || "Unable to update notice entry.");
        toast.error(error || "Unable to update notice entry.");
        return;
      }
      toast.success("Notice entry updated.");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] min-h-0 max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Notice Accomplishment Editor
              </DialogTitle>
              <DialogDescription>
                {record.stationname ? `${record.stationname} · ` : ""}
                {monthName} {year}
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                Each month locks on the{" "}
                <span className="font-semibold">4th day of the following month at 12:00 AM (PST)</span>.
                The current and next month remain editable — past months require a revision request
                once locked.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden bg-muted/20 px-5 py-5"
        >
          {/* Station Information ------------------------------------------- */}
          <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ReadOnlyField label="Station" value={record.stationname} />
              <ReadOnlyField label="Province" value={record.provincename || record.province} />
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Reporting Month</span>
                <Select value={String(month)} onValueChange={(v) => changePeriod(Number(v), year)}>
                  <SelectTrigger className="h-10 w-full">
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
                <span className="text-xs font-medium text-muted-foreground">Reporting Year</span>
                <Select value={String(year)} onValueChange={(v) => changePeriod(month, Number(v))}>
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                        "sticky left-0 top-0 z-40 min-w-[96px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerPrimary,
                      )}
                    >
                      Action
                    </th>
                    <th
                      rowSpan={2}
                      className={cn(
                        "sticky left-[96px] top-0 z-40 min-w-[170px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
                        MONITORING_THEME.headerPrimary,
                      )}
                    >
                      Date
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
                              <>
                                <td
                                  rowSpan={2}
                                  className={cn(
                                    "sticky left-0 z-20 border-b border-r px-3 py-1.5 text-center align-middle",
                                    cellBg,
                                  )}
                                >
                                  {entry.isLocked ? (
                                    <Lock
                                      className="mx-auto h-3.5 w-3.5 text-warning"
                                      aria-label="Locked day"
                                    />
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td
                                  rowSpan={2}
                                  className={cn(
                                    "sticky left-[96px] z-20 border-b border-r px-3 py-1.5 align-middle font-medium",
                                    cellBg,
                                  )}
                                >
                                  {entry.label}
                                </td>
                              </>
                            )}
                            {NOTICE_CATEGORIES.map((category) => {
                              const value = entry.breakdown[category][mode.key] ?? 0;
                              return (
                                <td
                                  key={`${entry.day}-${category}-${mode.key}`}
                                  className="border-b border-r px-1.5 py-1.5 text-center"
                                >
                                  {entry.isLocked ? (
                                    <span className="text-muted-foreground tabular-nums">
                                      {value.toLocaleString()}
                                    </span>
                                  ) : (
                                    <Input
                                      type="number"
                                      min={0}
                                      step={1}
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      aria-label={`${CATEGORY_LABEL[category]} ${mode.label} for ${entry.label}`}
                                      value={String(value)}
                                      onKeyDown={(e) => {
                                        if (["-", "+", "e", "E", "."].includes(e.key))
                                          e.preventDefault();
                                      }}
                                      onChange={(e) =>
                                        updateField(entry.day, category, mode.key, e.target.value)
                                      }
                                      className="h-8 w-full rounded-sm border-border/70 px-2 py-1 text-center tabular-nums"
                                    />
                                  )}
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
                                <td rowSpan={2} className="border-b px-2 py-1.5 align-middle">
                                  {entry.isLocked ? (
                                    <span className="text-muted-foreground">
                                      {entry.remarks || "—"}
                                    </span>
                                  ) : (
                                    <Input
                                      value={entry.remarks}
                                      placeholder="Remarks"
                                      aria-label={`Remarks for ${entry.label}`}
                                      onChange={(e) => updateRemarks(entry.day, e.target.value)}
                                      className="h-8 w-full rounded-sm border-border/70 px-2 py-1"
                                    />
                                  )}
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
                    <td className="sticky left-0 z-30 total-row border-r border-t-2 border-grid-strong px-3 py-2" />
                    <td className="sticky left-[96px] z-30 total-row border-r border-t-2 border-grid-strong px-3 py-2 text-left uppercase tracking-wide">
                      Total
                    </td>
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

            <div className="space-y-2 border-t border-border/60 pt-5">
              <label className="text-xs font-medium text-muted-foreground">
                General Remarks (applies to all days)
              </label>
              <Textarea
                rows={3}
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value.slice(0, 1000))}
                placeholder="Additional notes…"
                className="mt-2"
                disabled={allLocked}
              />
            </div>
          </Card>

          {saveError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">Unable to save changes</div>
                <div className="text-xs opacity-90">{saveError}</div>
              </div>
            </div>
          )}

          {allLocked && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 tone-warning-soft px-3 py-2 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">This reporting month is locked</div>
                <p className="mt-1">A revision request is required to edit these records.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || allLocked}
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving changes…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeEditModal;
