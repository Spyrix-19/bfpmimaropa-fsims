import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import * as React from "react";
import {
  AlertCircle,
  Ban,
  Building2,
  CalendarIcon,
  FilePen,
  Loader2,
  Lock,
  Save,
  Table2,
  Target,
  Trash2,
  RotateCcw,
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

import { cn, buildYears } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth } from "@/lib/complianceHelpers";
import { noticeAPI } from "@/services/noticeAPI";
import { MONITORING_THEME } from "@/pages/04_compliance/components/complianceTheme";
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type { NoticeCategory, NoticeDetailModel } from "@/types/noticeType";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import type { RevisionStatus } from "@/pages/06_target-reference/revision/types";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

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

/** Mode of issuance rows rendered per day (96 = MANUAL, 97 = FSIS). */
const MODE_MANUAL = 96;
const MODE_FSIS = 97;

type ModeKey = "manual" | "fsis";

const MODE_ROWS: { key: ModeKey; label: string; code: number }[] = [
  { key: "manual", label: "MANUAL", code: MODE_MANUAL },
  { key: "fsis", label: "FSIS", code: MODE_FSIS },
];

/** Category → API count field. */
const CATEGORY_COUNT_KEY: Record<NoticeCategory, string> = {
  NOD: "nodcount",
  NTC: "ntccount",
  NTCV: "ntcvcount",
  Abatement: "abatementcount",
  Closure: "closurecount",
};

type ModeCounts = Record<NoticeCategory, number>;

function emptyModeCounts(): ModeCounts {
  return NOTICE_CATEGORIES.reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as ModeCounts);
}

function emptyModes(): Record<ModeKey, ModeCounts> {
  return { manual: emptyModeCounts(), fsis: emptyModeCounts() };
}

/** One day of encoded notice data, keyed by its accomplishment date. */
interface DaySource {
  modes: Record<ModeKey, ModeCounts>;
  remarks: string;
  editablestatus: number;
  isrevisionrequest: boolean;
}

/**
 * Bind the station detail payload into a `date → MANUAL/FSIS counts` map so
 * every row is plotted on its own accomplishment date.
 */
function parseDetailToDays(detail: NoticeDetailModel | null | undefined): Map<string, DaySource> {
  const map = new Map<string, DaySource>();
  const list = Array.isArray(detail?.noticedetallist) ? detail!.noticedetallist : [];
  for (const entry of list) {
    const iso = String(entry?.dateaccomplish ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;
    const current =
      map.get(iso) ??
      ({
        modes: emptyModes(),
        remarks: "",
        editablestatus: 0,
        isrevisionrequest: false,
      } satisfies DaySource);
    current.editablestatus = Number(entry?.editablestatus ?? current.editablestatus) || 0;
    current.isrevisionrequest = Boolean(entry?.isrevisionrequest) || current.isrevisionrequest;
    for (const accom of Array.isArray(entry?.noticeaccomlist) ? entry.noticeaccomlist : []) {
      const key: ModeKey = Number(accom?.fsicmode) === MODE_FSIS ? "fsis" : "manual";
      for (const category of NOTICE_CATEGORIES) {
        const raw = (accom as unknown as Record<string, unknown>)[CATEGORY_COUNT_KEY[category]];
        current.modes[key][category] += Number(raw ?? 0) || 0;
      }
    }
    map.set(iso, current);
  }
  return map;
}

const YEAR_OPTIONS: number[] = buildYears();

const SERIES = {
  issued: "var(--color-warning)",
  accomplished: "var(--color-primary)",
  pending: "var(--color-destructive)",
  positive: "var(--color-success)",
} as const;

/**
 * PST lock activation — mirrors the compliance editor.
 * A month locks on day 4 of the following calendar month at 00:00 PST.
 */
function hasPstLockActivated(year: number, month: number, now: Date = new Date()): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const lockActivationMs = Date.UTC(year, month, 4, 0, 0, 0);
  return manilaNowMs >= lockActivationMs;
}

/** Check if a given date (YYYY-MM-DD) has already passed. */
function isDayPassed(dateStr: string): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return false;
    const day = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day.getTime() < today.getTime();
  } catch {
    return false;
  }
}

interface DayRow {
  day: number;
  date: string;
  label: string;
  remarks: string;
  isLocked: boolean;
  /** 153 = approved revision → day temporarily unlocked. */
  editablestatus: number;
  isrevisionrequest: boolean;
  /** MANUAL (96) / FSIS (97) counts encoded on this date. */
  modes: Record<ModeKey, ModeCounts>;
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
  issuedByCategory,
  periodLabel,
}: {
  days: DayRow[];
  issuedByCategory: ModeCounts;
  periodLabel: string;
}) {
  const rows = NOTICE_CATEGORIES.map((category) => {
    const issued = issuedByCategory[category] ?? 0;
    const accomplished = days.reduce(
      (s, d) => s + (d.modes.manual[category] ?? 0) + (d.modes.fsis[category] ?? 0),
      0,
    );
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
          <div className="text-sm font-semibold">Complied Notices vs. Issued</div>
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
  const { user, systemAccess } = useAuth();
  const [month, setMonth] = React.useState(1);
  const [year, setYear] = React.useState(new Date().getFullYear());
  const [days, setDays] = React.useState<DayRow[]>([]);
  /** date → signature of the loaded values, used to send only changed rows. */
  const [baselineRows, setBaselineRows] = React.useState<Map<string, string>>(new Map());
  const [generalRemarks, setGeneralRemarks] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  /* --------------------------- Revision requests -------------------------- */
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [revisionReferenceKey, setRevisionReferenceKey] = React.useState(EMPTY_GUID);
  const [revisionDate, setRevisionDate] = React.useState<string>("");
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const [revisionRefreshTick, setRevisionRefreshTick] = React.useState(0);
  const [revisionRequests, setRevisionRequests] = React.useState<
    {
      requestno: string;
      statuscode?: string;
      statusname?: string;
      referencekey?: string;
      dateinspected?: string;
    }[]
  >([]);

  /** Seed from the ledger row so the grid renders instantly, per date. */
  const seedFromRecord = React.useCallback((src: NoticeRecord): Map<string, DaySource> => {
    const map = new Map<string, DaySource>();
    for (const entry of src.dailyEntries) {
      const iso = String(entry.date ?? "").slice(0, 10);
      if (!iso) continue;
      map.set(iso, {
        modes: {
          manual: { ...emptyModeCounts(), ...(entry.modes?.manual ?? {}) },
          fsis: { ...emptyModeCounts(), ...(entry.modes?.fsis ?? {}) },
        },
        remarks: entry.remarks ?? "",
        editablestatus: Number((entry as any)?.editablestatus ?? 0) || 0,
        isrevisionrequest: Boolean((entry as any)?.isrevisionrequest),
      });
    }
    return map;
  }, []);

  /** Stable signature of a row's editable values (counts + remarks). */
  const rowSignature = React.useCallback(
    (entry: DayRow) =>
      JSON.stringify([
        NOTICE_CATEGORIES.map((c) => Number(entry.modes.manual[c] ?? 0)),
        NOTICE_CATEGORIES.map((c) => Number(entry.modes.fsis[c] ?? 0)),
        String(entry.remarks ?? "").trim(),
      ]),
    [],
  );

  const captureBaseline = React.useCallback(
    (rows: DayRow[]) => new Map(rows.map((r) => [r.date, rowSignature(r)] as const)),
    [rowSignature],
  );

  const buildDays = React.useCallback(
    (source: Map<string, DaySource>, y: number, m: number): DayRow[] => {
      const monthLocked = hasPstLockActivated(y, m);
      const total = calendarDaysInMonth(y, m);
      return Array.from({ length: total }, (_, i) => {
        const day = i + 1;
        const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const existing = source.get(date);
        const editablestatus = Number(existing?.editablestatus ?? 0);
        return {
          day,
          date,
          label: new Date(y, m - 1, day).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          remarks: existing?.remarks ?? "",
          isLocked: editablestatus === 153 ? false : monthLocked || isDayPassed(date),
          editablestatus,
          isrevisionrequest: Boolean(existing?.isrevisionrequest),
          modes: existing?.modes ?? emptyModes(),
        } satisfies DayRow;
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!record || !open) return;
    setMonth(record.reportMonth);
    setYear(record.reportYear);
    const seeded = buildDays(seedFromRecord(record), record.reportYear, record.reportMonth);
    setDays(seeded);
    setBaselineRows(captureBaseline(seeded));
    setGeneralRemarks("");
    setSaveError(null);
  }, [record, open, buildDays, seedFromRecord, captureBaseline]);

  const stationno = record?.stationno ?? "";
  const provinceno = record?.provinceno ?? "";

  /**
   * Authoritative per-station month detail — guarantees every encoded MANUAL /
   * FSIS row lands on its own accomplishment date, even when the ledger list
   * was filtered to a single day.
   */
  React.useEffect(() => {
    if (!open || !stationno || !year || !month) return;
    let cancelled = false;
    (async () => {
      const resp = await noticeAPI.getDetail(
        { stationno, reportyear: Number(year), reportmonth: Number(month) },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<NoticeDetailModel | NoticeDetailModel[]>(resp);
      if (!ok || !data) return;
      const detail = Array.isArray(data)
        ? (data.find((d) => d?.stationno === stationno) ?? data[0] ?? null)
        : data;
      const loaded = buildDays(parseDetailToDays(detail), year, month);
      setDays(loaded);
      setBaselineRows(captureBaseline(loaded));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, stationno, year, month, buildDays, captureBaseline]);

  React.useEffect(() => {
    if (!open || !stationno || !year || !month) {
      setRevisionRequests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno,
          reportyear: Number(year),
          reportmonth: Number(month),
          provinceno: provinceno || EMPTY_GUID,
          requesttype: "NOTICE",
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<
        {
          requestno: string;
          statuscode?: string;
          statusname?: string;
          referencekey?: string;
          dateinspected?: string;
        }[]
      >(resp);
      setRevisionRequests(ok && Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, stationno, provinceno, year, month, revisionRefreshTick]);

  /** Latest revision request matched to a given day. */
  const requestForDay = React.useCallback(
    (dayKey: string) =>
      revisionRequests.find((r) =>
        r.dateinspected ? String(r.dateinspected).slice(0, 10) === dayKey : false,
      ) ?? null,
    [revisionRequests],
  );

  /** Per-day revision state — mirrors the compliance editor. */
  const dayRevision = React.useCallback(
    (d: DayRow) => {
      const req = requestForDay(d.date);
      const raw = req?.statuscode?.toUpperCase() ?? "";
      const known: RevisionStatus[] = [
        "PENDING",
        "APPROVED",
        "DENIED",
        "CANCELLED",
        "COMPLETED",
        "EXPIRED",
      ];
      const status: RevisionStatus | null = (known as string[]).includes(raw)
        ? (raw as RevisionStatus)
        : null;
      const unlockedByApproval = Number(d.editablestatus) === 153;
      const pending = !unlockedByApproval && (d.isrevisionrequest || status === "PENDING");
      const locked = unlockedByApproval ? false : d.isLocked || pending;
      return {
        req,
        status: (unlockedByApproval ? "APPROVED" : status) as RevisionStatus | null,
        unlockedByApproval,
        pending,
        locked,
        needsRequest: locked && !pending,
      };
    },
    [requestForDay],
  );

  const changePeriod = (nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
  };

  const basePeriodMonth = record?.reportMonth ?? new Date().getMonth() + 1;
  const basePeriodYear = record?.reportYear ?? new Date().getFullYear();
  const isPeriodChanged = month !== basePeriodMonth || year !== basePeriodYear;

  if (!record) return null;

  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;
  const rows = days.map((d) => {
    const rev = dayRevision(d);
    return { ...d, isLocked: rev.locked, rev };
  });
  const allLocked = rows.length > 0 && rows.every((d) => d.isLocked);

  const updateField = (day: number, category: NoticeCategory, field: ModeKey, raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "");
    const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
    setDays((prev) =>
      prev.map((entry) =>
        entry.day === day
          ? {
              ...entry,
              modes: {
                ...entry.modes,
                [field]: { ...entry.modes[field], [category]: value },
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
      (sum, c) => sum + (entry.modes.manual[c] ?? 0) + (entry.modes.fsis[c] ?? 0),
      0,
    );

  const columnTotal = (category: NoticeCategory) =>
    days.reduce(
      (sum, d) => sum + (d.modes.manual[category] ?? 0) + (d.modes.fsis[category] ?? 0),
      0,
    );

  /** Issued totals come from the ledger record, not the encoded daily rows. */
  const issuedByCategory = NOTICE_CATEGORIES.reduce((acc, category) => {
    acc[category] = Number(record.breakdown?.[category]?.pending ?? 0) || 0;
    return acc;
  }, emptyModeCounts());

  const grandTotal = days.reduce((sum, d) => sum + rowTotal(d), 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      // One payload per accomplishment date, with a MANUAL (96) and FSIS (97)
      // row each, so counts are plotted on the correct date and station.
      // Only rows whose values actually changed are sent — untouched days
      // (e.g. future dates with no values) are skipped entirely.
      const editable = days.filter((entry) => {
        const baseline = baselineRows.get(entry.date);
        const changed =
          baseline === undefined ? rowTotal(entry) > 0 : rowSignature(entry) !== baseline;
        if (!changed) return false;
        return !entry.isLocked || rowTotal(entry) > 0;
      });
      if (editable.length === 0) {
        toast.info("No changes to save.");
        onOpenChange(false);
        return;
      }

      for (const entry of editable) {
        const payload = {
          noticeno: EMPTY_GUID,
          stationno: record.stationno,
          dateaccomplish: `${entry.date}T00:00:00`,
          encodedby: user?.memberno ?? "",
          accomnoticeList: MODE_ROWS.map((mode) => ({
            accomplishno: EMPTY_GUID,
            noticeno: EMPTY_GUID,
            fsicmode: mode.code,
            nodcount: entry.modes[mode.key].NOD ?? 0,
            ntccount: entry.modes[mode.key].NTC ?? 0,
            ntcvcount: entry.modes[mode.key].NTCV ?? 0,
            abatementcount: entry.modes[mode.key].Abatement ?? 0,
            closurecount: entry.modes[mode.key].Closure ?? 0,
          })),
        };
        const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
        const { ok, error } = unwrap(resp);
        if (!ok) {
          setSaveError(error || "Unable to update notice entry.");
          toast.error(error || "Unable to update notice entry.");
          return;
        }
      }
      toast.success("Complied Notices entry updated.");
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
              <DialogTitle className="text-base font-bold">Complied Notices Editor</DialogTitle>
              <DialogDescription>
                {record.stationname ? `${record.stationname} · ` : ""}
                {monthName} {year}
              </DialogDescription>
              {IS_PAST_DATE_LOCK_ENABLED && (
                <p className="mt-1 text-[11px] text-muted-foreground/90">
                  <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                  Each month locks on the{" "}
                  <span className="font-semibold">
                    4th day of the following month at 12:00 AM (PST)
                  </span>
                  . The current and next month remain editable — past months require a revision
                  request once locked.
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden bg-muted/20 px-5 py-5"
        >
          {/* Reporting Period ---------------------------------------------- */}
          <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                Reporting Period
              </h2>
              {isPeriodChanged && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => changePeriod(basePeriodMonth, basePeriodYear)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to {MONTHS[basePeriodMonth - 1]?.name} {basePeriodYear}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Month</span>
                <Select value={String(month)} onValueChange={(v) => changePeriod(Number(v), year)}>
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
                <Select value={String(year)} onValueChange={(v) => changePeriod(month, Number(v))}>
                  <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
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
            <PastDatesLockedNote />
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

          {/* Issued vs. Complied ---------------------------------------- */}
          <NoticeAccomplishmentPanel
            days={days}
            issuedByCategory={issuedByCategory}
            periodLabel={`${monthName} ${year}`}
          />

          {/* Daily Complied Notices Details ------------------------------------------- */}
          <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionTitle
                title="Daily Complied Notices Details"
                subtitle="Complied Notices per day"
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
                      rowSpan={2}
                      className={cn(
                        "sticky left-[266px] top-0 z-40 min-w-[140px] border-b border-r px-3 py-2 text-center align-middle font-bold uppercase tracking-wider",
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
                      Other Complied Notices
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
                  {rows.map((entry, index) => {
                    const zebra = index % 2 === 1;
                    const cellBg = zebra ? MONITORING_THEME.rowOdd : MONITORING_THEME.rowEven;
                    const rev = entry.rev;
                    const showRevisionAction = rev.pending || rev.needsRequest;
                    return (
                      <React.Fragment key={entry.day}>
                        {MODE_ROWS.map((mode, modeIndex) => (
                          <tr key={`${entry.day}-${mode.key}`} className={cellBg}>
                            {modeIndex === 0 && (
                              <td
                                rowSpan={2}
                                className={cn(
                                  "sticky left-0 z-20 min-w-[96px] border-b border-r px-2 py-1.5 text-center align-middle",
                                  cellBg,
                                )}
                              >
                                {showRevisionAction ? (
                                  rev.pending ? (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <EditButton
                                        variant="square"
                                        tooltip="Cancel Revision Request"
                                        ariaLabel="Cancel Revision Request"
                                        icon={<Ban className="h-4 w-4" />}
                                        onClick={() => {
                                          if (rev.req) setCancelRequestId(rev.req.requestno);
                                          else toast.info("No active revision request to cancel.");
                                        }}
                                      />
                                      <DeleteButton
                                        variant="square"
                                        tooltip="Delete Revision Request"
                                        ariaLabel="Delete Revision Request"
                                        icon={<Trash2 className="h-4 w-4" />}
                                        onClick={() => {
                                          if (rev.req) setDeleteRequestId(rev.req.requestno);
                                          else toast.info("No revision request to delete.");
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center gap-1.5">
                                      <EditButton
                                        variant="square"
                                        tooltip={
                                          !stationno
                                            ? "Select a station to request a revision"
                                            : "Request Revision"
                                        }
                                        ariaLabel={
                                          !stationno
                                            ? "Select a station to request a revision"
                                            : "Request Revision"
                                        }
                                        disabled={!stationno}
                                        icon={<FilePen className="h-4 w-4" />}
                                        onClick={() => {
                                          setRevisionReferenceKey(EMPTY_GUID);
                                          setRevisionDate(entry.date);
                                          setRevisionOpen(true);
                                        }}
                                      />
                                    </div>
                                  )
                                ) : null}
                              </td>
                            )}
                            {modeIndex === 0 && (
                              <td
                                rowSpan={2}
                                className={cn(
                                  "sticky left-[96px] z-20 min-w-[170px] border-b border-r px-3 py-1.5 align-middle font-medium",
                                  cellBg,
                                )}
                              >
                                <span className="flex items-center gap-2 whitespace-nowrap">
                                  {entry.isLocked && (
                                    <Lock
                                      className="h-3.5 w-3.5 shrink-0 text-warning"
                                      aria-label="Locked day"
                                    />
                                  )}
                                  {entry.label}
                                </span>
                              </td>
                            )}
                            <td
                              className={cn(
                                "sticky left-[266px] z-20 min-w-[140px] border-b border-r px-3 py-1.5 text-center align-middle font-semibold uppercase tracking-wide text-primary",
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
                    <td className="sticky left-[266px] z-30 total-row border-r border-t-2 border-grid-strong px-3 py-2" />
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

        {revisionOpen && (
          <RevisionRequestDialog
            open={revisionOpen}
            onOpenChange={setRevisionOpen}
            module="notice"
            station={{
              stationno,
              stationcode: record.stationcode || "",
              stationname: record.stationname || "",
              provinceno: provinceno || "",
              provincename: record.provincename || "",
              cityname: record.cityname || user?.cityname || "",
            }}
            year={year}
            month={month}
            referencekey={revisionReferenceKey}
            dateinspected={revisionDate}
            onSubmitted={() => setRevisionRefreshTick((n) => n + 1)}
          />
        )}

        <ReasonRemarksDialog
          open={!!cancelRequestId}
          onOpenChange={(v) => !v && setCancelRequestId(null)}
          title="Cancel Revision Request"
          description="Provide the reason for cancelling this pending request."
          reasonLabel="Cancellation Reason"
          confirmLabel="Cancel Request"
          confirmVariant="destructive"
          onConfirm={async ({ reason, remarks }) => {
            if (!cancelRequestId) return;
            const resp = await revisionrequestAPI.status({
              requestno: cancelRequestId,
              stationno: stationno || EMPTY_GUID,
              requesttype: "NOTICE",
              remarks: [reason, remarks].filter(Boolean).join(" — "),
              statusno: 155,
              taggedby: user?.memberno ?? "",
            });
            const { ok, error } = unwrap(resp);
            if (!ok) {
              toast.error(error || "Unable to cancel revision request.");
              return;
            }
            toast.success("Revision request cancelled.");
            setCancelRequestId(null);
            setRevisionRefreshTick((n) => n + 1);
          }}
        />

        <ConfirmDialog
          open={!!deleteRequestId}
          onOpenChange={(v) => !v && setDeleteRequestId(null)}
          title="Delete Revision Request?"
          description="This will permanently delete the selected revision request."
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={async () => {
            if (!deleteRequestId) return;
            const resp = await revisionrequestAPI.delete({
              requestno: deleteRequestId,
              deletedby: user?.memberno ?? "",
              roleno: Number(systemAccess?.roleno ?? 0),
            });
            const { ok, error } = unwrap(resp);
            if (!ok) {
              toast.error(error || "Unable to delete revision request.");
              return;
            }
            toast.success("Revision request deleted.");
            setDeleteRequestId(null);
            setRevisionRefreshTick((n) => n + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default NoticeEditModal;
