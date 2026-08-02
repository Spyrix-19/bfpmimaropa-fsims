import * as React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import { AlertTriangle, CalendarIcon, FilePlus2, Loader2, Save, Building2 } from "lucide-react";
import { toast } from "@/lib/toast";

import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";

import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MONITORING_THEME } from "./complianceTheme";
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { cn } from "@/lib/utils";

import { complianceAPI } from "@/services/complianceAPI";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISComplianceDTO,
  FSISComplianceClass,
  FSISComplianceDetailClassModel,
  FSISIssuanceClassDTO,
  TargetAccomplishmentModel,
} from "@/types/complianceType";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import { formatLongDate } from "@/lib/date-format";
import { Ban, FilePen, Trash2, Lock } from "lucide-react";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

/** Row shape returned by the compliance "detail by date" endpoint. */
type ComplianceRow = FSISComplianceDetailClassModel & { isdeleted?: boolean };

/**
 * The endpoint may answer with either a flat array of compliance rows or the
 * wrapper model carrying `compliancelist`. Normalise both into a single row.
 */
function pickComplianceRow(data: unknown): ComplianceRow | null {
  const rows: ComplianceRow[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const obj = value as Record<string, unknown>;
    // The wrapper model carries the day rows under `compliancelist` on some
    // endpoints and `issuancelist` on others — descend into whichever holds
    // rows, then treat any object with an `fsisno` as a compliance row.
    if (!obj.fsisno) {
      if (Array.isArray(obj.compliancelist)) (obj.compliancelist as unknown[]).forEach(walk);
      if (Array.isArray(obj.issuancelist)) (obj.issuancelist as unknown[]).forEach(walk);
      return;
    }
    rows.push(obj as unknown as ComplianceRow);
  };
  walk(data);
  return (
    rows.find((r) => r && r.fsisno && String(r.fsisno) !== EMPTY_GUID && !r.isdeleted) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/*  Mode of Issuance — the single source of truth for MANUAL / FSIS binding.  */
/* -------------------------------------------------------------------------- */

/** Mode of Issuance codes used by the API: 96 = MANUAL, 97 = FSIS. */
export const FSIC_MODE = { MANUAL: 96, FSIS: 97 } as const;

/**
 * Resolves the Mode of Issuance for an issuance row. The API normally sends
 * the numeric `fsicmode` (96/97) but some payloads only carry the description
 * ("MANUAL" / "FSIS") — both are accepted so the row always binds to the
 * correct column.
 */
function resolveFsicMode(row: unknown): number | null {
  if (!row || typeof row !== "object") return null;
  const obj = row as Record<string, unknown>;
  const code = Number(obj.fsicmode);
  if (code === FSIC_MODE.MANUAL || code === FSIC_MODE.FSIS) return code;
  const text = String(obj.fsicmodedescription ?? obj.fsicmodedesc ?? obj.fsicmode ?? "")
    .trim()
    .toUpperCase();
  if (text === "MANUAL") return FSIC_MODE.MANUAL;
  if (text === "FSIS") return FSIC_MODE.FSIS;
  return null;
}

/** Midnight of the current local day, in ms. */
function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

/** Builds the ISO date-time the Create endpoint expects for an inspection day. */
function toInspectedDate(date: Date): string {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
  ).toISOString();
}

/* -------------------------------------------------------------------------- */
/*  Field spec — a single declarative source drives layout, defaults, keys.   */
/* -------------------------------------------------------------------------- */

interface NumericFieldSpec {
  key: string;
  label: string;
  tooltip?: string;
}

const DAILY_INSPECTION_CONSTRUCTION_FIELDS: NumericFieldSpec[] = [
  { key: "insp_during_construction", label: "Inspection During Construction" },
  { key: "insp_fsic_occupancy", label: "Inspection for FSIC Occupancy" },
];

const DAILY_INSPECTION_FIRST_FIELDS: NumericFieldSpec[] = [
  { key: "insp_1st_bplo", label: "1st Inspection BPLO" },
  { key: "insp_1st_gov", label: "1st Inspection GOV" },
  { key: "insp_1st_peza", label: "1st Inspection PEZA" },
  { key: "insp_1st_tieza", label: "1st Inspection TIEZA" },
];

const DAILY_INSPECTION_FIELDS: NumericFieldSpec[] = [
  ...DAILY_INSPECTION_CONSTRUCTION_FIELDS,
  ...DAILY_INSPECTION_FIRST_FIELDS,
];

/** Issuance uses the SAME grid — FSEC section replaced, FSIC keeps existing categories minus BPLO. */
const ISSUANCE_FSEC_FIELDS: NumericFieldSpec[] = [
  { key: "fsec_new_building", label: "FSEC - New Building" },
  { key: "fsec_new_gov", label: "FSEC - New GOV" },
  { key: "fsec_new_peza", label: "FSEC - New PEZA" },
  { key: "fsec_new_tieza", label: "FSEC - New TIEZA" },
];

const ISSUANCE_FSIC_FIELDS: NumericFieldSpec[] = [
  { key: "fsic_occupancy", label: "FSIC - Occupancy" },
  { key: "fsic_business_new", label: "FSIC - BPLO New" },
  { key: "fsic_business_renewal", label: "FSIC - BPLO Renewal" },
  { key: "fsic_gov", label: "FSIC - GOV" },
  { key: "fsic_peza", label: "FSIC - PEZA" },
  { key: "fsic_tieza", label: "FSIC - TIEZA" },
];

const OTHERS_FIELDS: NumericFieldSpec[] = [
  { key: "not_nod", label: "NOD", tooltip: "Notice Of Disapproval" },
  { key: "not_ntc", label: "NTC", tooltip: "Notice to Comply" },
  { key: "not_ntcv", label: "NTCV", tooltip: "Notice To Correct Violation" },
  { key: "not_abatement", label: "ABATEMENT" },
  { key: "not_closure", label: "Closure" },
];

const ISSUANCE_FIELDS = [...ISSUANCE_FSEC_FIELDS, ...ISSUANCE_FSIC_FIELDS, ...OTHERS_FIELDS];

const ALL_NUMERIC_FIELDS = [...DAILY_INSPECTION_FIELDS];

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

const nonNegativeInt = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return 0;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.floor(n) : 0;
  },
  z.number().int({ message: "Whole numbers only" }).min(0, { message: "Cannot be negative" }),
);

const numericShape = Object.fromEntries(ALL_NUMERIC_FIELDS.map((f) => [f.key, nonNegativeInt]));

const schema = z
  .object({
    reportingDate: z.date({ required_error: "Reporting period is required" }),
    provinceno: z.string().trim().min(1, { message: "Province is required" }),
    stationno: z.string().trim().min(1, { message: "Station is required" }),
    remarks: z.string().max(1000).optional().default(""),
  })
  .extend(numericShape);

type FormValues = z.infer<typeof schema>;

const defaultNumeric = Object.fromEntries(ALL_NUMERIC_FIELDS.map((f) => [f.key, 0])) as Record<
  string,
  number
>;

const defaultIssuance = Object.fromEntries(ISSUANCE_FIELDS.map((f) => [f.key, 0])) as Record<
  string,
  number
>;

/* -------------------------------------------------------------------------- */
/*  Screen body — used stand-alone AND inside the modal wrapper.              */
/* -------------------------------------------------------------------------- */

function InspectionsNewBody({
  onSaved,
  onCancel,
  onEditExisting,
  initialYear,
  initialMonth,
}: {
  onSaved?: () => void;
  onCancel?: () => void;
  onEditExisting?: (stationno: string, year: number, month: number, stationName?: string) => void;
  initialYear?: number;
  initialMonth?: number;
}) {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  // Seed the reporting date from the ledger's selected year/month, keeping the
  // current day-of-month (clamped to the last day of that month).
  const [reportingDate, setReportingDate] = React.useState<Date>(() => {
    const now = new Date();
    const y = initialYear && initialYear > 1900 ? initialYear : now.getFullYear();
    const m = initialMonth && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : now.getMonth() + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return new Date(y, m - 1, Math.min(now.getDate(), lastDay));
  });
  const [dateOpen, setDateOpen] = React.useState(false);
  // Keeps the calendar view on the month of the currently selected date so the
  // displayed value and the highlighted day never disagree.
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() => reportingDate);
  React.useEffect(() => {
    if (dateOpen) setCalendarMonth(reportingDate);
  }, [dateOpen, reportingDate]);

  const [province, setProvince] = React.useState<{ no: string; name: string; code: string }>(
    scope.provinceLocked
      ? { no: scope.provinceno, name: scope.provincename, code: "" }
      : { no: "", name: "", code: "" },
  );
  const [station, setStation] = React.useState<{
    no: string;
    name: string;
    model: SearchStationModel | null;
  }>(
    scope.stationLocked
      ? { no: scope.stationno, name: scope.stationname, model: null }
      : { no: "", name: "", model: null },
  );

  // Keep the locked values in sync if the authenticated user resolves after mount.
  React.useEffect(() => {
    if (scope.provinceLocked) {
      setProvince({
        no: scope.provinceno,
        name: scope.provincename,
        code: "",
      });
    }
    if (scope.stationLocked) {
      setStation({
        no: scope.stationno,
        name: scope.stationname,
        model: null,
      });
    }
  }, [
    scope.provinceLocked,
    scope.provinceno,
    scope.provincename,
    scope.stationLocked,
    scope.stationno,
    scope.stationname,
  ]);

  const [numeric, setNumeric] = React.useState<Record<string, number>>(defaultNumeric);
  const [manualIssuance, setManualIssuance] =
    React.useState<Record<string, number>>(defaultIssuance);
  const [fsisIssuance, setFsisIssuance] = React.useState<Record<string, number>>(defaultIssuance);
  // Mode of Issuance is fixed per column: MANUAL = 96, FSIS = 97 (see FSIC_MODE).
  const [remarks, setRemarks] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [duplicatePrompted, setDuplicatePrompted] = React.useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false);
  const [pendingDuplicateTarget, setPendingDuplicateTarget] = React.useState<{
    stationno: string;
    year: number;
    month: number;
    stationName?: string;
  } | null>(null);

  const year = reportingDate.getFullYear();
  const month = reportingDate.getMonth() + 1;
  const monthName = MONTHS.find((m) => m.value === month)?.name ?? "";

  /* ── Existing-record (per inspection date) detection ─────────────────────
   * Mirrors the Target Reference flow: whenever the station or the selected
   * date changes we ask the API whether a compliance record already exists.
   * When it does, the user confirms whether to open it for editing.
   */
  const [existingFsisno, setExistingFsisno] = React.useState<string | null>(null);
  const [existingIssuanceNos, setExistingIssuanceNos] = React.useState<Record<string, string>>({});
  const [checkingExisting, setCheckingExisting] = React.useState(false);
  const [pendingExistingRecord, setPendingExistingRecord] = React.useState<ComplianceRow | null>(
    null,
  );
  const [existingLocked, setExistingLocked] = React.useState(false);
  const promptedDateKeyRef = React.useRef<string | null>(null);
  const [existingMeta, setExistingMeta] = React.useState<{
    isrevisionrequest: boolean;
    editablestatus: number;
  }>({ isrevisionrequest: false, editablestatus: 0 });
  /**
   * Target vs. inspected values taken straight from the "detail by date"
   * record (dailytarget* / inspect*count). Null when no record exists for the
   * selected date — the panel then falls back to its own monthly fetch.
   */
  const [dateSummary, setDateSummary] = React.useState<TargetAccomplishmentModel | null>(null);

  /* ── Revision workflow (requesttype = ISSUANCE) ──────────────────────────── */
  const [addRevisionOpen, setAddRevisionOpen] = React.useState(false);
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const [revisionRequests, setRevisionRequests] = React.useState<FSISEditRequestModel[]>([]);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const selectedDateKey = format(reportingDate, "yyyy-MM-dd");

  /** Plots an existing record into the form and switches Save into update mode. */
  const plotExistingRecord = React.useCallback((rec: ComplianceRow) => {
    setNumeric({
      insp_during_construction: Number(rec.inspectduringcount ?? 0),
      insp_fsic_occupancy: Number(rec.inspectaftercount ?? 0),
      insp_1st_bplo: Number(rec.inspectbplocount ?? 0),
      insp_1st_gov: Number(rec.inspectgovcount ?? 0),
      insp_1st_peza: Number(rec.inspectpezacount ?? 0),
      insp_1st_tieza: Number(rec.inspecttiezacount ?? 0),
    });

    const fromIssuance = (row?: { [k: string]: unknown }) => ({
      fsec_new_building: Number(row?.fsecbuildingcount ?? 0),
      fsec_new_gov: Number(row?.fsecgovcount ?? 0),
      fsec_new_peza: Number(row?.fsecpezacount ?? 0),
      fsec_new_tieza: Number(row?.fsectiezacount ?? 0),
      fsic_occupancy: Number(row?.fsicoccupancycount ?? 0),
      fsic_business_new: Number(row?.fsicbplonewcount ?? 0),
      fsic_business_renewal: Number(row?.fsicbplorenewcount ?? 0),
      fsic_gov: Number(row?.fsicgovcount ?? 0),
      fsic_peza: Number(row?.fsicpezacount ?? 0),
      fsic_tieza: Number(row?.fsictiezacount ?? 0),
      not_nod: Number(row?.nodcount ?? 0),
      not_ntc: Number(row?.ntccount ?? 0),
      not_ntcv: Number(row?.ntcvcount ?? 0),
      not_abatement: Number(row?.abatementcount ?? 0),
      not_closure: Number(row?.closurecount ?? 0),
    });

    // Bind each issuance row to its column strictly by Mode of Issuance:
    // 96 = MANUAL, 97 = FSIS. Rows with any other mode are ignored.
    const list = Array.isArray(rec.issuancelist) ? rec.issuancelist : [];
    let manualRow = list.find((i) => resolveFsicMode(i) === FSIC_MODE.MANUAL);
    let fsisRow = list.find((i) => resolveFsicMode(i) === FSIC_MODE.FSIS);
    // Legacy / unset payloads come back with `fsicmode: 0` on every row. In
    // that case fall back to positional order: first row = MANUAL, second = FSIS.
    if (!manualRow && !fsisRow) {
      manualRow = list[0];
      fsisRow = list[1];
    }
    setManualIssuance(fromIssuance(manualRow as unknown as Record<string, unknown>));
    setFsisIssuance(fromIssuance(fsisRow as unknown as Record<string, unknown>));

    // Keep the DATABASE identifiers — never regenerate them.
    setExistingIssuanceNos({
      [FSIC_MODE.MANUAL]: manualRow?.issuanceno ? String(manualRow.issuanceno) : EMPTY_GUID,
      [FSIC_MODE.FSIS]: fsisRow?.issuanceno ? String(fsisRow.issuanceno) : EMPTY_GUID,
    });
    setExistingFsisno(String(rec.fsisno));
    setRemarks(rec.remarks ?? "");
    setErrors({});
  }, []);

  const resetExistingRecord = React.useCallback(() => {
    setExistingFsisno(null);
    setExistingIssuanceNos({});
    setPendingExistingRecord(null);
    setExistingLocked(false);
    setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });
    setDateSummary(null);
  }, []);

  /* Existence check — runs whenever station / date changes. */
  React.useEffect(() => {
    const activeStationNo = scope.stationLocked ? scope.stationno || station.no : station.no;
    if (!activeStationNo || activeStationNo === EMPTY_GUID || !reportingDate) {
      resetExistingRecord();
      return;
    }

    let cancelled = false;
    (async () => {
      setCheckingExisting(true);
      const resp = await complianceAPI.getDetailBydate(
        {
          stationno: activeStationNo,
          // The API expects the non-padded US format, e.g. 8/1/2026.
          dateinspected: format(reportingDate, "M/d/yyyy"),
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<unknown>(resp);
      const record = ok ? pickComplianceRow(data) : null;
      // Daily targets are returned at the root of the Detail/Date response.
      const wrapper = (ok && data && typeof data === "object" ? data : {}) as Record<
        string,
        unknown
      >;
      const target = (key: string) => Number((wrapper[key] as number | undefined) ?? 0);
      setCheckingExisting(false);

      if (record) {
        setPendingExistingRecord(record);
        setExistingMeta({
          isrevisionrequest: Boolean(record.isrevisionrequest),
          editablestatus: Number(record.editablestatus ?? 0),
        });
        // Bind the target pane straight to the record's daily target and
        // inspected counts.
        setDateSummary({
          stationno: activeStationNo,
          year: reportingDate.getFullYear(),
          month: reportingDate.getMonth() + 1,
          totaltargetbplo: target("dailytargetbplo"),
          totaltargetgov: target("dailytargetgov"),
          totaltargetpeza: target("dailytargetpeza"),
          totaltargettieza: target("dailytargettieza"),
          totalAccomplishmentbplo: Number(record.inspectbplocount ?? 0),
          totalAccomplishmentgov: Number(record.inspectgovcount ?? 0),
          totalAccomplishmentpeza: Number(record.inspectpezacount ?? 0),
          totalAccomplishmenttieza: Number(record.inspecttiezacount ?? 0),
        });
        const isPast = reportingDate.getTime() < startOfToday();
        const unlocked = Number(record.editablestatus ?? 0) === 153;
        setExistingLocked(isPast && !unlocked);

        const key = `${activeStationNo}|${selectedDateKey}`;
        if (promptedDateKeyRef.current !== key) {
          promptedDateKeyRef.current = key;
          setPendingDuplicateTarget({
            stationno: activeStationNo,
            year: reportingDate.getFullYear(),
            month: reportingDate.getMonth() + 1,
            stationName: station.name || user?.stationname,
          });
          setDuplicatePrompted(true);
          setDuplicateDialogOpen(true);
        } else if (isPast && !unlocked) {
          plotExistingRecord(record);
        }
      } else {
        // No record for this date → clean CREATE, but the daily targets still
        // come back at the root of the Detail/Date response, so keep them.
        promptedDateKeyRef.current = null;
        setDuplicatePrompted(false);
        setDuplicateDialogOpen(false);
        setPendingDuplicateTarget(null);
        resetExistingRecord();
        setDateSummary({
          stationno: activeStationNo,
          year: reportingDate.getFullYear(),
          month: reportingDate.getMonth() + 1,
          totaltargetbplo: target("dailytargetbplo"),
          totaltargetgov: target("dailytargetgov"),
          totaltargetpeza: target("dailytargetpeza"),
          totaltargettieza: target("dailytargettieza"),
          totalAccomplishmentbplo: 0,
          totalAccomplishmentgov: 0,
          totalAccomplishmentpeza: 0,
          totalAccomplishmenttieza: 0,
        });
      }

    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    station.no,
    station.name,
    scope.stationLocked,
    scope.stationno,
    selectedDateKey,
    reloadNonce,
  ]);

  /* Revision requests ledger for the selected station/year (ISSUANCE). */
  React.useEffect(() => {
    const activeStationNo = scope.stationLocked ? scope.stationno || station.no : station.no;
    if (!activeStationNo || activeStationNo === EMPTY_GUID) {
      setRevisionRequests([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno: activeStationNo,
          reportyear: Number(year),
          reportmonth: 0,
          provinceno: province.no || EMPTY_GUID,
          requesttype: "ISSUANCE",
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data, error } = unwrap<FSISEditRequestModel[]>(resp);
      if (ok && Array.isArray(data)) {
        setRevisionRequests(data);
      } else {
        const isEmptyResult = /no\s*data|not\s*found|no\s*record/i.test(error || "");
        if (!isEmptyResult && error) toast.error(error);
        setRevisionRequests([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [station.no, scope.stationLocked, scope.stationno, province.no, year, reloadNonce]);

  /* ── Lock rules for the selected (single) date ───────────────────────────── */
  const isPastSelectedDate = reportingDate.getTime() < startOfToday();
  const unlockedByApproval = Number(existingMeta.editablestatus) === 153;
  const activeRequest = React.useMemo(() => {
    return (
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "PENDING") return false;
        if (existingFsisno && String(r.referencekey) === String(existingFsisno)) return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === selectedDateKey : false;
      }) ?? null
    );
  }, [revisionRequests, selectedDateKey, existingFsisno]);
  const hasPendingRevision =
    isPastSelectedDate && (existingMeta.isrevisionrequest || !!activeRequest) && !unlockedByApproval;
  const needsRevisionRequest = isPastSelectedDate && !unlockedByApproval && !hasPendingRevision;
  const fieldsLocked = isPastSelectedDate && !unlockedByApproval;

  /* ------------------------- Monthly summary lookups ---------------------- */
  // Data lives in <TargetAccomplishmentPanel/>.

  /* --------------------------- Numeric handlers --------------------------- */

  const setNumericField = (key: string, raw: string) => {
    // Strip anything that isn't a digit — enforces integer + non-negative.
    const cleaned = raw.replace(/[^0-9]/g, "");
    const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
    setNumeric((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  };

  /* --------------------------------- Submit ------------------------------- */

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const candidate = {
      reportingDate,
      provinceno: province.no,
      stationno: station.no,
      remarks,
      ...numeric,
    };

    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const key = String(iss.path[0] ?? "");
        if (key && !nextErrors[key]) nextErrors[key] = iss.message;
      });
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const submitStationNo = scope.stationLocked
        ? scope.stationno || station.no || ""
        : station.no;

      if (!submitStationNo || submitStationNo === EMPTY_GUID) {
        toast.error("Please select a station.");
        return;
      }

      const buildIssuance = (
        mode: number,
        vals: Record<string, number>,
      ): FSISIssuanceClassDTO => {
        return {
          // Always reuse the database issuance id when editing an existing row.
          issuanceno: existingIssuanceNos[String(mode)] || EMPTY_GUID,
          fsicmode: mode,
          fsecbuildingcount: vals.fsec_new_building ?? 0,
          fsecgovcount: vals.fsec_new_gov ?? 0,
          fsecpezacount: vals.fsec_new_peza ?? 0,
          fsectiezacount: vals.fsec_new_tieza ?? 0,
          fsicoccupancycount: vals.fsic_occupancy ?? 0,
          fsicbplonewcount: vals.fsic_business_new ?? 0,
          fsicbplorenewcount: vals.fsic_business_renewal ?? 0,
          fsicgovcount: vals.fsic_gov ?? 0,
          fsicpezacount: vals.fsic_peza ?? 0,
          fsictiezacount: vals.fsic_tieza ?? 0,
          nodcount: vals.not_nod ?? 0,
          ntccount: vals.not_ntc ?? 0,
          ntcvcount: vals.not_ntcv ?? 0,
          abatementcount: vals.not_abatement ?? 0,
          closurecount: vals.not_closure ?? 0,
        };
      };

      const compliance: FSISComplianceClass = {
        // Existing record → send its fsisno so the backend UPDATEs.
        fsisno: existingFsisno || EMPTY_GUID,
        dateinspected: toInspectedDate(reportingDate),
        inspectduringcount: numeric.insp_during_construction ?? 0,
        inspectaftercount: numeric.insp_fsic_occupancy ?? 0,
        inspectbplocount: numeric.insp_1st_bplo ?? 0,
        inspectgovcount: numeric.insp_1st_gov ?? 0,
        inspectpezacount: numeric.insp_1st_peza ?? 0,
        inspecttiezacount: numeric.insp_1st_tieza ?? 0,
        isaccomplished: Boolean(existingFsisno),
        remarks: remarks ?? "",
        issuancelist: [
          // 96 → MANUAL column, 97 → FSIS column.
          buildIssuance(FSIC_MODE.MANUAL, manualIssuance),
          buildIssuance(FSIC_MODE.FSIS, fsisIssuance),
        ],
      };

      const payload: FSISComplianceDTO = {
        stationno: submitStationNo,
        encodedby: user?.memberno ?? "",
        compliancelist: [compliance],
      };

      const resp = await complianceAPI.create(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save fire safety compliance.");
        return;
      }
      toast.success(
        existingFsisno ? "Fire safety compliance updated." : "Fire safety compliance saved.",
      );
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  /**
   * Confirm → plot the existing record inline and switch Save into update
   * mode (mirrors the Target Reference flow — no page redirect).
   */
  const handleDuplicateConfirm = () => {
    if (pendingExistingRecord) plotExistingRecord(pendingExistingRecord);
    setPendingDuplicateTarget(null);
    setDuplicateDialogOpen(false);
  };

  /** Cancel → stay on the current page with a blank form. */
  const handleDuplicateCancel = () => {
    setDuplicateDialogOpen(false);
    // Locked records stay plotted read-only so the revision-request action
    // still has a reference record to point at.
    if (existingLocked && pendingExistingRecord) {
      plotExistingRecord(pendingExistingRecord);
      return;
    }
    setPendingDuplicateTarget(null);
    setExistingFsisno(null);
    setExistingIssuanceNos({});
  };

  const handleDuplicateDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleDuplicateCancel();
      return;
    }
    setDuplicateDialogOpen(newOpen);
  };


  /* ---------------------------------- UI ---------------------------------- */

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
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
      {/* 1. Reporting Period ------------------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle icon={<CalendarIcon className="h-4 w-4" />} title="Reporting Period" />
        <div className="grid grid-cols-1 gap-4 sm:max-w-md">
          <Field label="Reporting Period As Of" required error={errors.reportingDate}>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !reportingDate && "text-muted-foreground",
                  )}
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
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  onSelect={(d) => {
                    if (d) {
                      setReportingDate(d);
                      setDateOpen(false);
                    }
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </Field>
        </div>
      </Card>

      {/* 2. Station Information -------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Province" required error={errors.provinceno}>
            <LocationSearchSelect
              locationtype="PROVINCE"
              parentcode={MIMAROPA_REGION_CODE}
              value={province.no || undefined}
              valueName={province.name}
              placeholder="Select province"
              hideCode
              disabled={scope.provinceLocked}
              onChange={(no, name, item) => {
                if (scope.provinceLocked) return;
                setProvince({ no, name, code: item?.locationcode ?? "" });
                setStation({ no: "", name: "", model: null });
                if (errors.provinceno) setErrors((e) => ({ ...e, provinceno: "" }));
              }}
            />
          </Field>

          <Field label="Station" required error={errors.stationno}>
            <StationSearchSelect
              value={station.no || undefined}
              valueName={station.name}
              provinceno={province.no || undefined}
              disabled={scope.stationLocked}
              placeholder={
                scope.stationLocked ? station.name || "Assigned station" : "Select station"
              }
              onChange={(no, name, _prov, model) => {
                if (scope.stationLocked) return;
                setStation({ no, name, model: model ?? null });
                if (errors.stationno) setErrors((e) => ({ ...e, stationno: "" }));
                // Auto-sync province from the selected station so the two
                // pickers stay in lockstep (bi-directional cross-filter).
                if (
                  !scope.provinceLocked &&
                  model?.provinceno &&
                  model.provinceno !== province.no
                ) {
                  setProvince({
                    no: model.provinceno,
                    name: model.provincename ?? "",
                    code: "",
                  });
                  if (errors.provinceno) setErrors((e) => ({ ...e, provinceno: "" }));
                }
              }}
            />
          </Field>
        </div>
      </Card>

      {/* 3. Daily Inspection Activities ------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Inspection Activities"
          subtitle={`Reporting month · ${monthName} ${year}`}
        />

        <TargetAccomplishmentPanel
          variant="daily"
          stationno={station.no || undefined}
          year={year}
          month={month}
          periodLabel={format(reportingDate, "PPP")}
          data={dateSummary}
        />


        <div className="space-y-4">
          <InspectionMatrix
            constructionFields={DAILY_INSPECTION_CONSTRUCTION_FIELDS}
            firstFields={DAILY_INSPECTION_FIRST_FIELDS}
            values={numeric}
            errors={errors}
            onChange={setNumericField}
            locked={fieldsLocked}
          />
        </div>
      </Card>

      {/* 4. Daily Issuance Activities -------------------------------------- */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Issuance Activities"
          subtitle="Encode issuances separately for MANUAL and FSIS"
        />

        <TooltipProvider delayDuration={150}>
          <IssuanceTable
            manualValues={manualIssuance}
            fsisValues={fsisIssuance}
            setManualValues={setManualIssuance}
            setFsisValues={setFsisIssuance}
            locked={fieldsLocked}
          />
        </TooltipProvider>

        <Field label="Remarks">
          <Textarea
            rows={3}
            value={remarks}
            readOnly={fieldsLocked}
            onChange={(e) => {
              if (fieldsLocked) return;
              setRemarks(e.target.value.slice(0, 1000));
            }}
            placeholder="Additional notes about the inspection…"
          />
        </Field>

      </Card>

      {/* Actions ----------------------------------------------------------- */}
      <div className="flex flex-wrap justify-end gap-2">
        {needsRevisionRequest ? (
          <Button
            type="button"
            onClick={() => {
              if (!station.no || station.no === EMPTY_GUID) {
                toast.error("Please select a station first.");
                return;
              }
              setAddRevisionOpen(true);
            }}
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
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
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
              {saving ? "Saving…" : existingFsisno ? "Update" : "Save Inspection"}
            </Button>
          </>
        )}
      </div>

      {/* Track auth context so unused-var lint stays quiet in stand-alone mode. */}
      <input type="hidden" value={user?.memberno ?? ""} readOnly />

      <ConfirmDialog
        open={duplicateDialogOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-warning-soft"
        contentIconColorClass="text-warning"
        title="Fire Safety Compliance Already Exists"
        description={`A fire safety compliance record already exists for ${
          station.name || user?.stationname || "this station"
        } on ${formatLongDate(reportingDate)}.\n\n${
          existingLocked
            ? "This record is already locked — it will be opened as read-only and any change will require a revision request."
            : "Do you want to open and edit the existing record?"
        }`}
        confirmLabel={existingLocked ? "Open Record" : "Edit Existing"}
        showCancel={false}
        onConfirm={handleDuplicateConfirm}
      />

      {addRevisionOpen && (
        <RevisionRequestDialog
          open={addRevisionOpen}
          onOpenChange={(v) => setAddRevisionOpen(v)}
          module="monitoring"
          station={{
            stationno: station.no,
            stationcode: station.model?.stationcode ?? "",
            stationname: station.name || station.model?.stationname || "",
            provinceno: province.no,
            provincename: province.name,
            cityname: station.model?.cityname ?? user?.cityname ?? "",
          }}
          year={year}
          month={month}
          referencekey={existingFsisno || EMPTY_GUID}
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
            stationno: station.no || EMPTY_GUID,
            requesttype: "ISSUANCE",
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

    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Route page — kept for /inspections/new deep links.                         */
/* -------------------------------------------------------------------------- */

export default function InspectionsNew() {
  const navigate = useNavigate();
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) {
      toast.error("Please sign in to encode inspections (Ctrl + /)");
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
          <FilePlus2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance Entry</h1>
          <p className="text-sm text-muted-foreground">
            Record fire safety compliance accomplishments per station and reporting period.
          </p>
        </div>
      </div>

      <InspectionsNewBody
        onSaved={() => navigate("/monitoring")}
        onCancel={() => navigate("/monitoring")}
      />
    </div>
  );
}

/** Modal wrapper — used by the FSIS Inventory Add button. */
export function InspectionsNewModal({
  open,
  onOpenChange,
  onSaved,
  onEditExisting,
  initialYear,
  initialMonth,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  onEditExisting?: (stationno: string, year: number, month: number, stationName?: string) => void;
  initialYear?: number;
  initialMonth?: number;
}) {
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
              <FilePlus2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Fire Safety Compliance Entry
              </DialogTitle>
              <DialogDescription>
                Select a reporting period and station, then encode daily accomplishments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="min-h-full pr-2">
            {open ? (
              <InspectionsNewBody
                initialYear={initialYear}
                initialMonth={initialMonth}
                onSaved={() => {
                  onSaved?.();
                  onOpenChange(false);
                }}
                onCancel={() => onOpenChange(false)}
                onEditExisting={(stationno, year, month, stationName) => {
                  onOpenChange(false);
                  onEditExisting?.(stationno, year, month, stationName);
                }}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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

function IssuanceTable({
  manualValues,
  fsisValues,
  setManualValues,
  setFsisValues,
  locked,
}: {
  manualValues: Record<string, number>;
  fsisValues: Record<string, number>;
  setManualValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setFsisValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  locked?: boolean;
}) {
  const makeHandler = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Record<string, number>>>) =>
      (key: string, raw: string) => {
        const cleaned = raw.replace(/[^0-9]/g, "");
        const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
        setter((prev) => ({ ...prev, [key]: value }));
      },
    [],
  );

  const onManualChange = React.useMemo(
    () => makeHandler(setManualValues),
    [makeHandler, setManualValues],
  );
  const onFsisChange = React.useMemo(
    () => makeHandler(setFsisValues),
    [makeHandler, setFsisValues],
  );

  const groups: {
    title: string;
    fields: NumericFieldSpec[];
    headClass: string;
    subHeadClass: string;
  }[] = [
    {
      title: "FSEC",
      fields: ISSUANCE_FSEC_FIELDS,
      headClass: MONITORING_THEME.headerGroup,
      subHeadClass: MONITORING_THEME.headerSoft,
    },
    {
      title: "FSIC",
      fields: ISSUANCE_FSIC_FIELDS,
      headClass: MONITORING_THEME.headerGroup,
      subHeadClass: MONITORING_THEME.headerSoft,
    },
    {
      title: "NOTICES",
      fields: OTHERS_FIELDS,
      headClass: MONITORING_THEME.headerGroup,
      subHeadClass: MONITORING_THEME.headerSoft,
    },
  ];

  const shortLabel = (label: string) =>
    label
      .replace(/^FSEC\s*-\s*/i, "")
      .replace(/^FSIC\s*-\s*/i, "")
      .toUpperCase();

  const rowTotal = (values: Record<string, number>) =>
    ISSUANCE_FIELDS.reduce((sum, f) => sum + (values[f.key] ?? 0), 0);

  const colTotal = (key: string) => (manualValues[key] ?? 0) + (fsisValues[key] ?? 0);

  const grandTotal = rowTotal(manualValues) + rowTotal(fsisValues);

  const renderRow = (
    rowLabel: string,
    values: Record<string, number>,
    onChange: (key: string, raw: string) => void,
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
      {groups.flatMap((g) =>
        g.fields.map((f) => (
          <td key={f.key} className="border-b border-r px-1.5 py-1.5 text-right">
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              pattern="[0-9]*"
              value={String(values[f.key] ?? 0)}
              disabled={locked}
              readOnly={locked}
              onChange={(e) => onChange(f.key, e.target.value)}
              onKeyDown={(e) => {
                if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
              }}
              className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-right tabular-nums"
            />
          </td>
        )),
      )}
      <td className="border-b px-3 py-1.5 text-center font-bold tabular-nums">
        {rowTotal(values).toLocaleString()}
      </td>
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
                Issuance
              </th>
              {groups.map((g) => (
                <th
                  key={g.title}
                  colSpan={g.fields.length}
                  className={cn(
                    "border-b border-r px-2 py-2 text-center uppercase tracking-wider",
                    g.headClass,
                  )}
                >
                  {g.title}
                </th>
              ))}
              <th
                rowSpan={2}
                className={cn(
                  "min-w-[90px] border-b border-l px-3 py-2 text-center align-middle uppercase tracking-wider",
                  MONITORING_THEME.headerPrimary,
                )}
              >
                Total
              </th>
            </tr>
            <tr>
              {groups.flatMap((g) =>
                g.fields.map((f) => (
                  <th
                    key={f.key}
                    className={cn(
                      "min-w-[80px] border-b border-r px-1.5 py-1 text-center text-[10px] font-bold uppercase",
                      g.subHeadClass,
                    )}
                    title={f.tooltip}
                  >
                    {shortLabel(f.label)}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {renderRow("MANUAL", manualValues, onManualChange, true)}
            {renderRow("FSIS", fsisValues, onFsisChange, false)}
            <tr className="border-t-2 border-border bg-accent font-bold text-foreground">
              <td className="sticky left-0 z-20 border-r-2 border-t-2 border-border bg-accent px-3 py-2.5 text-left font-bold uppercase tracking-wide">
                Total
              </td>
              {groups.flatMap((g) =>
                g.fields.map((f) => (
                  <td
                    key={f.key}
                    className="border-r border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums"
                  >
                    {colTotal(f.key).toLocaleString()}
                  </td>
                )),
              )}
              <td className="border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums">
                {grandTotal.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  tooltip,
  required,
  error,
  children,
}: {
  label: string;
  tooltip?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const labelNode = (
    <Label className="text-xs font-medium text-muted-foreground">
      {label} {required && <span className="text-destructive">*</span>}
    </Label>
  );
  return (
    <div className="space-y-1.5">
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>{labelNode}</TooltipTrigger>
          <TooltipContent side="top" align="start">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : (
        labelNode
      )}
      {children}
      {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
    </div>
  );
}

function NumericGrid({
  fields,
  values,
  errors,
  onChange,
  disabled,
}: {
  fields: NumericFieldSpec[];
  values: Record<string, number>;
  errors: Record<string, string>;
  onChange: (key: string, raw: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} tooltip={f.tooltip} required error={errors[f.key]}>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            value={values[f.key] ?? 0}
            disabled={disabled}
            readOnly={disabled}
            onChange={(e) => onChange(f.key, e.target.value)}
            onKeyDown={(e) => {
              // Block minus / plus / exponent characters.
              if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
            }}
            className={cn(
              "tabular-nums",
              errors[f.key] && "border-destructive focus-visible:ring-destructive",
              disabled && "cursor-not-allowed opacity-60",
            )}
          />
        </Field>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inspection matrix — three-column layout                                   */
/*    Col 1: activity labels grouped by heading                               */
/*    Col 2: 1st Inspection inputs                                            */
/* -------------------------------------------------------------------------- */

function InspectionMatrix({
  constructionFields,
  firstFields,
  values,
  errors,
  onChange,
  locked,
}: {
  constructionFields: NumericFieldSpec[];
  firstFields: NumericFieldSpec[];
  values: Record<string, number>;
  errors: Record<string, string>;
  onChange: (key: string, raw: string) => void;
  locked?: boolean;
}) {
  const constructionRow = constructionFields.find((f) => f.key === "insp_during_construction");
  const occupancyRow = constructionFields.find((f) => f.key === "insp_fsic_occupancy");

  const renderNumericInput = (f: NumericFieldSpec, disabled: boolean = Boolean(locked)) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {f.label} <span className="text-destructive">*</span>
      </Label>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        pattern="[0-9]*"
        value={values[f.key] ?? 0}
        disabled={disabled}
        readOnly={disabled}
        onChange={(e) => onChange(f.key, e.target.value)}
        onKeyDown={(e) => {
          if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
        }}
        className={cn(
          "tabular-nums",
          errors[f.key] && "border-destructive focus-visible:ring-destructive",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      {errors[f.key] && <p className="text-[11px] font-medium text-destructive">{errors[f.key]}</p>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Column 1 — Inspection Activities */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">Inspection Activities</div>
        <div className="space-y-4">
          <div className="space-y-3">{constructionRow && renderNumericInput(constructionRow)}</div>
          <div className="space-y-3">{occupancyRow && renderNumericInput(occupancyRow)}</div>
        </div>
      </div>

      {/* Columns 2 & 3 — 1st Inspection */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4 lg:col-span-2">
        <div className="mb-3 text-sm font-semibold text-foreground">1st Inspection</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {firstFields.map((f) => (
            <React.Fragment key={f.key}>{renderNumericInput(f)}</React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReadOnlyTile({
  label,
  value,
  loading,
  placeholder = "—",
  tone = "muted",
}: {
  label: string;
  value: number | null;
  loading?: boolean;
  placeholder?: string;
  tone?: "muted" | "primary" | "success" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-warning"
          : "text-foreground";
  return (
    <Card className="border-border/60 bg-muted/30 p-4 shadow-none">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex h-8 items-center text-2xl font-bold tabular-nums tracking-tight",
          toneCls,
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : value === null ? (
          <span className="text-sm font-normal text-muted-foreground">{placeholder}</span>
        ) : (
          value.toLocaleString()
        )}
      </div>
    </Card>
  );
}
