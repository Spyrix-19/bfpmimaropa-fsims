import * as React from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarIcon,
  FilePen,
  FilePlus2,
  Loader2,
  Lock,
  Save,
  Target,
  Trash2,
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
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";

import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import StationInfoCard from "@/components/station-info-card";
import { useStationDetails } from "@/hooks/useStationDetails";

import ConfirmDialog from "@/components/ui/confirm-dialog";
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
import { formatLongDate } from "@/lib/date-format";
import { useAuth } from "@/lib/auth";
import { noticeAPI } from "@/services/noticeAPI";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import type {
  FSISNoticeDTO,
  NoticeAccomClass,
  NoticeDetailClassModel,
  NoticeDetailModel,
} from "@/types/noticeType";
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

/** Midnight of the current local day, in ms. */
function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/** Counts for one Mode of Issuance row of an existing notice record. */
function countsFromAccom(row?: { [k: string]: unknown }): NoticeCounts {
  return {
    nodcount: Number(row?.nodcount ?? 0),
    ntccount: Number(row?.ntccount ?? 0),
    ntcvcount: Number(row?.ntcvcount ?? 0),
    abatementcount: Number(row?.abatementcount ?? 0),
    closurecount: Number(row?.closurecount ?? 0),
  };
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
  locked,
}: {
  manualValues: NoticeCounts;
  fsisValues: NoticeCounts;
  setManualValues: React.Dispatch<React.SetStateAction<NoticeCounts>>;
  setFsisValues: React.Dispatch<React.SetStateAction<NoticeCounts>>;
  locked?: boolean;
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
            readOnly={locked}
            disabled={locked}
            value={String(values[f.key] ?? 0)}
            onChange={(e) => {
              if (locked) return;
              onChange(f.key, e.target.value);
            }}
            onKeyDown={(e) => {
              if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
            }}
            className={cn(
              "h-8 w-full min-w-[110px] rounded-sm border-border/70 px-2 py-1 text-center tabular-nums",
              locked && "cursor-not-allowed bg-muted/60",
            )}
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
                <td key={f.key} className="border-r px-3 py-2 text-center font-bold tabular-nums">
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
                key={r.key}
                className={cn("border-t border-border/50", i % 2 === 1 && "bg-muted/20")}
              >
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
  const { user, systemAccess } = useAuth();
  const [reportingDate, setReportingDate] = React.useState<Date>(new Date());
  const [dateOpen, setDateOpen] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const [manualValues, setManualValues] = React.useState<NoticeCounts>(emptyCounts());
  const [fsisValues, setFsisValues] = React.useState<NoticeCounts>(emptyCounts());
  const [saving, setSaving] = React.useState(false);

  /* ── Existing-record (per accomplishment date) detection ────────────────── */
  const [checkingExisting, setCheckingExisting] = React.useState(false);
  const [existingNoticeNo, setExistingNoticeNo] = React.useState<string | null>(null);
  const [existingAccomNos, setExistingAccomNos] = React.useState<Record<string, string>>({});
  const [pendingExistingRecord, setPendingExistingRecord] =
    React.useState<NoticeDetailClassModel | null>(null);
  const [existingLocked, setExistingLocked] = React.useState(false);
  const [existingDialogOpen, setExistingDialogOpen] = React.useState(false);
  const [existingMeta, setExistingMeta] = React.useState<{
    isrevisionrequest: boolean;
    editablestatus: number;
  }>({ isrevisionrequest: false, editablestatus: 0 });
  const [issuedFromApi, setIssuedFromApi] = React.useState<NoticeCounts | null>(null);
  const promptedDateKeyRef = React.useRef<string | null>(null);

  /* ── Revision workflow (requesttype = NOTICE) ───────────────────────────── */
  const [addRevisionOpen, setAddRevisionOpen] = React.useState(false);
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const [revisionRequests, setRevisionRequests] = React.useState<FSISEditRequestModel[]>([]);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const selectedDateKey = format(reportingDate, "yyyy-MM-dd");
  const stationno = record?.stationno ?? "";

  // Resolves station code / city / province / logo for the Station Information card.
  const stationDetails = useStationDetails({
    stationno,
    searchKey: record?.stationcode || record?.stationname || "",
    provinceno: record?.provinceno,
    enabled: open,
  });


  /** Reset the form whenever the modal opens — the period defaults to today. */
  React.useEffect(() => {
    if (!open) return;
    setReportingDate(new Date());
    setRemarks("");
    setManualValues(emptyCounts());
    setFsisValues(emptyCounts());
    setExistingNoticeNo(null);
    setExistingAccomNos({});
    setPendingExistingRecord(null);
    setExistingLocked(false);
    setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });
    setIssuedFromApi(null);
    promptedDateKeyRef.current = null;
  }, [open, record?.key]);

  /** Plots an existing notice record into the MANUAL / FSIS matrix. */
  const plotExistingRecord = React.useCallback((entry: NoticeDetailClassModel) => {
    const list = Array.isArray(entry.noticeaccomlist) ? entry.noticeaccomlist : [];
    let manualRow = list.find((r) => Number(r.fsicmode) === FSIC_MODE.MANUAL);
    let fsisRow = list.find((r) => Number(r.fsicmode) === FSIC_MODE.FSIS);
    if (!manualRow && !fsisRow) {
      manualRow = list[0];
      fsisRow = list[1];
    }
    setManualValues(countsFromAccom(manualRow as unknown as Record<string, unknown>));
    setFsisValues(countsFromAccom(fsisRow as unknown as Record<string, unknown>));
    setExistingAccomNos({
      [FSIC_MODE.MANUAL]: manualRow?.accomplishno ? String(manualRow.accomplishno) : EMPTY_GUID,
      [FSIC_MODE.FSIS]: fsisRow?.accomplishno ? String(fsisRow.accomplishno) : EMPTY_GUID,
    });
    setExistingNoticeNo(String(entry.noticeno));
  }, []);

  /* Existence check — runs on open and every time the date changes. */
  React.useEffect(() => {
    if (!open || !stationno || stationno === EMPTY_GUID) return;

    let cancelled = false;
    (async () => {
      setCheckingExisting(true);
      const resp = await noticeAPI.getDetailBydate(
        {
          stationno,
          // The API expects the non-padded US format, e.g. 8/1/2026.
          dateaccomplish: format(reportingDate, "M/d/yyyy"),
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      setCheckingExisting(false);
      const { ok, data } = unwrap<NoticeDetailModel>(resp);
      const detail = ok && data && typeof data === "object" ? data : null;

      setIssuedFromApi(
        detail
          ? {
              nodcount: Number(detail.totalissuednodcount ?? 0),
              ntccount: Number(detail.totalissuedntccount ?? 0),
              ntcvcount: Number(detail.totalissuedntcvcount ?? 0),
              abatementcount: Number(detail.totalissuedabatementcount ?? 0),
              closurecount: Number(detail.totalissuedclosurecount ?? 0),
            }
          : null,
      );

      const entry =
        (Array.isArray(detail?.noticedetallist) ? detail?.noticedetallist : []).find(
          (e) => String(e.dateaccomplish ?? "").slice(0, 10) === selectedDateKey,
        ) ??
        (detail?.noticedetallist?.[0] || null);

      if (entry) {
        setPendingExistingRecord(entry);
        setExistingMeta({
          isrevisionrequest: Boolean(entry.isrevisionrequest),
          editablestatus: Number(entry.editablestatus ?? 0),
        });
        const isPast = reportingDate.getTime() < startOfToday();
        const unlocked = Number(entry.editablestatus ?? 0) === 153;
        const pending = !unlocked && Boolean(entry.isrevisionrequest);
        const locked = !unlocked && (isPast || pending);
        setExistingLocked(locked);

        const key = `${stationno}|${selectedDateKey}`;
        if (promptedDateKeyRef.current !== key) {
          promptedDateKeyRef.current = key;
          setExistingDialogOpen(true);
        } else if (locked) {
          plotExistingRecord(entry);
        }
      } else {
        promptedDateKeyRef.current = null;
        setExistingDialogOpen(false);
        setPendingExistingRecord(null);
        setExistingNoticeNo(null);
        setExistingAccomNos({});
        setExistingLocked(false);
        setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });
        setManualValues(emptyCounts());
        setFsisValues(emptyCounts());
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stationno, selectedDateKey, reloadNonce]);

  /* Revision requests ledger for the selected station/year (NOTICE). */
  React.useEffect(() => {
    if (!open || !stationno || stationno === EMPTY_GUID) {
      setRevisionRequests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno,
          reportyear: reportingDate.getFullYear(),
          reportmonth: 0,
          provinceno: record?.provinceno || EMPTY_GUID,
          requesttype: "NOTICE",
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<FSISEditRequestModel[]>(resp);
      setRevisionRequests(ok && Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stationno, record?.provinceno, reportingDate.getFullYear(), reloadNonce]);

  /* ── Lock rules for the selected date ───────────────────────────────────── */
  const isPastSelectedDate = reportingDate.getTime() < startOfToday();
  const unlockedByApproval = Number(existingMeta.editablestatus) === 153;
  const activeRequest = React.useMemo(() => {
    return (
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "PENDING") return false;
        if (existingNoticeNo && String(r.referencekey) === String(existingNoticeNo)) return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === selectedDateKey : false;
      }) ?? null
    );
  }, [revisionRequests, selectedDateKey, existingNoticeNo]);
  const hasPendingRevision =
    !unlockedByApproval && (existingMeta.isrevisionrequest || !!activeRequest);
  const needsRevisionRequest = isPastSelectedDate && !unlockedByApproval && !hasPendingRevision;
  const fieldsLocked = !unlockedByApproval && (isPastSelectedDate || hasPendingRevision);

  if (!record) return null;

  // Live MANUAL + FSIS entries = what is being accomplished for the day.
  const issuedTotals = NOTICE_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f.key]: (manualValues[f.key] ?? 0) + (fsisValues[f.key] ?? 0) }),
    {} as NoticeCounts,
  );
  // Issued counts come from the Detail/Date response when available.
  const panelIssued: NoticeCounts = issuedFromApi ?? {
    nodcount: record.breakdown.NOD?.pending ?? 0,
    ntccount: record.breakdown.NTC?.pending ?? 0,
    ntcvcount: record.breakdown.NTCV?.pending ?? 0,
    abatementcount: record.breakdown.Abatement?.pending ?? 0,
    closurecount: record.breakdown.Closure?.pending ?? 0,
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (fieldsLocked) {
      toast.error("This record is locked. Submit a revision request to enable editing.");
      return;
    }
    if (!record.stationno || record.stationno === EMPTY_GUID) {
      toast.error("A station is required before saving.");
      return;
    }
    const encodedby = user?.memberno ? String(user.memberno) : "";
    if (!encodedby || encodedby === EMPTY_GUID) {
      toast.error("Your account could not be identified. Please sign in again.");
      return;
    }
    const grandTotal = NOTICE_FIELDS.reduce((sum, f) => sum + (issuedTotals[f.key] ?? 0), 0);
    if (grandTotal <= 0) {
      toast.error("Encode at least one accomplished notice before saving.");
      return;
    }

    setSaving(true);
    try {
      const noticeno = existingNoticeNo || EMPTY_GUID;
      const buildAccom = (mode: number, values: NoticeCounts): NoticeAccomClass => ({
        accomplishno: existingAccomNos[mode] || EMPTY_GUID,
        noticeno,
        fsicmode: mode,
        nodcount: values.nodcount ?? 0,
        ntccount: values.ntccount ?? 0,
        ntcvcount: values.ntcvcount ?? 0,
        abatementcount: values.abatementcount ?? 0,
        closurecount: values.closurecount ?? 0,
      });

      const payload: FSISNoticeDTO = {
        noticeno,
        stationno: record.stationno,
        dateaccomplish: new Date(
          reportingDate.getFullYear(),
          reportingDate.getMonth(),
          reportingDate.getDate(),
          12,
          0,
          0,
        ).toISOString(),
        encodedby,
        accomnoticeList: [
          buildAccom(FSIC_MODE.MANUAL, manualValues),
          buildAccom(FSIC_MODE.FSIS, fsisValues),
        ],
      };

      const resp = await noticeAPI.create(payload, { suppressGlobalLoading: true });
      const { ok, canceled, error } = unwrap(resp);
      if (canceled) return;
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
              <DialogTitle className="text-base font-semibold">
                Notice Accomplishment Entry
              </DialogTitle>
              <DialogDescription className="text-sm">
                Select a reporting period and station, then encode the notices accomplished
                (complied/closed) for the day.
              </DialogDescription>
              <PastDatesLockedNote className="mt-1" />
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={submit}
          noValidate
          className="max-h-[calc(90vh-6rem)] space-y-6 overflow-y-auto bg-muted/20 px-5 py-5"
        >
          {fieldsLocked && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
              <span>
                {hasPendingRevision
                  ? "A revision request for this date is pending approval. Fields stay locked until it is approved."
                  : "This date has already passed and is locked. Submit a revision request to enable editing."}
              </span>
            </div>
          )}

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
                      {checkingExisting && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
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
          <StationInfoCard
            stationName={stationDetails.stationName || record.stationname || ""}
            unitCode={stationDetails.stationCode || record.stationcode || ""}
            logoUrl={stationDetails.logoUrl || record.logourl || null}
            fields={[
              {
                label: "Station Code",
                value: stationDetails.stationCode || record.stationcode || "",
              },
              {
                label: "City / Municipality",
                value:
                  record.cityname || stationDetails.cityName ||
                  (stationDetails.loading ? "Loading…" : ""),
              },
              {
                label: "Province",
                value:
                  record.provincename ||
                  record.province ||
                  stationDetails.provinceName ||
                  (stationDetails.loading ? "Loading…" : ""),
              },
            ]}

          />

          {/* 3. Issued vs. Accomplished -------------------------------------- */}
          <NoticeAccomplishmentPanel
            issued={panelIssued}
            accomplished={issuedTotals}
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
              locked={fieldsLocked}
            />

            <Field label="Accomplishment Remarks">
              <Textarea
                rows={3}
                value={remarks}
                readOnly={fieldsLocked}
                onChange={(e) => {
                  if (fieldsLocked) return;
                  setRemarks(e.target.value.slice(0, 1000));
                }}
                placeholder="Notes on the notices accomplished (compliance, closure, abatement) for this period…"
              />
            </Field>
          </Card>

          {/* Actions ---------------------------------------------------------- */}
          <div className="flex flex-wrap justify-end gap-2">
            {needsRevisionRequest ? (
              <Button
                type="button"
                onClick={() => setAddRevisionOpen(true)}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
              >
                <FilePen className="h-4 w-4" /> Request Revision
              </Button>
            ) : hasPendingRevision ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    if (activeRequest) setCancelRequestId(activeRequest.requestno);
                    else toast.info("No active revision request to cancel.");
                  }}
                >
                  <Ban className="h-4 w-4" /> Cancel Request
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => {
                    if (activeRequest) setDeleteRequestId(activeRequest.requestno);
                    else toast.info("No revision request to delete.");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete Request
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving || checkingExisting}
                  className="bg-gradient-primary text-primary-foreground shadow-elegant"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {saving
                    ? "Saving…"
                    : existingNoticeNo
                      ? "Update Accomplishment"
                      : "Save Accomplishment"}
                </Button>
              </>
            )}
          </div>
        </form>

        <ConfirmDialog
          open={existingDialogOpen}
          onOpenChange={(v) => {
            if (!v) {
              setExistingDialogOpen(false);
              if (existingLocked && pendingExistingRecord)
                plotExistingRecord(pendingExistingRecord);
            } else {
              setExistingDialogOpen(true);
            }
          }}
          ContentIcon={AlertTriangle}
          contentIconBgClass="tone-warning-soft"
          contentIconColorClass="text-warning"
          title="Notice Accomplishment Already Exists"
          description={`A notice accomplishment record already exists for ${
            record.stationname || "this station"
          } on ${formatLongDate(reportingDate)}.\n\n${
            existingLocked
              ? "This record is already locked — it will be opened as read-only and any change will require a revision request."
              : "Do you want to open and edit the existing record?"
          }`}
          confirmLabel={existingLocked ? "Open Record" : "Edit Existing"}
          showCancel={false}
          onConfirm={() => {
            if (pendingExistingRecord) plotExistingRecord(pendingExistingRecord);
            setExistingDialogOpen(false);
          }}
        />

        {addRevisionOpen && (
          <RevisionRequestDialog
            open={addRevisionOpen}
            onOpenChange={setAddRevisionOpen}
            module="notice"
            station={{
              stationno: record.stationno,
              stationcode: record.stationcode ?? "",
              stationname: record.stationname ?? "",
              provinceno: record.provinceno ?? "",
              provincename: record.provincename ?? "",
              cityname: record.cityname ?? "",
            }}
            year={reportingDate.getFullYear()}
            month={reportingDate.getMonth() + 1}
            referencekey={existingNoticeNo || EMPTY_GUID}
            dateinspected={selectedDateKey}
            onSubmitted={() => setReloadNonce((n) => n + 1)}
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
          onConfirm={async ({ reason, remarks: cancelRemarks }) => {
            if (!cancelRequestId) return;
            const resp = await revisionrequestAPI.status({
              requestno: cancelRequestId,
              stationno: record.stationno || EMPTY_GUID,
              requesttype: "NOTICE",
              remarks: [reason, cancelRemarks].filter(Boolean).join(" — "),
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
            setReloadNonce((n) => n + 1);
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
            setReloadNonce((n) => n + 1);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export default NoticeAddModal;
