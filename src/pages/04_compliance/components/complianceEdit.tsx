import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Loader2,
  FilePen,
  Save,
  Table2,
  Lock,
  Trash2,
  Ban,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import { Textarea } from "@/components/ui/textarea";
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
import { CATEGORY_FIELDS } from "@/lib/complianceHelpers";
import { MONITORING_THEME } from "./complianceTheme";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import RevisionStatusBadge from "@/pages/06_target-reference/revision/RevisionStatusBadge";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";

import { complianceAPI } from "@/services/complianceAPI";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type { ComplianceDailyCounts } from "@/types/complianceType";
import type {
  FSISComplianceMonthlyLedgerModel,
  FSISComplianceDailyClass,
  FSISIssuanceClassModel,
  FSISIssuanceClassDTO,
  FSISComplianceDetailModel,
  FSISComplianceDTO,
  FSISComplianceClass,
  } from "@/types/complianceType";

import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

/* ========================================================================== */
/*  Shared field definitions (mirror from monitoringView CATEGORY_FIELDS)   */
/* ========================================================================== */

const CATEGORY_ORDER = ["INSPECTION", "FSEC", "FSIC", "NOTICES"] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: CATEGORY_FIELDS[category],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

// Unified spreadsheet palette — every group and sub-group shares the same
// primary color family (see monitoringTheme.ts). Category distinction is
// preserved by grouping/labels, not by mixing unrelated hues.
const GROUP_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSoft,
  FSEC: MONITORING_THEME.headerSoft,
  FSIC: MONITORING_THEME.headerSoft,
  NOTICES: MONITORING_THEME.headerSoft,
};

const SUB_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSofter,
  FSEC: MONITORING_THEME.headerSofter,
  FSIC: MONITORING_THEME.headerSofter,
  NOTICES: MONITORING_THEME.headerSofter,
};

const FIELD_CATEGORY = new Map<string, (typeof CATEGORY_ORDER)[number]>(
  FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [String(f.key), g.category] as const)),
);

/* ========================================================================== */
/*  Detail API shapes (per-day records)                                      */
/* ========================================================================== */

interface FSISComplianceDetailItem {
  fsisno: string;
  dateinspected: string | Date;
  remarks?: string | null;

  dailytargetbplo?: number | null;
  dailytargetgov?: number | null;
  dailytargetpeza?: number | null;
  dailytargettieza?: number | null;

  inspectduringcount?: number | null;
  inspectaftercount?: number | null;
  inspectbplocount?: number | null;
  inspectgovcount?: number | null;
  inspectpezacount?: number | null;
  inspecttiezacount?: number | null;

  fsecbuildingcount?: number | null;
  fsecgovcount?: number | null;
  fsecpezacount?: number | null;
  fsectiezacount?: number | null;

  fsicoccupancycount?: number | null;
  fsicbplonewcount?: number | null;
  fsicbplorenewcount?: number | null;
  fsicgovcount?: number | null;
  fsicpezacount?: number | null;
  fsictiezacount?: number | null;

  nodcount?: number | null;
  ntccount?: number | null;
  ntcvcount?: number | null;
  abatementcount?: number | null;
  closurecount?: number | null;
}

interface FSISComplianceDetailStation {
  stationno: string;
  stationname?: string;
  provincename?: string;
  provinceno?: string;
  month?: number;
  year?: number;

  totaltargetbplo?: number;
  totaltargetgov?: number;
  totaltargetpeza?: number;
  totaltargettieza?: number;
  totalAccomplishmentbplo?: number;
  totalAccomplishmentgov?: number;
  totalAccomplishmentpeza?: number;
  totalAccomplishmenttieza?: number;

  complianceDetailList?: FSISComplianceDetailItem[] | null;
}

const FIELD_TO_API: Record<string, keyof FSISComplianceDetailItem> = {
  insp_during: "inspectduringcount",
  insp_after: "inspectaftercount",
  insp_bplo: "inspectbplocount",
  insp_gov: "inspectgovcount",
  insp_peza: "inspectpezacount",
  insp_tieza: "inspecttiezacount",
  fsec_building: "fsecbuildingcount",
  fsec_gov: "fsecgovcount",
  fsec_peza: "fsecpezacount",
  fsec_tieza: "fsectiezacount",
  fsic_occupancy: "fsicoccupancycount",
  fsic_bplo_new: "fsicbplonewcount",
  fsic_bplo_renewal: "fsicbplorenewcount",
  fsic_gov: "fsicgovcount",
  fsic_peza: "fsicpezacount",
  fsic_tieza: "fsictiezacount",
  not_nod: "nodcount",
  not_ntc: "ntccount",
  not_ntcv: "ntcvcount",
  not_abatement: "abatementcount",
  not_closure: "closurecount",
};

/**
 * Inspection fields that render a read-only Target column beside their
 * editable Compliance column (mirrors the View screen).
 */
const INSP_TARGET_FIELDS: Record<string, keyof FSISComplianceDetailItem> = {
  insp_bplo: "dailytargetbplo",
  insp_gov: "dailytargetgov",
  insp_peza: "dailytargetpeza",
  insp_tieza: "dailytargettieza",
};

/** Total inspection header columns once Target/Compliance splits are counted. */
const INSPECTION_COLSPAN = CATEGORY_FIELDS.INSPECTION.reduce(
  (n, f) => n + (INSP_TARGET_FIELDS[String(f.key)] ? 2 : 1),
  0,
);

type DayTotals = Partial<Record<keyof ComplianceDailyCounts, number>>;

interface EditableIssuance {
  issuanceno: string;
  fsicmode: number;
  fsecbuildingcount: number;
  fsecgovcount: number;
  fsecpezacount: number;
  fsectiezacount: number;
  fsicoccupancycount: number;
  fsicbplonewcount: number;
  fsicbplorenewcount: number;
  fsicgovcount: number;
  fsicpezacount: number;
  fsictiezacount: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
}

interface EditableDay {
  day: number;
  label: string;
  key: string;
  inspection: FSISComplianceDetailItem;
  manual: EditableIssuance;
  fsis: EditableIssuance;
  isLocked: boolean;
  editablestatus: number;
  isrevisionrequest: boolean;
  totals: DayTotals;
}

function toLocalKey(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
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

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * PST lock activation — mirrors Target Reference.
 * A month locks on day 4 of the following calendar month at 00:00 PST.
 */
function hasPstLockActivated(reportyear: number, reportmonth: number, now: Date = new Date()): boolean {
  const y = Number(reportyear);
  const m = Number(reportmonth);
  if (!y || !m || m < 1 || m > 12) return false;
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const lockActivationMs = Date.UTC(y, m /* next month, 0-indexed */, 4, 0, 0, 0);
  return manilaNowMs >= lockActivationMs;
}

/**
 * Check if a given date has already passed (is before today at midnight).
 */
function isDayPassed(dateStr: string): boolean {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
}

/**
 * Build editable day structure from Monthly API response.
 * Creates one entry per calendar day, loading data from API list or empty.
 * Separates inspection data from MANUAL and FSIS issuance data.
 */
function buildEditableDays(
  list: Array<FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>> | null | undefined,
  year: number,
  month: number,
): Map<string, EditableDay> {
  const map = new Map<string, EditableDay>();

  // Index API data by date
  const dataByDate = new Map<string, FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>>();
  if (Array.isArray(list)) {
    for (const item of list) {
      const key = normalizeDateKey(item?.dateinspected);
      if (key) dataByDate.set(key, item);
    }
  }

  const total = daysInMonth(year, month);
  const monthName = MONTHS[month - 1]?.name ?? "";

  const defaultIssuance = (): EditableIssuance => ({
    issuanceno: EMPTY_GUID,
    fsicmode: 0,
    fsecbuildingcount: 0,
    fsecgovcount: 0,
    fsecpezacount: 0,
    fsectiezacount: 0,
    fsicoccupancycount: 0,
    fsicbplonewcount: 0,
    fsicbplorenewcount: 0,
    fsicgovcount: 0,
    fsicpezacount: 0,
    fsictiezacount: 0,
    nodcount: 0,
    ntccount: 0,
    ntcvcount: 0,
    abatementcount: 0,
    closurecount: 0,
  });

  for (let d = 1; d <= total; d++) {
    const key = toLocalKey(year, month, d);
    const label = `${monthName} ${d}, ${year}`;
    const apiData = dataByDate.get(key);

    // Extract inspection data
    const inspection: FSISComplianceDetailItem = apiData
      ? {
          fsisno: apiData.fsisno ?? EMPTY_GUID,
          dateinspected: apiData.dateinspected ?? key,
          remarks: apiData.remarks ?? "",
          dailytargetbplo: num(apiData.dailytargetbplo),
          dailytargetgov: num(apiData.dailytargetgov),
          dailytargetpeza: num(apiData.dailytargetpeza),
          dailytargettieza: num(apiData.dailytargettieza),
          inspectduringcount: num(apiData.inspectduringcount),
          inspectaftercount: num(apiData.inspectaftercount),
          inspectbplocount: num(apiData.inspectbplocount),
          inspectgovcount: num(apiData.inspectgovcount),
          inspectpezacount: num(apiData.inspectpezacount),
          inspecttiezacount: num(apiData.inspecttiezacount),
        }
      : {
          fsisno: EMPTY_GUID,
          dateinspected: key,
          remarks: "",
          dailytargetbplo: 0,
          dailytargetgov: 0,
          dailytargetpeza: 0,
          dailytargettieza: 0,
          inspectduringcount: 0,
          inspectaftercount: 0,
          inspectbplocount: 0,
          inspectgovcount: 0,
          inspectpezacount: 0,
          inspecttiezacount: 0,
        };

    // Extract issuance data per mode
    let manual = defaultIssuance();
    let fsis = defaultIssuance();

    if (apiData && Array.isArray(apiData.issuancelist)) {
      for (const iss of apiData.issuancelist) {
        const mode = num(iss?.fsicmode);
        const issuanceData: EditableIssuance = {
          issuanceno: (iss?.issuanceno as string) ?? EMPTY_GUID,
          fsicmode: mode,
          fsecbuildingcount: num(iss?.fsecbuildingcount),
          fsecgovcount: num(iss?.fsecgovcount),
          fsecpezacount: num(iss?.fsecpezacount),
          fsectiezacount: num(iss?.fsectiezacount),
          fsicoccupancycount: num(iss?.fsicoccupancycount),
          fsicbplonewcount: num(iss?.fsicbplonewcount),
          fsicbplorenewcount: num(iss?.fsicbplorenewcount),
          fsicgovcount: num(iss?.fsicgovcount),
          fsicpezacount: num(iss?.fsicpezacount),
          fsictiezacount: num(iss?.fsictiezacount),
          nodcount: num(iss?.nodcount),
          ntccount: num(iss?.ntccount),
          ntcvcount: num(iss?.ntcvcount),
          abatementcount: num(iss?.abatementcount),
          closurecount: num(iss?.closurecount),
        };

        if (mode === 96) manual = issuanceData;
        if (mode === 97) fsis = issuanceData;
      }
    }

    // Compute totals from all fields
    const totals: DayTotals = {};
    for (const field of DETAIL_FIELDS) {
      if (field.key.startsWith("insp_")) {
        const apiKey = FIELD_TO_API[String(field.key)];
        if (apiKey) {
          totals[field.key as keyof ComplianceDailyCounts] = num(inspection[apiKey]);
        }
      } else {
        const manualKey = FIELD_TO_API[String(field.key)] as keyof EditableIssuance | undefined;
        if (manualKey && manualKey in manual) {
          totals[field.key as keyof ComplianceDailyCounts] =
            num((manual as any)[manualKey]) + num((fsis as any)[manualKey]);
        }
      }
    }

    const editablestatus = num((apiData as any)?.editablestatus);
    const isrevisionrequest = Boolean((apiData as any)?.isrevisionrequest);
    const locked =
      editablestatus === 153
        ? false
        : hasPstLockActivated(year, month) || isDayPassed(key);

    const entry: EditableDay = {
      day: d,
      label,
      key,
      inspection,
      manual,
      fsis,
      isLocked: locked,
      totals,
      editablestatus,
      isrevisionrequest,
    };
    map.set(key, entry);
  }

  return map;
}

/* ========================================================================== */
/*  Editor body — per-day editable table                                     */
/* ========================================================================== */

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
  const [confirmLeave, setConfirmLeave] = React.useState<null | "cancel">(null);
  const [revisionOpen, setRevisionOpen] = React.useState(false);
  const [revisionReferenceKey, setRevisionReferenceKey] = React.useState(EMPTY_GUID);
  const [revisionDate, setRevisionDate] = React.useState<string>("");
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const [revisionRequestRefreshTick, setRevisionRequestRefreshTick] = React.useState(0);

  // Station info from Monthly API
  const [station, setStation] = React.useState<FSISComplianceMonthlyLedgerModel | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  // Editable days indexed by YYYY-MM-DD
  const [editableDays, setEditableDays] = React.useState<Map<string, EditableDay>>(new Map());

  // Baseline to detect unsaved changes
  const [baseline, setBaseline] = React.useState<string>("");
  const [baselineMap, setBaselineMap] = React.useState<Map<string, string>>(new Map());

  const serializeDay = React.useCallback((day: EditableDay) => {
    return JSON.stringify({
      inspection: day.inspection,
      manual: day.manual,
      fsis: day.fsis,
      isLocked: day.isLocked,
    });
  }, []);

  const isDayModified = React.useCallback((originalSerialized: string, day: EditableDay) => {
    try {
      const orig = JSON.parse(originalSerialized) as {
        inspection: Partial<FSISComplianceDetailItem>;
        manual: Partial<EditableIssuance>;
        fsis: Partial<EditableIssuance>;
      };

      // Inspection fields to compare
      const inspKeys: (keyof FSISComplianceDetailItem)[] = [
        "inspectduringcount",
        "inspectaftercount",
        "inspectbplocount",
        "inspectgovcount",
        "inspectpezacount",
        "inspecttiezacount",
      ];
      for (const k of inspKeys) {
        const o = Number(orig.inspection?.[k] ?? 0);
        const n = Number(day.inspection?.[k] ?? 0);
        if (o !== n) return true;
      }
      const oRemarks = String(orig.inspection?.remarks ?? "");
      const nRemarks = String(day.inspection?.remarks ?? "");
      if (oRemarks !== nRemarks) return true;

      // Issuance numeric keys to compare
      const issKeys: (keyof EditableIssuance)[] = [
        "fsecbuildingcount",
        "fsecgovcount",
        "fsecpezacount",
        "fsectiezacount",
        "fsicoccupancycount",
        "fsicbplonewcount",
        "fsicbplorenewcount",
        "fsicgovcount",
        "fsicpezacount",
        "fsictiezacount",
        "nodcount",
        "ntccount",
        "ntcvcount",
        "abatementcount",
        "closurecount",
      ];

      for (const k of issKeys) {
        const oM = Number(orig.manual?.[k] ?? 0);
        const nM = Number((day.manual as any)[k] ?? 0);
        if (oM !== nM) return true;
        const oF = Number(orig.fsis?.[k] ?? 0);
        const nF = Number((day.fsis as any)[k] ?? 0);
        if (oF !== nF) return true;
      }

      // issuanceno changes should count as modification
      const oManIss = String(orig.manual?.issuanceno ?? "");
      const nManIss = String(day.manual.issuanceno ?? "");
      if (oManIss !== nManIss) return true;
      const oFsisIss = String(orig.fsis?.issuanceno ?? "");
      const nFsisIss = String(day.fsis.issuanceno ?? "");
      if (oFsisIss !== nFsisIss) return true;

      // No meaningful changes detected
      return false;
    } catch {
      return true; // if we can't parse original, assume changed
    }
  }, []);

  const currentSnapshot = React.useMemo(
    () => JSON.stringify(Array.from(editableDays.entries())),
    [editableDays],
  );
  const isDirty = !loading && baseline !== "" && currentSnapshot !== baseline;

  // ------- Revision request state (from the live API) -------
  const [revisionRequestState, setRevisionRequestState] = React.useState<{
    requestno: string;
    statuscode?: string;
    statusname?: string;
  } | null>(null);
  React.useEffect(() => {
    if (!stationno || !year || !month) {
      setRevisionRequestState(null);
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
          requesttype: "ISSUANCE",
          pagenumber: 1,
          pagesize: 20,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<[{ requestno: string; statuscode?: string; statusname?: string }]>(resp);
      if (ok && Array.isArray(data) && data.length > 0) {
        setRevisionRequestState(data[0]);
      } else {
        setRevisionRequestState(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month, provinceno, revisionRequestRefreshTick]);
  const latestReq = revisionRequestState;
  const latestReqStatus = latestReq?.statuscode?.toUpperCase() === "PENDING"
    ? "PENDING"
    : latestReq?.statuscode?.toUpperCase() === "APPROVED"
      ? "APPROVED"
      : latestReq?.statuscode?.toUpperCase() === "CANCELLED"
        ? "CANCELLED"
        : null;
  const activeReq = latestReqStatus === "PENDING" || latestReqStatus === "APPROVED" ? latestReq : null;
  const activeReqStatus = activeReq ? latestReqStatus : null;
  const isApproved = activeReqStatus === "APPROVED";
  const isPending = activeReqStatus === "PENDING";
  const isOwnPending = isPending;
  const monthLocked = isReportMonthLocked(year, month);
  // When an APPROVED request is active, the whole month is temporarily
  // unlocked — override per-day locks for rendering and save gating.
  const revisionUnlocks = isApproved;

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
      const prov = seed?.provinceno ?? EMPTY_GUID;
      if (cancelled) return;
      setProvinceno(prov);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno]);

  // Fetch Detail when provinceno is ready
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

      const { ok, data, error } = unwrap<FSISComplianceDetailModel | FSISComplianceDetailModel[]>(resp);
      if (!ok) toast.error(error || "Failed to load monthly data.");
      const station = ok
        ? (Array.isArray(data) ? (data[0] ?? null) : (data ?? null))
        : null;
      const first = station ? {
        stationno: String(station?.stationno ?? ""),
        stationcode: String(station?.stationcode ?? ""),
        stationname: String(station?.stationname ?? ""),
        regionno: "",
        regioncode: "",
        regionname: "",
        provinceno: String(station?.provinceno ?? ""),
        provincename: String(station?.provincename ?? ""),
        cityno: "",
        zipcode: "",
        cityname: String(station?.cityname ?? ""),
        barangayno: "",
        barangayname: "",
        streetaddress: "",
        logourl: String(station?.logourl ?? ""),
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
        updatedby: "",
        encodedby: "",
        complianceLedgerList: (Array.isArray(station?.compliancelist) ? station.compliancelist : []).map((rec) => ({
          ...rec,
          fsisno: String((rec as { fsisno?: string }).fsisno ?? ""),
          dailytargetbplo: Number((rec as { dailytargetbplo?: number }).dailytargetbplo ?? 0) || 0,
          dailytargetgov: Number((rec as { dailytargetgov?: number }).dailytargetgov ?? 0) || 0,
          dailytargetpeza: Number((rec as { dailytargetpeza?: number }).dailytargetpeza ?? 0) || 0,
          dailytargettieza: Number((rec as { dailytargettieza?: number }).dailytargettieza ?? 0) || 0,
          inspectduringcount: Number((rec as { inspectduringcount?: number }).inspectduringcount ?? 0) || 0,
          inspectaftercount: Number((rec as { inspectaftercount?: number }).inspectaftercount ?? 0) || 0,
          inspectbplocount: Number((rec as { inspectbplocount?: number }).inspectbplocount ?? 0) || 0,
          inspectgovcount: Number((rec as { inspectgovcount?: number }).inspectgovcount ?? 0) || 0,
          inspectpezacount: Number((rec as { inspectpezacount?: number }).inspectpezacount ?? 0) || 0,
          inspecttiezacount: Number((rec as { inspecttiezacount?: number }).inspecttiezacount ?? 0) || 0,
          remarks: String((rec as { remarks?: string }).remarks ?? ""),
          dateinspected: String((rec as { dateinspected?: string }).dateinspected ?? ""),
          issuancelist: Array.isArray((rec as { issuancelist?: unknown[] }).issuancelist) ? ((rec as { issuancelist?: unknown[] }).issuancelist as unknown[]) : [],
        })) as FSISComplianceMonthlyLedgerModel["complianceLedgerList"],
      } : null;

      setStation(first);

      const days = buildEditableDays(first?.complianceLedgerList, year, month);
      setEditableDays(days);
      setBaseline(JSON.stringify(Array.from(days.entries())));
      setBaselineMap(
        new Map(
          Array.from(days.entries()).map(([dayKey, day]) => [dayKey, serializeDay(day)]),
        ),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, year, month, revisionRequestRefreshTick]);

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
      setConfirmLeave("cancel");
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

  const updateDayField = (
    dayKey: string,
    fieldKey: string,
    raw: string,
    issuanceMode: "manual" | "fsis" | "inspection",
  ) => {
    setEditableDays((prev) => {
      const newMap = new Map(prev);
      const day = newMap.get(dayKey);
      if (!day) return prev;

      const cleaned = raw.replace(/[^0-9]/g, "");
      const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);

      const apiKey = FIELD_TO_API[fieldKey] as
        keyof (FSISComplianceDetailItem | EditableIssuance) | undefined;
      if (!apiKey) return prev;

      const updated = { ...day };

      if (issuanceMode === "inspection") {
        updated.inspection = { ...day.inspection, [apiKey]: value };
      } else if (issuanceMode === "manual") {
        updated.manual = { ...day.manual, [apiKey]: value };
      } else if (issuanceMode === "fsis") {
        updated.fsis = { ...day.fsis, [apiKey]: value };
      }

      // Recompute totals
      const totals: DayTotals = {};
      for (const f of DETAIL_FIELDS) {
        if (f.key.startsWith("insp_")) {
          const key = FIELD_TO_API[String(f.key)] as keyof FSISComplianceDetailItem;
          if (key) {
            totals[f.key as keyof ComplianceDailyCounts] = num(updated.inspection[key]);
          }
        } else {
          const key = FIELD_TO_API[String(f.key)] as keyof EditableIssuance;
          if (key && key in updated.manual && key in updated.fsis) {
            totals[f.key as keyof ComplianceDailyCounts] =
              num((updated.manual as any)[key]) + num((updated.fsis as any)[key]);
          }
        }
      }
      updated.totals = totals;

      newMap.set(dayKey, updated);
      return newMap;
    });
  };

  const updateDayRemarks = (dayKey: string, remarks: string) => {
    setEditableDays((prev) => {
      const newMap = new Map(prev);
      const day = newMap.get(dayKey);
      if (!day) return prev;
      const newInspection = { ...day.inspection, remarks: remarks.slice(0, 1000) };
      newMap.set(dayKey, { ...day, inspection: newInspection });
      return newMap;
    });
  };

  /* --------------------------------- Save -------------------------------- */

  const handleSave = async () => {
    setSaveError(null);
    if (!station) {
      setSaveError("No record loaded.");
      return;
    }

    // Check if entire month is locked (approved revision temporarily unlocks it)
    if (!revisionUnlocks && isReportMonthLocked(year, month)) {
      setSaveError("This reporting month is locked and cannot be edited.");
      return;
    }
    if (isPending) {
      setSaveError("A revision request is pending review. Editing is disabled until it is approved.");
      return;
    }

    setSaving(true);
    try {
      // Prepare updates for the full reporting month.
      // Send every day from the 1st through the last day, with zero/empty
      // values for unchanged rows and `isaccomplished: true` only for
      // rows that were actually modified.
      const updates: FSISComplianceClass[] = [];
      let hasAnyChange = false;

      for (const [, day] of editableDays) {
        const original = baselineMap.get(day.key);
        const isRowModified = !original || isDayModified(original, day);
        if (isRowModified) {
          hasAnyChange = true;
        }

        // Reconstruct issuancelist with MANUAL (96) and FSIS (97) modes.
        // Always send both entries so the update payload matches the create structure.
        const issuancelist: FSISIssuanceClassDTO[] = [
          {
            issuanceno: day.manual.issuanceno || EMPTY_GUID,
            fsicmode: 96,
            fsecbuildingcount: day.manual.fsecbuildingcount,
            fsecgovcount: day.manual.fsecgovcount,
            fsecpezacount: day.manual.fsecpezacount,
            fsectiezacount: day.manual.fsectiezacount,
            fsicoccupancycount: day.manual.fsicoccupancycount,
            fsicbplonewcount: day.manual.fsicbplonewcount,
            fsicbplorenewcount: day.manual.fsicbplorenewcount,
            fsicgovcount: day.manual.fsicgovcount,
            fsicpezacount: day.manual.fsicpezacount,
            fsictiezacount: day.manual.fsictiezacount,
            nodcount: day.manual.nodcount,
            ntccount: day.manual.ntccount,
            ntcvcount: day.manual.ntcvcount,
            abatementcount: day.manual.abatementcount,
            closurecount: day.manual.closurecount,
          },
          {
            issuanceno: day.fsis.issuanceno || EMPTY_GUID,
            fsicmode: 97,
            fsecbuildingcount: day.fsis.fsecbuildingcount,
            fsecgovcount: day.fsis.fsecgovcount,
            fsecpezacount: day.fsis.fsecpezacount,
            fsectiezacount: day.fsis.fsectiezacount,
            fsicoccupancycount: day.fsis.fsicoccupancycount,
            fsicbplonewcount: day.fsis.fsicbplonewcount,
            fsicbplorenewcount: day.fsis.fsicbplorenewcount,
            fsicgovcount: day.fsis.fsicgovcount,
            fsicpezacount: day.fsis.fsicpezacount,
            fsictiezacount: day.fsis.fsictiezacount,
            nodcount: day.fsis.nodcount,
            ntccount: day.fsis.ntccount,
            ntcvcount: day.fsis.ntcvcount,
            abatementcount: day.fsis.abatementcount,
            closurecount: day.fsis.closurecount,
          },
        ];

        const item: FSISComplianceClass = {
          fsisno: day.inspection.fsisno || EMPTY_GUID,
          dateinspected: day.key,
          inspectduringcount: day.inspection.inspectduringcount ?? 0,
          inspectaftercount: day.inspection.inspectaftercount ?? 0,
          inspectbplocount: day.inspection.inspectbplocount ?? 0,
          inspectgovcount: day.inspection.inspectgovcount ?? 0,
          inspectpezacount: day.inspection.inspectpezacount ?? 0,
          inspecttiezacount: day.inspection.inspecttiezacount ?? 0,
          remarks: (day.inspection.remarks ?? "").trim(),
          issuancelist,
          isaccomplished: isRowModified,
        };
        updates.push(item);
      }

      if (!hasAnyChange) {
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
      if (revisionUnlocks && activeReq) {
        setRevisionRequestRefreshTick((n) => n + 1);
      }
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

  // When an APPROVED revision is active, treat all days as unlocked;
  // when PENDING, force every day locked so no edits happen.
  const rawDays = Array.from(editableDays.values());
  const days = rawDays.map((d) => {
    if (revisionUnlocks) return { ...d, isLocked: false };
    if (isPending) return { ...d, isLocked: true };
    return d;
  });
  const allLocked = days.length > 0 && days.every((d) => d.isLocked);

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Station Information ------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Station</span>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
              <span className="truncate">{station?.stationname || "—"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Province</span>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
              <span className="truncate">{station?.provincename || "—"}</span>
            </div>
          </div>
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

      {/* Daily Compliance Details ------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            title="Daily Compliance Details"
            subtitle="Per-day inspection and issuance tracking"
          />
          <div className="rounded-md border border-border/70 bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {monthName} {year}
          </div>
        </div>

        <TargetAccomplishmentPanel
          stationno={stationno}
          year={year}
          month={month}
          data={
            station
              ? {
                  stationno: station.stationno,
                  month: station.month ?? month,
                  year: station.year ?? year,
                  totaltargetbplo: num(station.totaltargetbplo),
                  totaltargetgov: num(station.totaltargetgov),
                  totaltargetpeza: num(station.totaltargetpeza),
                  totaltargettieza: num(station.totaltargettieza),
                  totalAccomplishmentbplo: num(station.totalAccomplishmentbplo),
                  totalAccomplishmentgov: num(station.totalAccomplishmentgov),
                  totalAccomplishmentpeza: num(station.totalAccomplishmentpeza),
                  totalAccomplishmenttieza: num(station.totalAccomplishmenttieza),
                }
              : null
          }
        />

        {/* Daily table — spreadsheet-style, scrolls in both axes */}
        <div
          className="w-full max-w-full overflow-auto rounded-md border border-grid shadow-soft"
          style={{ maxHeight: "70vh" }}
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
                  colSpan={INSPECTION_COLSPAN}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.INSPECTION}`}
                >
                  Inspection
                </th>
                <th
                  rowSpan={3}
                  className={`sticky top-0 z-30 border-b border-r px-2 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[90px] ${MONITORING_THEME.headerSoft}`}
                >
                  Mode of
                  <br />
                  Issuance
                </th>
                <th
                  colSpan={4}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.FSEC}`}
                >
                  FSEC
                </th>
                <th
                  colSpan={6}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.FSIC}`}
                >
                  FSIC
                </th>
                <th
                  colSpan={5}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.NOTICES}`}
                >
                  Other Notices
                </th>
                <th
                  rowSpan={3}
                  className={`sticky top-0 z-30 border-b border-r px-3 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[70px] ${MONITORING_THEME.headerPrimary}`}
                >
                  Total
                </th>
                <th
                  rowSpan={3}
                  className={`sticky top-0 z-30 border-b border-l px-3 py-1.5 text-left align-middle text-[11px] font-bold uppercase tracking-wider min-w-[160px] ${MONITORING_THEME.headerSoft}`}
                >
                  Remarks
                </th>
              </tr>
              <tr>
                {DETAIL_FIELDS.map((field) => {
                  const key = String(field.key);
                  const cat = FIELD_CATEGORY.get(key) ?? "INSPECTION";
                  const split = Boolean(INSP_TARGET_FIELDS[key]);
                  return (
                    <th
                      key={key}
                      rowSpan={split ? 1 : 2}
                      colSpan={split ? 2 : 1}
                      className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[60px] ${SUB_TONE[cat]}`}
                    >
                      {field.label}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {DETAIL_FIELDS.filter((f) => INSP_TARGET_FIELDS[String(f.key)]).flatMap((field) => {
                  const key = String(field.key);
                  return [
                    <th
                      key={`${key}__target`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[56px] w-[56px] ${SUB_TONE.INSPECTION}`}
                    >
                      Target
                    </th>,
                    <th
                      key={`${key}__compliance`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[56px] w-[56px] ${SUB_TONE.INSPECTION}`}
                    >
                      Compliance
                    </th>,
                  ];
                })}
              </tr>
            </thead>
            <tbody>
              {days.map((dayEntry, dayIndex) => {
                const rowTotal = DETAIL_FIELDS.reduce(
                  (sum, f) => sum + num(dayEntry.totals[f.key as keyof ComplianceDailyCounts]),
                  0,
                );
                const hasRevisionRequest = dayEntry.isrevisionrequest || Boolean(activeReq);
                const showRevisionAction = dayEntry.isLocked || hasRevisionRequest;
                const showRevisionStatus = showRevisionAction || Boolean(latestReqStatus);
                return (
                  <React.Fragment key={dayEntry.key}>
                    {/* MANUAL row */}
                    <tr className={dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd}>
                      <td
                        rowSpan={2}
                        className={`sticky left-0 z-20 min-w-[96px] border-b border-r px-2 py-1.5 align-middle text-center ${dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd}`}
                      >
                        {showRevisionAction ? (
                          hasRevisionRequest ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <EditButton
                                variant="square"
                                tooltip="Cancel Revision Request"
                                ariaLabel="Cancel Revision Request"
                                icon={<Ban className="h-4 w-4" />}
                                onClick={() => {
                                  if (activeReq) setCancelRequestId(activeReq.requestno);
                                  else toast.info("No active revision request to cancel.");
                                }}
                              />
                              <DeleteButton
                                variant="square"
                                tooltip="Delete Revision Request"
                                ariaLabel="Delete Revision Request"
                                icon={<Trash2 className="h-4 w-4" />}
                                onClick={() => {
                                  if (activeReq) setDeleteRequestId(activeReq.requestno);
                                  else toast.info("No revision request to delete.");
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <EditButton
                                variant="square"
                                tooltip={!stationno ? "Select a station to request a revision" : "Request Revision"}
                                ariaLabel={!stationno ? "Select a station to request a revision" : "Request Revision"}
                                disabled={!stationno}
                                icon={<FilePen className="h-4 w-4" />}
                                onClick={() => {
                                  setRevisionReferenceKey(
                                    dayEntry.inspection.fsisno && dayEntry.inspection.fsisno !== EMPTY_GUID
                                      ? dayEntry.inspection.fsisno
                                      : EMPTY_GUID,
                                  );
                                  setRevisionDate(normalizeDateKey(dayEntry.inspection.dateinspected) || dayEntry.key);
                                  setRevisionOpen(true);
                                }}
                              />
                            </div>
                          )
                        ) : null}
                      </td>
                      <td
                        rowSpan={2}
                        className={`sticky left-[96px] z-20 border-b border-r px-3 py-1.5 align-middle text-[11px] font-semibold ${dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {dayEntry.isLocked && <Lock className="h-3 w-3 text-warning" />}
                            <span className={rowTotal > 0 ? "text-primary-700 dark:text-primary-300 font-semibold" : ""}>
                              {dayEntry.label}
                            </span>
                          </div>
                          {showRevisionStatus && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {activeReq ? (
                                <RevisionStatusBadge status={activeReqStatus ?? "PENDING"} />
                              ) : (
                                latestReqStatus && latestReqStatus !== "PENDING" ? (
                                  <RevisionStatusBadge status={latestReqStatus} />
                                ) : null
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Inspection fields */}
                      {DETAIL_FIELDS.flatMap((field) => {
                        if (!field.key.startsWith("insp_")) return [];
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num(dayEntry.inspection[apiKey]) : 0;
                        const targetKey = INSP_TARGET_FIELDS[String(field.key)];
                        const cells: React.ReactNode[] = [];
                        if (targetKey) {
                          cells.push(
                            <td
                              key={`${String(field.key)}__target`}
                              rowSpan={2}
                              className="min-w-[56px] w-[56px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums text-muted-foreground"
                            >
                              {num(dayEntry.inspection[targetKey]).toLocaleString()}
                            </td>,
                          );
                        }
                        cells.push(
                          <td
                            key={String(field.key)}
                            rowSpan={2}
                            className="min-w-[56px] w-[56px] border-b border-r px-1.5 py-1.5 text-center align-middle"
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "inspection",
                                  )
                                }
                                className="h-8 w-14 max-w-full rounded-sm border-border/70 bg-white/90 px-1 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>,
                        );
                        return cells;
                      })}
                      <td className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}>
                        MANUAL
                      </td>
                      {/* FSEC fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("fsec_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.manual as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "manual",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* FSIC fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("fsic_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.manual as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "manual",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* NOTICES fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("not_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.manual as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "manual",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      <td
                        rowSpan={2}
                        className="border-b border-r px-3 py-1.5 text-center align-middle font-semibold tabular-nums"
                      >
                        {DETAIL_FIELDS.reduce(
                          (sum, f) => sum + num(dayEntry.totals[f.key as keyof ComplianceDailyCounts]),
                          0,
                        ).toLocaleString()}
                      </td>
                      <td
                        rowSpan={2}
                        className="border-b px-2 py-1.5 text-left align-middle text-[10px]"
                      >
                        {dayEntry.isLocked ? (
                          <span className="text-muted-foreground">
                            {dayEntry.inspection.remarks || "—"}
                          </span>
                        ) : (
                          <Input
                            type="text"
                            value={dayEntry.inspection.remarks ?? ""}
                            onChange={(e) => updateDayRemarks(dayEntry.key, e.target.value)}
                            placeholder="Remarks"
                            className="h-8 w-full min-w-[160px] rounded-sm border-border/70 bg-white/90 px-2 py-1 text-[11px]"
                          />
                        )}
                      </td>
                    </tr>

                    {/* FSIS row */}
                    <tr className={dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd}>
                      {/* Inspection fields are merged with the MANUAL row above (rowSpan=2) */}

                      <td className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}>
                        FSIS
                      </td>
                      {/* FSEC fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("fsec_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.fsis as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "fsis",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* FSIC fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("fsic_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.fsis as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "fsis",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* NOTICES fields */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!field.key.startsWith("not_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const value = apiKey ? num((dayEntry.fsis as any)[apiKey]) : 0;
                        return (
                          <td
                            key={String(field.key)}
                            className={`border-b border-r px-2 py-1.5 ${dayEntry.isLocked ? "text-center" : "text-center"}`}
                          >
                            {dayEntry.isLocked ? (
                              <span className="text-muted-foreground">
                                {value.toLocaleString()}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={String(value)}
                                onChange={(e) =>
                                  updateDayField(
                                    dayEntry.key,
                                    String(field.key),
                                    e.target.value,
                                    "fsis",
                                  )
                                }
                                className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-center tabular-nums"
                              />
                            )}
                          </td>
                        );
                      })}
                      {/* Total and Remarks are merged with the MANUAL row above (rowSpan=2) */}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="total-row font-bold text-foreground">
                <td className="sticky left-0 z-30 border-r border-t-2 border-grid-strong total-row px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">
                  
                </td>
                <td className="sticky left-[96px] z-30 border-r border-t-2 border-grid-strong total-row px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">
                  Total
                </td>
                {DETAIL_FIELDS.flatMap((field, idx) => {
                  const columnTotal = days.reduce(
                    (sum, d) => sum + num(d.totals[field.key as keyof ComplianceDailyCounts]),
                    0,
                  );
                  // Insert Mode-of-Issuance spacer cell between INSPECTION (6 fields) and FSEC
                  const cells: React.ReactNode[] = [];
                  if (idx === 6) {
                    cells.push(
                      <td
                        key="__mode_spacer__"
                        className="border-r border-t-2 border-grid-strong total-row px-2 py-2"
                      />,
                    );
                  }
                  const targetKey = INSP_TARGET_FIELDS[String(field.key)];
                  if (targetKey) {
                    const targetTotal = days.reduce(
                      (sum, d) => sum + num(d.inspection[targetKey]),
                      0,
                    );
                    cells.push(
                      <td
                        key={`${String(field.key)}__target`}
                        className="min-w-[56px] w-[56px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums text-muted-foreground"
                      >
                        {targetTotal.toLocaleString()}
                      </td>,
                    );
                  }
                  cells.push(
                    <td
                      key={String(field.key)}
                      className="min-w-[56px] w-[56px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                    >
                      {columnTotal.toLocaleString()}
                    </td>,
                  );
                  return cells;
                })}
                <td className="border-r border-t-2 border-grid-strong total-row-strong px-3 py-2 text-center text-[11px] font-bold tabular-nums">
                  {days
                    .reduce(
                      (sum, d) =>
                        sum +
                        DETAIL_FIELDS.reduce(
                          (rowSum, f) => rowSum + num(d.totals[f.key as keyof ComplianceDailyCounts]),
                          0,
                        ),
                      0,
                    )
                    .toLocaleString()}
                </td>
                <td className="border-t-2 border-grid-strong total-row px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks section */}
        <div className="border-t border-border/60 pt-4">
          <label className="text-xs font-medium text-muted-foreground">
            General Remarks (applies to all days)
          </label>
          <Textarea
            rows={3}
            placeholder="Additional notes…"
            className="mt-2"
            disabled={allLocked}
          />
        </div>
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
      <div className="flex flex-wrap justify-end gap-2">
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

      <AlertDialog open={confirmLeave !== null} onOpenChange={(o) => !o && setConfirmLeave(null)}>
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
                setConfirmLeave(null);
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
            requesttype: "ISSUANCE",
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
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                Each month locks on the <span className="font-semibold">4th day of the following month at 12:00 AM (PST)</span>. The current and next month remain editable — past months require a revision request once locked.
              </p>
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
