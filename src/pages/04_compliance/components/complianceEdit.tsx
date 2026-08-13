import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  AlertCircle,
  CalendarDays,
  Loader2,
  FilePen,
  Save,
  Table2,
  Lock,
  Trash2,
  Ban,
  RotateCcw,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import StationInfoCard from "@/components/station-info-card";

import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useAuth } from "@/lib/auth";
import { EMPTY_GUID, unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { isReportMonthLocked } from "@/pages/06_target-reference/helpers";
import { MONITORING_THEME } from "./complianceTheme";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import type { RevisionStatus } from "@/pages/06_target-reference/revision/types";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";

import { complianceAPI } from "@/services/complianceAPI";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISIssuanceClassDTO,
  FSISComplianceDetailModel,
  FSISComplianceDetailClassModel,
  FSISComplianceDTO,
  FSISComplianceClass,
  TargetAccomplishmentModel,
} from "@/types/complianceType";

import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

/* ========================================================================== */
/*  Column definitions — keyed by the EXACT API property names               */
/* ========================================================================== */

/** Inspection-level (compliancelist[*]) numeric fields. */
type InspectionField =
  | "inspectduringcount"
  | "inspectaftercount"
  | "inspectbplocount"
  | "inspectgovcount"
  | "inspectpezacount"
  | "inspecttiezacount"
  | "reinspectoccupancycount"
  | "reinspectbplocount"
  | "reinspectgovcount"
  | "reinspectpezacount"
  | "reinspecttiezacount";

/** Daily target fields (read-only, supplied by the Detail API). */
type TargetField = "dailytargetbplo" | "dailytargetgov" | "dailytargetpeza" | "dailytargettieza";

/** Issuance-level (compliancelist[*].issuancelist[*]) numeric fields. */
type IssuanceField =
  | "fsecbuildingcount"
  | "fsecgovcount"
  | "fsecpezacount"
  | "fsectiezacount"
  | "fsicoccupancycount"
  | "fsicbplonewcount"
  | "fsicbplorenewcount"
  | "fsicgovcount"
  | "fsicpezacount"
  | "fsictiezacount"
  | "nodcount"
  | "ntccount"
  | "ntcvcount"
  | "abatementcount"
  | "closurecount"
  | "refsicoccupancycount"
  | "refsicbplonewcount"
  | "refsicbplorenewcount"
  | "refsicgovcount"
  | "refsicpezacount"
  | "refsictiezacount"
  | "rentcvcount"
  | "reabatementcount"
  | "reclosurecount";

interface InspectionCol {
  api: InspectionField;
  label: string;
  target?: TargetField;
}
interface IssuanceCol {
  api: IssuanceField;
  label: string;
}

/* -- Daily Inspection & Issuance ------------------------------------------ */
const INSPECT_COLS: InspectionCol[] = [
  { api: "inspectduringcount", label: "During" },
  { api: "inspectaftercount", label: "After" },
  { api: "inspectbplocount", label: "BPLO", target: "dailytargetbplo" },
  { api: "inspectgovcount", label: "GOV", target: "dailytargetgov" },
  { api: "inspectpezacount", label: "PEZA", target: "dailytargetpeza" },
  { api: "inspecttiezacount", label: "TIEZA", target: "dailytargettieza" },
];

const FSEC_COLS: IssuanceCol[] = [
  { api: "fsecbuildingcount", label: "Building" },
  { api: "fsecgovcount", label: "Gov" },
  { api: "fsecpezacount", label: "PEZA" },
  { api: "fsectiezacount", label: "TIEZA" },
];

const FSIC_COLS: IssuanceCol[] = [
  { api: "fsicoccupancycount", label: "Occupancy" },
  { api: "fsicbplonewcount", label: "BPLO New" },
  { api: "fsicbplorenewcount", label: "BPLO Renew" },
  { api: "fsicgovcount", label: "Gov" },
  { api: "fsicpezacount", label: "PEZA" },
  { api: "fsictiezacount", label: "TIEZA" },
];

const NOTICE_COLS: IssuanceCol[] = [
  { api: "nodcount", label: "NOD" },
  { api: "ntccount", label: "NTC" },
  { api: "ntcvcount", label: "NTCV" },
  { api: "abatementcount", label: "Abatement" },
  { api: "closurecount", label: "Closure" },
];

/* -- Daily Reinspection ---------------------------------------------------- */
const REINSPECT_COLS: InspectionCol[] = [
  { api: "reinspectoccupancycount", label: "Occupancy" },
  { api: "reinspectbplocount", label: "BPLO" },
  { api: "reinspectgovcount", label: "GOV" },
  { api: "reinspectpezacount", label: "PEZA" },
  { api: "reinspecttiezacount", label: "TIEZA" },
];

const REFSIC_COLS: IssuanceCol[] = [
  { api: "refsicoccupancycount", label: "Occupancy" },
  { api: "refsicbplonewcount", label: "BPLO New" },
  { api: "refsicbplorenewcount", label: "BPLO Renew" },
  { api: "refsicgovcount", label: "Gov" },
  { api: "refsicpezacount", label: "PEZA" },
  { api: "refsictiezacount", label: "TIEZA" },
];

const RENOTICE_COLS: IssuanceCol[] = [
  { api: "rentcvcount", label: "NTCV" },
  { api: "reabatementcount", label: "Abatement" },
  { api: "reclosurecount", label: "Closure" },
];

const ALL_INSPECTION_FIELDS: InspectionField[] = [
  ...INSPECT_COLS.map((c) => c.api),
  ...REINSPECT_COLS.map((c) => c.api),
];

const ALL_ISSUANCE_FIELDS: IssuanceField[] = [
  ...FSEC_COLS.map((c) => c.api),
  ...FSIC_COLS.map((c) => c.api),
  ...NOTICE_COLS.map((c) => c.api),
  ...REFSIC_COLS.map((c) => c.api),
  ...RENOTICE_COLS.map((c) => c.api),
];

/* ========================================================================== */
/*  Editable model                                                           */
/* ========================================================================== */

type EditableInspection = Record<InspectionField, number> &
  Record<TargetField, number> & {
    fsisno: string;
    dateinspected: string;
    remarks: string;
  };

type EditableIssuance = Record<IssuanceField, number> & {
  issuanceno: string;
  fsicmode: number;
};

interface EditableDay {
  day: number;
  label: string;
  key: string;
  inspection: EditableInspection;
  /** fsicmode 96 */
  manual: EditableIssuance;
  /** fsicmode 97 */
  fsis: EditableIssuance;
  isLocked: boolean;
  editablestatus: number;
  isrevisionrequest: boolean;
}

const FSIC_MODE_MANUAL = 96;
const FSIC_MODE_FSIS = 97;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toLocalKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeDateKey(v: string | Date | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return toLocalKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toLocalKey(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Selectable reporting years (2 back, 1 ahead of the current year). */
const YEAR_OPTIONS: number[] = (() => {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1];
})();

/**
 * PST lock activation — mirrors Target Reference.
 * A month locks on day 4 of the following calendar month at 00:00 PST.
 */
function hasPstLockActivated(
  reportyear: number,
  reportmonth: number,
  now: Date = new Date(),
): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  const y = Number(reportyear);
  const m = Number(reportmonth);
  if (!y || !m || m < 1 || m > 12) return false;
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const lockActivationMs = Date.UTC(y, m /* next month, 0-indexed */, 4, 0, 0, 0);
  return manilaNowMs >= lockActivationMs;
}

/** Check if a given date has already passed (is before today at midnight). */
function isDayPassed(dateStr: string): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function emptyIssuance(fsicmode: number): EditableIssuance {
  const base = Object.fromEntries(ALL_ISSUANCE_FIELDS.map((f) => [f, 0])) as Record<
    IssuanceField,
    number
  >;
  return { ...base, issuanceno: EMPTY_GUID, fsicmode };
}

function emptyInspection(dateKey: string): EditableInspection {
  const counts = Object.fromEntries(ALL_INSPECTION_FIELDS.map((f) => [f, 0])) as Record<
    InspectionField,
    number
  >;
  return {
    ...counts,
    dailytargetbplo: 0,
    dailytargetgov: 0,
    dailytargetpeza: 0,
    dailytargettieza: 0,
    fsisno: EMPTY_GUID,
    dateinspected: dateKey,
    remarks: "",
  };
}

/**
 * Build the per-day editable structure straight from the Detail API's
 * `compliancelist`. Every calendar day of the month gets an entry; days the
 * API did not return start empty.
 */
function buildEditableDays(
  list: FSISComplianceDetailClassModel[] | null | undefined,
  year: number,
  month: number,
): Map<string, EditableDay> {
  const dataByDate = new Map<string, FSISComplianceDetailClassModel>();
  for (const item of Array.isArray(list) ? list : []) {
    const key = normalizeDateKey(item?.dateinspected);
    if (key) dataByDate.set(key, item);
  }

  const map = new Map<string, EditableDay>();
  const total = daysInMonth(year, month);
  const monthName = MONTHS[month - 1]?.name ?? "";

  for (let d = 1; d <= total; d++) {
    const key = toLocalKey(year, month, d);
    const rec = dataByDate.get(key);

    const inspection = emptyInspection(key);
    let manual = emptyIssuance(FSIC_MODE_MANUAL);
    let fsis = emptyIssuance(FSIC_MODE_FSIS);

    if (rec) {
      inspection.fsisno = String(rec.fsisno ?? EMPTY_GUID);
      inspection.dateinspected = String(rec.dateinspected ?? key);
      inspection.remarks = String(rec.remarks ?? "");
      inspection.dailytargetbplo = num(rec.dailytargetbplo);
      inspection.dailytargetgov = num(rec.dailytargetgov);
      inspection.dailytargetpeza = num(rec.dailytargetpeza);
      inspection.dailytargettieza = num(rec.dailytargettieza);
      for (const f of ALL_INSPECTION_FIELDS) {
        inspection[f] = num((rec as unknown as Record<string, unknown>)[f]);
      }

      for (const iss of Array.isArray(rec.issuancelist) ? rec.issuancelist : []) {
        const mode = num(iss?.fsicmode);
        if (mode !== FSIC_MODE_MANUAL && mode !== FSIC_MODE_FSIS) continue;
        const target = emptyIssuance(mode);
        target.issuanceno = String(iss?.issuanceno ?? EMPTY_GUID);
        for (const f of ALL_ISSUANCE_FIELDS) {
          target[f] = num((iss as unknown as Record<string, unknown>)[f]);
        }
        if (mode === FSIC_MODE_MANUAL) manual = target;
        else fsis = target;
      }
    }

    const editablestatus = num(rec?.editablestatus);
    const isrevisionrequest = Boolean(rec?.isrevisionrequest);
    const isLocked =
      editablestatus === 153 ? false : hasPstLockActivated(year, month) || isDayPassed(key);

    map.set(key, {
      day: d,
      label: `${monthName} ${d}, ${year}`,
      key,
      inspection,
      manual,
      fsis,
      isLocked,
      editablestatus,
      isrevisionrequest,
    });
  }

  return map;
}

/** Header info taken from the Detail API payload. */
interface StationHeader {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logourl: string;
}

/* ========================================================================== */
/*  Per-day totals                                                           */
/* ========================================================================== */

const sumIssuance = (day: EditableDay, cols: IssuanceCol[]) =>
  cols.reduce((sum, c) => sum + num(day.manual[c.api]) + num(day.fsis[c.api]), 0);

const sumInspection = (day: EditableDay, cols: InspectionCol[]) =>
  cols.reduce((sum, c) => sum + num(day.inspection[c.api]), 0);

const inspectionRowTotal = (day: EditableDay) =>
  sumInspection(day, INSPECT_COLS) +
  sumIssuance(day, FSEC_COLS) +
  sumIssuance(day, FSIC_COLS) +
  sumIssuance(day, NOTICE_COLS);

const reinspectionRowTotal = (day: EditableDay) =>
  sumInspection(day, REINSPECT_COLS) +
  sumIssuance(day, REFSIC_COLS) +
  sumIssuance(day, RENOTICE_COLS);

/* ========================================================================== */
/*  Editor body — per-day editable tables                                    */
/* ========================================================================== */

type DayWithRevision = EditableDay & {
  rev: {
    req: RevisionRequestRow | null;
    status: RevisionStatus | null;
    unlockedByApproval: boolean;
    pending: boolean;
    locked: boolean;
    needsRequest: boolean;
  };
};

interface RevisionRequestRow {
  requestno: string;
  statuscode?: string;
  statusname?: string;
  referencekey?: string;
  dateinspected?: string;
}

function ComplianceEditBody({
  stationno,
  year: initialYear,
  month: initialMonth,
  onSaved,
  onCancel,
}: {
  stationno: string;
  year: number;
  month: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user, systemAccess } = useAuth();

  // Selected reporting period — editable so the user can switch months here.
  const [year, setYear] = React.useState<number>(initialYear);
  const [month, setMonth] = React.useState<number>(initialMonth);
  React.useEffect(() => setYear(initialYear), [initialYear]);
  React.useEffect(() => setMonth(initialMonth), [initialMonth]);

  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? String(month);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [revisionReferenceKey, setRevisionReferenceKey] = React.useState(EMPTY_GUID);
  const [revisionDate, setRevisionDate] = React.useState<string>("");
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const [revisionRequestRefreshTick, setRevisionRequestRefreshTick] = React.useState(0);

  // Station header from the Detail API
  const [station, setStation] = React.useState<StationHeader | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  // Editable days indexed by YYYY-MM-DD
  const [editableDays, setEditableDays] = React.useState<Map<string, EditableDay>>(new Map());

  // Baseline to detect unsaved changes
  const [baseline, setBaseline] = React.useState<string>("");
  const [baselineMap, setBaselineMap] = React.useState<Map<string, string>>(new Map());

  // Collapsible state for the three daily cards (display only — data is kept).
  const [dashboardExpanded, setDashboardExpanded] = React.useState(false);
  const [issuanceExpanded, setIssuanceExpanded] = React.useState(false);
  const [reinspectionExpanded, setReinspectionExpanded] = React.useState(false);

  const serializeDay = React.useCallback(
    (day: EditableDay) =>
      JSON.stringify({
        inspection: day.inspection,
        manual: day.manual,
        fsis: day.fsis,
      }),
    [],
  );

  /** True when a day (with no saved baseline) carries any encoded value. */
  const dayHasAnyValue = React.useCallback((day: EditableDay) => {
    if (ALL_INSPECTION_FIELDS.some((f) => num(day.inspection[f]) !== 0)) return true;
    if (String(day.inspection.remarks ?? "").trim() !== "") return true;
    return ALL_ISSUANCE_FIELDS.some((f) => num(day.manual[f]) !== 0 || num(day.fsis[f]) !== 0);
  }, []);

  const isDayModified = React.useCallback(
    (originalSerialized: string, day: EditableDay) => originalSerialized !== serializeDay(day),
    [serializeDay],
  );

  const currentSnapshot = React.useMemo(
    () => JSON.stringify(Array.from(editableDays.entries())),
    [editableDays],
  );
  const isDirty = !loading && baseline !== "" && currentSnapshot !== baseline;

  /* ------- Revision requests for the month (from the live API) ------------ */
  const [revisionRequests, setRevisionRequests] = React.useState<RevisionRequestRow[]>([]);
  React.useEffect(() => {
    if (!stationno || !year || !month) {
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
          requesttype: "COMPLIANCE",
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<RevisionRequestRow[]>(resp);
      setRevisionRequests(ok && Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month, provinceno, revisionRequestRefreshTick]);

  /** Latest request for a given day (matched by referencekey = fsisno, or by date). */
  const requestForDay = React.useCallback(
    (dayKey: string, fsisno: string) =>
      revisionRequests.find((r) => {
        if (fsisno && fsisno !== EMPTY_GUID && String(r.referencekey) === String(fsisno))
          return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === dayKey : false;
      }) ?? null,
    [revisionRequests],
  );

  /**
   * Per-day revision state, driven by the API fields `isrevisionrequest`
   * and `editablestatus` (153 = approved / temporarily unlocked).
   */
  const dayRevision = React.useCallback(
    (d: EditableDay) => {
      const req = requestForDay(d.key, d.inspection.fsisno);
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

  /* ----------------------------- Data loading ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const sResp = await stationAPI.search({
        pageNumber: 1,
        pageSize: 1,
        searchKey: stationno,
      });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seed = Array.isArray(sData) ? sData[0] : undefined;
      if (cancelled) return;
      setProvinceno(seed?.provinceno ?? EMPTY_GUID);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno]);

  // GET /api/v1/FSISCompliance/Detail?Stationno=&Reportyear=&Reportmonth=
  React.useEffect(() => {
    if (provinceno == null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await complianceAPI.getDetail(
        {
          stationno: stationno || EMPTY_GUID,
          reportyear: year,
          reportmonth: month,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;

      const { ok, data, error } = unwrap<FSISComplianceDetailModel | FSISComplianceDetailModel[]>(
        resp,
      );
      if (!ok) toast.error(error || "Failed to load monthly data.");
      const detail = ok ? (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) : null;

      setStation(
        detail
          ? {
              stationno: String(detail.stationno ?? ""),
              stationcode: String(detail.stationcode ?? ""),
              stationname: String(detail.stationname ?? ""),
              provinceno: String(detail.provinceno ?? ""),
              provincename: String(detail.provincename ?? ""),
              cityname: String(detail.cityname ?? ""),
              logourl: String(detail.logourl ?? ""),
            }
          : null,
      );

      const days = buildEditableDays(detail?.compliancelist, year, month);
      setEditableDays(days);
      setBaseline(JSON.stringify(Array.from(days.entries())));
      setBaselineMap(
        new Map(Array.from(days.entries()).map(([dayKey, day]) => [dayKey, serializeDay(day)])),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, year, month, revisionRequestRefreshTick, serializeDay]);

  /* ---------------------- Warn on unsaved changes ----------------------- */
  React.useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const requestCancel = () => {
    if (isDirty) {
      setConfirmLeave(true);
      return;
    }
    onCancel();
  };

  /** Switch the reporting period (month / year) being edited. */
  const changePeriod = (nextMonth: number, nextYear: number) => {
    if (nextMonth === month && nextYear === year) return;
    if (isDirty) {
      toast.error("Save or discard your changes before switching the reporting month.");
      return;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  /* ------------------------------- Handlers ------------------------------ */

  const updateInspectionField = React.useCallback(
    (dayKey: string, field: InspectionField, raw: string) => {
      setEditableDays((prev) => {
        const day = prev.get(dayKey);
        if (!day) return prev;
        const cleaned = raw.replace(/[^0-9]/g, "");
        const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
        const next = new Map(prev);
        next.set(dayKey, { ...day, inspection: { ...day.inspection, [field]: value } });
        return next;
      });
    },
    [],
  );

  const updateIssuanceField = React.useCallback(
    (dayKey: string, mode: "manual" | "fsis", field: IssuanceField, raw: string) => {
      setEditableDays((prev) => {
        const day = prev.get(dayKey);
        if (!day) return prev;
        const cleaned = raw.replace(/[^0-9]/g, "");
        const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
        const next = new Map(prev);
        next.set(dayKey, { ...day, [mode]: { ...day[mode], [field]: value } });
        return next;
      });
    },
    [],
  );

  const openRevisionRequest = React.useCallback((day: EditableDay) => {
    setRevisionReferenceKey(
      day.inspection.fsisno && day.inspection.fsisno !== EMPTY_GUID
        ? day.inspection.fsisno
        : EMPTY_GUID,
    );
    setRevisionDate(normalizeDateKey(day.inspection.dateinspected) || day.key);
    setRevisionOpen(true);
  }, []);

  /* --------------------------------- Save -------------------------------- */

  const handleSave = async () => {
    setSaveError(null);
    if (!station) {
      setSaveError("No record loaded.");
      return;
    }

    // Month lock only blocks when no day was unlocked by an approved revision.
    const anyApprovedDay = Array.from(editableDays.values()).some(
      (d) => Number(d.editablestatus) === 153,
    );
    if (!anyApprovedDay && isReportMonthLocked(year, month)) {
      setSaveError("This reporting month is locked and cannot be edited.");
      return;
    }

    setSaving(true);
    try {
      // Only send days that were actually modified. Days left untouched
      // (typically future dates with no values) are skipped so the backend
      // does not treat them as encoded/accomplished days.
      const updates: FSISComplianceClass[] = [];

      for (const day of editableDays.values()) {
        const original = baselineMap.get(day.key);
        const isRowModified = original ? isDayModified(original, day) : dayHasAnyValue(day);
        if (!isRowModified) continue;

        const toIssuance = (src: EditableIssuance, fsicmode: number): FSISIssuanceClassDTO => ({
          issuanceno: src.issuanceno || EMPTY_GUID,
          fsicmode,
          fsecbuildingcount: src.fsecbuildingcount,
          fsecgovcount: src.fsecgovcount,
          fsecpezacount: src.fsecpezacount,
          fsectiezacount: src.fsectiezacount,
          fsicoccupancycount: src.fsicoccupancycount,
          fsicbplonewcount: src.fsicbplonewcount,
          fsicbplorenewcount: src.fsicbplorenewcount,
          fsicgovcount: src.fsicgovcount,
          fsicpezacount: src.fsicpezacount,
          fsictiezacount: src.fsictiezacount,
          nodcount: src.nodcount,
          ntccount: src.ntccount,
          ntcvcount: src.ntcvcount,
          abatementcount: src.abatementcount,
          closurecount: src.closurecount,
          refsicoccupancycount: src.refsicoccupancycount,
          refsicbplonewcount: src.refsicbplonewcount,
          refsicbplorenewcount: src.refsicbplorenewcount,
          refsicgovcount: src.refsicgovcount,
          refsicpezacount: src.refsicpezacount,
          refsictiezacount: src.refsictiezacount,
          rentcvcount: src.rentcvcount,
          reabatementcount: src.reabatementcount,
          reclosurecount: src.reclosurecount,
        });

        updates.push({
          fsisno: day.inspection.fsisno || EMPTY_GUID,
          dateinspected: day.key,
          inspectduringcount: day.inspection.inspectduringcount,
          inspectaftercount: day.inspection.inspectaftercount,
          inspectbplocount: day.inspection.inspectbplocount,
          inspectgovcount: day.inspection.inspectgovcount,
          inspectpezacount: day.inspection.inspectpezacount,
          inspecttiezacount: day.inspection.inspecttiezacount,
          reinspectoccupancycount: day.inspection.reinspectoccupancycount,
          reinspectbplocount: day.inspection.reinspectbplocount,
          reinspectgovcount: day.inspection.reinspectgovcount,
          reinspectpezacount: day.inspection.reinspectpezacount,
          reinspecttiezacount: day.inspection.reinspecttiezacount,
          isaccomplished: true,
          remarks: (day.inspection.remarks ?? "").trim(),
          issuancelist: [
            toIssuance(day.manual, FSIC_MODE_MANUAL),
            toIssuance(day.fsis, FSIC_MODE_FSIS),
          ],
        });
      }

      if (updates.length === 0) {
        toast.info("No changes to save.");
        onSaved();
        return;
      }

      const payload: FSISComplianceDTO = {
        stationno,
        encodedby: user?.memberno ?? "",
        compliancelist: updates,
      };

      const resp = await complianceAPI.create(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) {
        const msg = error || "Failed to save changes. Please try again.";
        setSaveError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Fire safety compliance updated successfully.");
      setBaseline(currentSnapshot);
      setRevisionRequestRefreshTick((n) => n + 1);
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error while saving.";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------- UI --------------------------------- */

  // Per-day locking: `editablestatus === 153` unlocks that day, a pending
  // revision request keeps it locked.
  const days: DayWithRevision[] = React.useMemo(
    () =>
      Array.from(editableDays.values()).map((d) => {
        const rev = dayRevision(d);
        return { ...d, isLocked: rev.locked, rev };
      }),
    [editableDays, dayRevision],
  );
  const allLocked = days.length > 0 && days.every((d) => d.isLocked);

  /** Monthly target vs. accomplishment, derived from the Detail API values. */
  const monthlySummary: TargetAccomplishmentModel | null = React.useMemo(() => {
    if (!station) return null;
    return days.reduce<TargetAccomplishmentModel>(
      (acc, d) => {
        acc.totaltargetbplo += num(d.inspection.dailytargetbplo);
        acc.totaltargetgov += num(d.inspection.dailytargetgov);
        acc.totaltargetpeza += num(d.inspection.dailytargetpeza);
        acc.totaltargettieza += num(d.inspection.dailytargettieza);
        acc.totalAccomplishmentbplo += num(d.inspection.inspectbplocount);
        acc.totalAccomplishmentgov += num(d.inspection.inspectgovcount);
        acc.totalAccomplishmentpeza += num(d.inspection.inspectpezacount);
        acc.totalAccomplishmenttieza += num(d.inspection.inspecttiezacount);
        return acc;
      },
      {
        stationno: station.stationno,
        month,
        year,
        totaltargetbplo: 0,
        totaltargetgov: 0,
        totaltargetpeza: 0,
        totaltargettieza: 0,
        totalAccomplishmentbplo: 0,
        totalAccomplishmentgov: 0,
        totalAccomplishmentpeza: 0,
        totalAccomplishmenttieza: 0,
      },
    );
  }, [days, station, month, year]);

  // Keep the previously loaded period visible while a new period loads so the
  // form does not blink; only show the full loader on the very first load.
  if (loading && editableDays.size === 0) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-4 md:space-y-8">
      {/* Reporting Period ---------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            Reporting Period
          </h2>
          {(month !== initialMonth || year !== initialYear) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => changePeriod(initialMonth, initialYear)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to {MONTHS.find((mo) => mo.value === initialMonth)?.name} {initialYear}
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

      {/* Station Information ------------------------------------------------- */}
      <StationInfoCard
        stationName={station?.stationname || ""}
        unitCode={station?.stationcode || ""}
        logoUrl={station?.logourl || null}
        fields={[
          { label: "Station Code", value: station?.stationcode ?? "" },
          { label: "City / Municipality", value: station?.cityname ?? "" },
          { label: "Province", value: station?.provincename ?? "" },
        ]}
      />

      {/* Daily Dashboard ------------------------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Dashboard"
          subtitle={`Reporting month · ${monthName} ${year}`}
          expanded={dashboardExpanded}
          onToggle={() => setDashboardExpanded((v) => !v)}
        />

        {dashboardExpanded && (
          <TargetAccomplishmentPanel
            stationno={stationno}
            year={year}
            month={month}
            data={monthlySummary}
          />
        )}
      </Card>

      {/* Daily Inspection & Issuance ------------------------------------------ */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Inspection & Issuance Activities"
          subtitle="Encode issuances separately for MANUAL and FSIS"
          expanded={issuanceExpanded}
          onToggle={() => setIssuanceExpanded((v) => !v)}
        />

        {issuanceExpanded && (
          <ActivityTable
            days={days}
            stationno={stationno}
            inspectionLabel="Inspection"
            inspectionCols={INSPECT_COLS}
            groups={[
              { label: "FSEC", cols: FSEC_COLS },
              { label: "FSIC", cols: FSIC_COLS },
              { label: "Issued Notices", cols: NOTICE_COLS },
            ]}
            rowTotal={inspectionRowTotal}
            onInspectionChange={updateInspectionField}
            onIssuanceChange={updateIssuanceField}
            onRequestRevision={openRevisionRequest}
            onCancelRevision={setCancelRequestId}
            onDeleteRevision={setDeleteRequestId}
          />
        )}
      </Card>

      {/* Daily Reinspection ---------------------------------------------------- */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Reinspection Activities"
          subtitle="Reinspection, RE-FSIC and re-issued notices"
          expanded={reinspectionExpanded}
          onToggle={() => setReinspectionExpanded((v) => !v)}
        />

        {reinspectionExpanded && (
          <ActivityTable
            days={days}
            stationno={stationno}
            inspectionLabel="Reinspection"
            inspectionCols={REINSPECT_COLS}
            groups={[
              { label: "RE-FSIC", cols: REFSIC_COLS },
              { label: "Re-Issued Notices", cols: RENOTICE_COLS },
            ]}
            rowTotal={reinspectionRowTotal}
            onInspectionChange={updateInspectionField}
            onIssuanceChange={updateIssuanceField}
            onRequestRevision={openRevisionRequest}
            onCancelRevision={setCancelRequestId}
            onDeleteRevision={setDeleteRequestId}
          />
        )}
      </Card>

      {/* Actions ------------------------------------------------------------ */}
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
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {allLocked && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 tone-warning-soft px-3 py-2 text-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">All days have passed and are locked</div>
            <p className="mt-1">Only today and future dates may be edited.</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="outline" onClick={requestCancel} className="gap-2" disabled={saving}>
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || allLocked || !isDirty}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving changes…" : isDirty ? "Save Changes" : "Saved"}
        </Button>
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have edited daily inspection or issuance values. Leaving now will discard those
              changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmLeave(false);
                onCancel();
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {revisionOpen && (
        <RevisionRequestDialog
          open={revisionOpen}
          onOpenChange={setRevisionOpen}
          module="monitoring"
          station={{
            stationno,
            stationcode: station?.stationcode || "",
            stationname: station?.stationname || "",
            provinceno: provinceno || "",
            provincename: station?.provincename || "",
            cityname: station?.cityname || user?.cityname || "",
          }}
          year={year}
          month={month}
          referencekey={revisionReferenceKey}
          dateinspected={revisionDate}
          onSubmitted={() => setRevisionRequestRefreshTick((n) => n + 1)}
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
            requesttype: "COMPLIANCE",
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
          setRevisionRequestRefreshTick((n) => n + 1);
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
          setRevisionRequestRefreshTick((n) => n + 1);
        }}
      />
    </div>
  );
}

/* ========================================================================== */
/*  Day table (shared by the inspection and reinspection cards)              */
/* ========================================================================== */

const CELL_INPUT_CLASS =
  "h-8 w-full rounded-sm border-border/70 bg-white/90 px-1 py-1 text-center tabular-nums no-spinner";

function ActivityTable({
  days,
  stationno,
  inspectionLabel,
  inspectionCols,
  groups,
  rowTotal,
  onInspectionChange,
  onIssuanceChange,
  onRequestRevision,
  onCancelRevision,
  onDeleteRevision,
}: {
  days: DayWithRevision[];
  stationno: string;
  inspectionLabel: string;
  inspectionCols: InspectionCol[];
  groups: { label: string; cols: IssuanceCol[] }[];
  rowTotal: (day: EditableDay) => number;
  onInspectionChange: (dayKey: string, field: InspectionField, raw: string) => void;
  onIssuanceChange: (
    dayKey: string,
    mode: "manual" | "fsis",
    field: IssuanceField,
    raw: string,
  ) => void;
  onRequestRevision: (day: EditableDay) => void;
  onCancelRevision: (requestno: string) => void;
  onDeleteRevision: (requestno: string) => void;
}) {
  const inspectionColspan = inspectionCols.reduce((n, c) => n + (c.target ? 2 : 1), 0);
  const issuanceCols = groups.flatMap((g) => g.cols);

  const issuanceCells = (day: DayWithRevision, mode: "manual" | "fsis") =>
    issuanceCols.map((col) => {
      const value = num(day[mode][col.api]);
      return (
        <td
          key={col.api}
          className="min-w-[72px] w-[72px] border-b border-r px-2 py-1.5 text-center"
        >
          {day.isLocked ? (
            <span className="text-muted-foreground">{value.toLocaleString()}</span>
          ) : (
            <NumericInput
              value={value}
              onValueChange={(raw) => onIssuanceChange(day.key, mode, col.api, raw)}
              className={CELL_INPUT_CLASS}
            />
          )}
        </td>
      );
    });

  return (
    <div
      className="w-full max-w-full overflow-auto rounded-lg border border-grid shadow-soft"
      style={{ maxHeight: "74vh" }}
    >
      <table className="min-w-max border-separate border-spacing-0 text-[11px] text-foreground">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              rowSpan={3}
              className={`sticky left-0 top-0 z-40 min-w-[96px] border-b border-r px-3 py-2 text-center align-middle text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerPrimary}`}
            >
              Action
            </th>
            <th
              rowSpan={3}
              className={`sticky left-[96px] top-0 z-40 min-w-[180px] border-b border-r px-3 py-2 text-center align-middle text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerPrimary}`}
            >
              Date
            </th>
            <th
              colSpan={inspectionColspan}
              className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerSoft}`}
            >
              {inspectionLabel}
            </th>
            <th
              rowSpan={3}
              className={`sticky top-0 z-30 border-b border-r px-2 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[90px] ${MONITORING_THEME.headerSoft}`}
            >
              Mode of
              <br />
              Issuance
            </th>
            {groups.map((g) => (
              <th
                key={g.label}
                colSpan={g.cols.length}
                className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerSoft}`}
              >
                {g.label}
              </th>
            ))}
            <th
              rowSpan={3}
              className={`sticky top-0 z-30 border-b border-r px-3 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[70px] ${MONITORING_THEME.headerPrimary}`}
            >
              Total
            </th>
          </tr>
          <tr>
            {inspectionCols.map((col) => (
              <th
                key={col.api}
                rowSpan={col.target ? 1 : 2}
                colSpan={col.target ? 2 : 1}
                className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[72px] ${MONITORING_THEME.headerSofter}`}
              >
                {col.label}
              </th>
            ))}
            {issuanceCols.map((col) => (
              <th
                key={col.api}
                rowSpan={2}
                className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[72px] ${MONITORING_THEME.headerSofter}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
          <tr>
            {inspectionCols
              .filter((col) => col.target)
              .flatMap((col) => [
                <th
                  key={`${col.api}__target`}
                  className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                >
                  Target
                </th>,
                <th
                  key={`${col.api}__accomplished`}
                  className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                >
                  <span className="block leading-[1.1]">accomplished</span>
                </th>,
              ])}
          </tr>
        </thead>
        <tbody>
          {days.map((day, dayIndex) => {
            const zebra = dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd;
            const total = rowTotal(day);
            const rev = day.rev;
            const showRevisionAction = rev.pending || rev.needsRequest;

            return (
              <React.Fragment key={day.key}>
                <tr className={zebra}>
                  <td
                    rowSpan={2}
                    className={`sticky left-0 z-20 min-w-[96px] border-b border-r px-2 py-1.5 align-middle text-center ${zebra}`}
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
                              if (rev.req) onCancelRevision(rev.req.requestno);
                              else toast.info("No active revision request to cancel.");
                            }}
                          />
                          <DeleteButton
                            variant="square"
                            tooltip="Delete Revision Request"
                            ariaLabel="Delete Revision Request"
                            icon={<Trash2 className="h-4 w-4" />}
                            onClick={() => {
                              if (rev.req) onDeleteRevision(rev.req.requestno);
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
                            onClick={() => onRequestRevision(day)}
                          />
                        </div>
                      )
                    ) : null}
                  </td>
                  <td
                    rowSpan={2}
                    className={`sticky left-[96px] z-20 border-b border-r px-3 py-1.5 align-middle text-[11px] font-semibold ${zebra}`}
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {day.isLocked && <Lock className="h-3 w-3 shrink-0 text-warning" />}
                      <span
                        className={
                          total > 0 ? "text-primary-700 dark:text-primary-300 font-semibold" : ""
                        }
                      >
                        {day.label}
                      </span>
                    </div>
                  </td>

                  {inspectionCols.flatMap((col) => {
                    const value = num(day.inspection[col.api]);
                    const cells: React.ReactNode[] = [];
                    if (col.target) {
                      cells.push(
                        <td
                          key={`${col.api}__target`}
                          rowSpan={2}
                          className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums text-muted-foreground"
                        >
                          {num(day.inspection[col.target]).toLocaleString()}
                        </td>,
                      );
                    }
                    cells.push(
                      <td
                        key={col.api}
                        rowSpan={2}
                        className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle"
                      >
                        {day.isLocked ? (
                          <span className="text-muted-foreground">{value.toLocaleString()}</span>
                        ) : (
                          <NumericInput
                            value={value}
                            onValueChange={(raw) => onInspectionChange(day.key, col.api, raw)}
                            className={CELL_INPUT_CLASS}
                          />
                        )}
                      </td>,
                    );
                    return cells;
                  })}

                  <td
                    className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}
                  >
                    MANUAL
                  </td>
                  {issuanceCells(day, "manual")}

                  <td
                    rowSpan={2}
                    className="border-b border-r px-3 py-1.5 text-center align-middle font-semibold tabular-nums"
                  >
                    {total.toLocaleString()}
                  </td>
                </tr>

                <tr className={zebra}>
                  <td
                    className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}
                  >
                    FSIS
                  </td>
                  {issuanceCells(day, "fsis")}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 z-20">
          <tr className="total-row font-bold text-foreground">
            <td className="sticky left-0 z-30 border-r border-t-2 border-grid-strong total-row px-3 py-2" />
            <td className="sticky left-[96px] z-30 border-r border-t-2 border-grid-strong total-row px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">
              Total
            </td>
            {inspectionCols.flatMap((col) => {
              const cells: React.ReactNode[] = [];
              if (col.target) {
                const targetField = col.target;
                cells.push(
                  <td
                    key={`${col.api}__target`}
                    className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums text-muted-foreground"
                  >
                    {days
                      .reduce((sum, d) => sum + num(d.inspection[targetField]), 0)
                      .toLocaleString()}
                  </td>,
                );
              }
              cells.push(
                <td
                  key={col.api}
                  className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                >
                  {days.reduce((sum, d) => sum + num(d.inspection[col.api]), 0).toLocaleString()}
                </td>,
              );
              return cells;
            })}
            <td className="border-r border-t-2 border-grid-strong total-row px-2 py-2" />
            {issuanceCols.map((col) => (
              <td
                key={col.api}
                className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
              >
                {days
                  .reduce((sum, d) => sum + num(d.manual[col.api]) + num(d.fsis[col.api]), 0)
                  .toLocaleString()}
              </td>
            ))}
            <td className="border-r border-t-2 border-grid-strong total-row-strong px-3 py-2 text-center text-[11px] font-bold tabular-nums">
              {days.reduce((sum, d) => sum + rowTotal(d), 0).toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Presentational helpers                                                     */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={
        onToggle
          ? "flex items-center justify-between gap-3 cursor-pointer select-none"
          : "flex items-center justify-between gap-3"
      }
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      aria-expanded={onToggle ? expanded : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        {onToggle && (
          <ToggleIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Route + Modal exports                                                     */
/* -------------------------------------------------------------------------- */

export default function ComplianceEditPage() {
  const { stationno = "", year = "", month = "" } = useParams();
  const navigate = useNavigate();
  const y = Number(year);
  const m = Number(month);
  const monthName = MONTHS.find((mo) => mo.value === m)?.name ?? m;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance Editor</h1>
            <p className="text-sm text-muted-foreground">
              {stationno} — {monthName} {y}
            </p>
          </div>
        </div>
      </div>

      <ComplianceEditBody
        stationno={stationno}
        year={y}
        month={m}
        onSaved={() => navigate("/monitoring")}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

export function ComplianceEditModal({
  open,
  onOpenChange,
  stationno,
  year,
  month,
  stationName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stationno: string;
  year: number;
  month: number;
  stationName?: string;
  onSaved?: () => void;
}) {
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Fire Safety Compliance Editor
              </DialogTitle>
              <DialogDescription>
                {stationName ? `${stationName} · ` : ""}
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

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
          {open ? (
            <ComplianceEditBody
              stationno={stationno}
              year={year}
              month={month}
              onSaved={() => {
                onSaved?.();
                onOpenChange(false);
              }}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
