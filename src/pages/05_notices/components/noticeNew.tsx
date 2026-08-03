import * as React from "react";
import { format } from "date-fns";
import { Building2, CalendarIcon, FilePlus2, Loader2, Save, Target } from "lucide-react";
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
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { noticeAPI } from "@/services/noticeAPI";
import { MONITORING_THEME } from "@/pages/04_compliance/components/complianceTheme";
import type { NoticeRecord } from "@/pages/05_notices/Notice";

/* -------------------------------------------------------------------------- */
/*  Mode of Issuance — 96 = MANUAL, 97 = FSIS                                 */
/* -------------------------------------------------------------------------- */

const FSIC_MODE = { MANUAL: 96, FSIS: 97 } as const;

interface NoticeFieldSpec {
  key: "nodcount" | "ntccount" | "ntcvcount" | "abatementcount" | "closurecount";
  label: string;
}

const NOTICE_FIELDS: NoticeFieldSpec[] = [
  { key: "nodcount", label: "NOD" },
  { key: "ntccount", label: "NTC" },
  { key: "ntcvcount", label: "NTCV" },
  { key: "abatementcount", label: "Abatement" },
  { key: "closurecount", label: "Closure" },
];

type NoticeCounts = Record<NoticeFieldSpec["key"], number>;

function emptyCounts(): NoticeCounts {
  return NOTICE_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: 0 }), {} as NoticeCounts);
}

/* -------------------------------------------------------------------------- */
/*  Small presentational helpers                                              */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Notices matrix — MANUAL / FSIS rows across the five notice categories     */
/* -------------------------------------------------------------------------- */

function NoticesTable({
  manualValues,
  fsisValues,
  setManualValues,
  setFsisValues,
}: {
  manualValues: NoticeCounts;
  fsisValues: NoticeCounts;
  setManualValues: React.Dispatch<React.SetStateAction<NoticeCounts>>;
  setFsisValues: React.Dispatch<React.SetStateAction<NoticeCounts>>;
}) {
  const makeHandler =
    (setter: React.Dispatch<React.SetStateAction<NoticeCounts>>) =>
    (key: NoticeFieldSpec["key"], raw: string) => {
      const cleaned = raw.replace(/[^0-9]/g, "");
      const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
      setter((prev) => ({ ...prev, [key]: value }));
    };

  const onManualChange = makeHandler(setManualValues);
  const onFsisChange = makeHandler(setFsisValues);

  const colTotal = (key: NoticeFieldSpec["key"]) =>
    (manualValues[key] ?? 0) + (fsisValues[key] ?? 0);

  const renderRow = (
    rowLabel: string,
    values: NoticeCounts,
    onChange: (key: NoticeFieldSpec["key"], raw: string) => void,
    zebra: boolean,
  ) => (
    <tr className={zebra ? "bg-card" : "bg-muted"}>
      <td
        className={cn(
          "sticky left-0 z-20 border-b border-r px-3 py-1.5 text-center font-semibold uppercase tracking-wider",
          zebra ? "bg-card" : "bg-muted",
        )}
      >
        {rowLabel}
      </td>
      {NOTICE_FIELDS.map((f) => (
        <td key={f.key} className="border-b border-r px-1.5 py-1.5 text-center">
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(values[f.key] ?? 0)}
            onChange={(e) => onChange(f.key, e.target.value)}
            onKeyDown={(e) => {
              if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
            }}
            className="h-8 w-full min-w-[110px] rounded-sm border-border/70 px-2 py-1 text-center tabular-nums"
          />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="w-full max-w-full overflow-hidden rounded-lg border border-border/60 shadow-soft">
      <div className="overflow-auto">
        <table className="min-w-max border-separate border-spacing-0 text-[11px]">
          <thead className="sticky top-0 z-30">
            <tr>
              <th
                rowSpan={2}
                className={cn(
                  "sticky left-0 top-0 z-40 min-w-[110px] border-b border-r px-3 py-2 text-center align-middle uppercase tracking-wider",
                  MONITORING_THEME.headerPrimary,
                )}
              >
                Mode
              </th>
              <th
                colSpan={NOTICE_FIELDS.length}
                className={cn(
                  "border-b border-r px-2 py-2 text-center uppercase tracking-wider",
                  MONITORING_THEME.headerGroup,
                )}
              >
                Accomplished Notices
              </th>
            </tr>
            <tr>
              {NOTICE_FIELDS.map((f) => (
                <th
                  key={f.key}
                  className={cn(
                    "border-b border-r px-2 py-1.5 text-center uppercase tracking-wider",
                    MONITORING_THEME.headerSoft,
                  )}
                >
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRow("Manual", manualValues, onManualChange, true)}
            {renderRow("FSIS", fsisValues, onFsisChange, false)}
            <tr className={MONITORING_THEME.totalRow}>
              <td
                className={cn(
                  "sticky left-0 z-20 border-r px-3 py-2 text-center font-bold uppercase tracking-wider",
                  MONITORING_THEME.totalRow,
                )}
              >
                Total
              </td>
              {NOTICE_FIELDS.map((f) => (
                <td
                  key={f.key}
                  className="border-r px-3 py-2 text-center font-bold tabular-nums"
                >
                  {colTotal(f.key).toLocaleString()}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Issuance vs. Accomplished panel — chart + per-category computation        */
/* -------------------------------------------------------------------------- */

const SERIES = {
  issued: "var(--color-warning)",
  accomplished: "var(--color-primary)",
  pending: "var(--color-destructive)",
  positive: "var(--color-success)",
} as const;

function Dot({ color }: { color: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
      style={{ background: color }}
    />
  );
}

function NoticeAccomplishmentPanel({
  issued,
  accomplished,
  periodLabel,
}: {
  issued: NoticeCounts;
  accomplished: NoticeCounts;
  periodLabel: string;
}) {
  const rows = NOTICE_FIELDS.map((f) => {
    const issuedCount = issued[f.key] ?? 0;
    const done = accomplished[f.key] ?? 0;
    const pending = Math.max(issuedCount - done, 0);
    const positive = Math.max(done - issuedCount, 0);
    const percentage = issuedCount > 0 ? (done / issuedCount) * 100 : 0;
    return { ...f, issued: issuedCount, accomplished: done, pending, positive, percentage };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.issued += r.issued;
      acc.accomplished += r.accomplished;
      acc.pending += r.pending;
      acc.positive += r.positive;
      return acc;
    },
    { issued: 0, accomplished: 0, pending: 0, positive: 0 },
  );
  const totalPct = totals.issued > 0 ? (totals.accomplished / totals.issued) * 100 : 0;

  const chartData = rows.map((r) => ({
    name: r.label.toUpperCase(),
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
                <Dot color={SERIES.issued} />Issuance
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.accomplished} />Accomplished
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.pending} />Pending
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.positive} />Positive Listing
              </th>
              <th className="px-4 py-2 text-center">% Accomplishment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className={cn("border-t border-border/50", i % 2 === 1 && "bg-muted/20")}>
                <td className="px-4 py-2 font-semibold uppercase text-foreground">{r.label}</td>
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
                  style={{
                    color: r.percentage >= 100 ? SERIES.positive : SERIES.accomplished,
                  }}
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
/*  Modal                                                                     */
/* -------------------------------------------------------------------------- */

interface NoticeAddModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
  onSaved: () => void;
}

export function NoticeAddModal({ open, onOpenChange, record, onSaved }: NoticeAddModalProps) {
  const { user } = useAuth();
  const [reportingDate, setReportingDate] = React.useState<Date>(new Date());
  const [dateOpen, setDateOpen] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const [manualValues, setManualValues] = React.useState<NoticeCounts>(emptyCounts());
  const [fsisValues, setFsisValues] = React.useState<NoticeCounts>(emptyCounts());
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!record || !open) return;
    const first = record.dailyEntries[0]?.date;
    const fallback = new Date(record.reportYear, Math.max(0, record.reportMonth - 1), 1);
    setReportingDate(first ? new Date(`${first}T00:00:00`) : fallback);
    setRemarks("");
    setManualValues(emptyCounts());
    setFsisValues(emptyCounts());
  }, [record, open]);

  if (!record) return null;

  // Issuance = live MANUAL + FSIS entries; Accomplished = station ledger totals.
  const issuedTotals = NOTICE_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f.key]: (manualValues[f.key] ?? 0) + (fsisValues[f.key] ?? 0) }),
    {} as NoticeCounts,
  );
  const accomplishedTotals: NoticeCounts = {
    nodcount: record.breakdown.NOD?.accomplished ?? 0,
    ntccount: record.breakdown.NTC?.accomplished ?? 0,
    ntcvcount: record.breakdown.NTCV?.accomplished ?? 0,
    abatementcount: record.breakdown.Abatement?.accomplished ?? 0,
    closurecount: record.breakdown.Closure?.accomplished ?? 0,
  };


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!record.stationno || record.stationno === EMPTY_GUID) {
      toast.error("A station is required before saving.");
      return;
    }
    setSaving(true);
    try {
      const buildAccom = (mode: number, values: NoticeCounts) => ({
        accomplishno: EMPTY_GUID,
        noticeno: EMPTY_GUID,
        fsicmode: mode,
        nodcount: values.nodcount,
        ntccount: values.ntccount,
        ntcvcount: values.ntcvcount,
        abatementcount: values.abatementcount,
        closurecount: values.closurecount,
      });

      const payload = {
        noticeno: EMPTY_GUID,
        stationno: record.stationno,
        dateaccomplish: `${format(reportingDate, "yyyy-MM-dd")}T00:00:00`,
        encodedby: user?.memberno ?? "",
        remarks,
        accomnoticeList: [
          buildAccom(FSIC_MODE.MANUAL, manualValues),
          buildAccom(FSIC_MODE.FSIS, fsisValues),
        ],
      };

      const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save notice entry.");
        return;
      }
      toast.success("Notice accomplishment saved.");
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FilePlus2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold">Notice Accomplishment Entry</DialogTitle>
              <DialogDescription className="text-sm">
                Select a reporting period and station, then encode the notices accomplished (complied/closed) for the day.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="max-h-[calc(90vh-6rem)] space-y-6 overflow-y-auto bg-muted/20 px-5 py-5"
        >
          {/* 1. Reporting Period --------------------------------------------- */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
            <SectionTitle icon={<CalendarIcon className="h-4 w-4" />} title="Reporting Period" />
            <div className="grid grid-cols-1 gap-4 sm:max-w-md">
              <Field label="Reporting Period As Of" required>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportingDate ? format(reportingDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={reportingDate}
                      defaultMonth={reportingDate}
                      onSelect={(d) => {
                        if (d) {
                          setReportingDate(d);
                          setDateOpen(false);
                        }
                      }}
                      initialFocus
                      className="pointer-events-auto p-3"
                    />
                  </PopoverContent>
                </Popover>
              </Field>
            </div>
          </Card>

          {/* 2. Station Information ------------------------------------------ */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
            <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Province" required>
                <Input readOnly value={record.provincename || record.province || ""} />
              </Field>
              <Field label="Station" required>
                <Input readOnly value={record.stationname || ""} />
              </Field>
            </div>
          </Card>

          {/* 3. Issued vs. Accomplished -------------------------------------- */}
          <NoticeAccomplishmentPanel
            issued={issuedTotals}
            accomplished={accomplishedTotals}
            periodLabel={format(reportingDate, "PPP")}
          />

          {/* 4. Daily Notice Accomplishments --------------------------------- */}

          <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
            <SectionTitle
              title="Daily Notice Accomplishments"
              subtitle="Encode accomplished notices separately for MANUAL and FSIS"
            />

            <NoticesTable
              manualValues={manualValues}
              fsisValues={fsisValues}
              setManualValues={setManualValues}
              setFsisValues={setFsisValues}
            />

            <Field label="Accomplishment Remarks">
              <Textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value.slice(0, 1000))}
                placeholder="Notes on the notices accomplished (compliance, closure, abatement) for this period…"
              />
            </Field>
          </Card>

          {/* Actions ---------------------------------------------------------- */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-primary text-primary-foreground shadow-elegant"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Saving…" : "Save Accomplishment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeAddModal;
