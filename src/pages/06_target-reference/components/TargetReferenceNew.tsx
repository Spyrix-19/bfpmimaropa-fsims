import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PastDatesLockedNote } from "@/components/past-dates-locked-note";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Building2,
  Calendar,
  Loader2,
  Lock,
  FilePen,
  Save,
  X,
  AlertTriangle,
  Trash2,
  Ban,
  Target,
  FilePlus2,
  RotateCcw,
} from "lucide-react";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import { toast } from "@/lib/toast";
import { cn, toWhole, buildYears } from "@/lib/utils";
import { numericFieldProps } from "@/components/numeric-input";
import { MONTHS, SECTORS, SECTOR_NO } from "@/lib/fsims-constants";
import { formatLongDate } from "@/lib/date-format";
import AvatarWithFallback from "@/components/avatar-with-fallback";

import StationSearchSelect from "@/components/station-search-select";
import StationInfoCard, { StationSectionTitle } from "@/components/station-info-card";
import { Card } from "@/components/ui/card";

/** "2026-08-04" -> "August 4th, 2026" */
function formatLongOrdinalDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  const monthName = new Date(y, m - 1, d).toLocaleString("en-US", { month: "long" });
  const suffix =
    d % 10 === 1 && d !== 11
      ? "st"
      : d % 10 === 2 && d !== 12
        ? "nd"
        : d % 10 === 3 && d !== 13
          ? "rd"
          : "th";
  return `${monthName} ${d}${suffix}, ${y}`;
}
import { useStationDetails } from "@/hooks/useStationDetails";

import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import { EMPTY_GUID } from "@/lib/fsims-constants";
import type { SearchStationModel } from "@/types/stationTypes";

import type {
  TargetReferenceClass,
  TargetReferenceDetailModel,
  TargetReferenceByDateModel,
} from "@/types/targetreferenceType";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import { resolveTargetScope, buildDays, formatDayLabel } from "../helpers";
import RevisionRequestDialog from "../revision/RevisionRequestDialog";
import ReasonRemarksDialog from "../revision/ReasonRemarksDialog";
import RevisionStatusBadge from "../revision/RevisionStatusBadge";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";
import { serializePhilippineDateTime } from "@/lib/date-format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, opens in Edit mode for that station+year+month. */
  editing?: { year: number; month?: number; stationno?: string } | null;
  initialYear?: number;
  initialMonth?: number;
  onSaved: () => void;
}

/** cellKey = `${day}-${sectorno}` -> raw string input value */
type CellMap = Record<string, string>;

/**
 * Lock activation rule (Philippine Standard Time, Asia/Manila, UTC+08:00).
 *
 * A report (reportyear, reportmonth) only becomes officially locked once the
 * current PST time reaches day 4 of the following calendar month at
 * 00:00:00 PST. Before that instant the row must behave exactly like an
 * unlocked / current month, regardless of any server-side lock hint.
 *
 * Implementation notes:
 *  - We compare in a shared, tz-neutral millisecond space by shifting the
 *    real UTC "now" forward by +8h and treating the lock activation as if
 *    its wall-clock components (Y, next-month, day 4, 00:00) were UTC.
 *  - `reportmonth` is 1..12. `Date.UTC(y, reportmonth, 4)` uses `reportmonth`
 *    as a 0-indexed month, which conveniently yields the NEXT calendar month
 *    (December => January of the following year automatically).
 */
/** Builds the ISO date-time the Create endpoint expects for a target day. */
function toTargetDate(year: number, month: number, day: number): string {
  return serializePhilippineDateTime(new Date(year, month - 1, day, 0, 0, 0));
}

/**
 * Resolves the day-of-month for a Detail row.
 * The API returns `targetdate` (e.g. "2026-08-04T00:00:00"); older payloads may
 * carry reportyear/reportmonth/reportday instead. Returns null when the row
 * does not belong to the requested year+month.
 */
function resolveDetailDay(
  it: { targetdate?: string; reportyear?: number; reportmonth?: number; reportday?: number },
  year: number,
  month: number,
): number | null {
  if (it.targetdate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(it.targetdate));
    if (m) {
      if (Number(m[1]) !== Number(year) || Number(m[2]) !== Number(month)) return null;
      return Number(m[3]) || null;
    }
  }
  if (it.reportmonth != null) {
    if (Number(it.reportmonth) !== Number(month)) return null;
    if (it.reportyear != null && Number(it.reportyear) !== Number(year)) return null;
    return Number(it.reportday || 0) || null;
  }
  return null;
}

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

function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string): Date {
  const [year, month, day] = value.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Midnight of the current local day, in ms. */
function startOfToday(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
}

export default function TargetReferenceForm({
  open,
  onOpenChange,
  editing,
  initialYear,
  initialMonth,
  onSaved,
}: Props) {
  const { user, systemAccess } = useAuth();
  const [revisionDay, setRevisionDay] = React.useState<number | null>(null);
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);
  const scope = React.useMemo(
    () => resolveTargetScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const isEditProp = Boolean(editing);
  // Local edit-mode flip when duplicate detection promotes an Add into an Edit.
  const [autoEdit, setAutoEdit] = React.useState(false);
  const isEdit = isEditProp || autoEdit;
  const canShowAllStationOption = !isEditProp && !scope.stationLocked;
  const today = React.useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [year, setYear] = React.useState<number>(currentYear);
  const [month, setMonth] = React.useState<number>(currentMonth);
  const years = React.useMemo(() => buildYears(), []);
  const days = React.useMemo(() => buildDays(year, month), [year, month]);
  const [cells, setCells] = React.useState<CellMap>({});
  const [baselineCells, setBaselineCells] = React.useState<CellMap>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [duplicatePrompted, setDuplicatePrompted] = React.useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = React.useState(false);
  const [pendingDuplicateData, setPendingDuplicateData] = React.useState<{
    cells: CellMap;
    ids: Record<string, string>;
  } | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<string>(formatDateInputValue(new Date()));
  const [dateOpen, setDateOpen] = React.useState(false);
  // Keeps the calendar view on the month of the currently selected date so the
  // displayed value and the highlighted day never disagree.
  const [calendarMonth, setCalendarMonth] = React.useState<Date>(() =>
    parseDateInputValue(formatDateInputValue(new Date())),
  );
  React.useEffect(() => {
    if (dateOpen && selectedDate) setCalendarMonth(parseDateInputValue(selectedDate));
  }, [dateOpen, selectedDate]);
  // `remarks` removed: no per-date remarks field for target reference

  // ── Existing-record (per target date) detection ────────────────────────────
  const [existingTargetno, setExistingTargetno] = React.useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = React.useState(false);
  const [pendingExistingRecord, setPendingExistingRecord] =
    React.useState<TargetReferenceByDateModel | null>(null);
  const [dateDuplicateOpen, setDateDuplicateOpen] = React.useState(false);
  /** True when the existing record for the selected date is locked (past + not unlocked). */
  const [existingLocked, setExistingLocked] = React.useState(false);
  /** Tracks the station|date already confirmed, so the prompt shows once per date. */
  const promptedDateKeyRef = React.useRef<string | null>(null);
  /** Server flags for the selected date's record. */
  const [existingMeta, setExistingMeta] = React.useState<{
    isrevisionrequest: boolean;
    editablestatus: number;
  }>({ isrevisionrequest: false, editablestatus: 0 });
  const [addRevisionOpen, setAddRevisionOpen] = React.useState(false);

  const setField = (field: string, raw: string) => {
    setCells((prev) => ({ ...prev, [field]: toWhole(raw) }));
    if (errors[field]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[field];
        return n;
      });
    }
  };

  const [stationNo, setStationNo] = React.useState<string>(
    scope.stationLocked ? scope.stationno || user?.stationno || "" : EMPTY_GUID,
  );
  const [provinceno, setProvinceno] = React.useState<string>(
    scope.provinceLocked ? scope.provinceno || user?.provinceno || "" : EMPTY_GUID,
  );
  const [provincename, setProvincename] = React.useState<string>(
    scope.provinceLocked ? scope.provincename || user?.provincename || "" : "ALL",
  );

  const [station, setStation] = React.useState<SearchStationModel | null>(null);

  const [selectedStationLabel, setSelectedStationLabel] = React.useState<string>("");
  const [initializedForOpen, setInitializedForOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setInitializedForOpen(false);
      return;
    }
    if (initializedForOpen) return;

    let nextStationNo = "";
    let nextStationLabel = "";
    const nextProvinceNo = scope.provinceLocked
      ? scope.provinceno || user?.provinceno || ""
      : EMPTY_GUID;
    const nextProvinceName = scope.provinceLocked
      ? scope.provincename || user?.provincename || ""
      : "ALL";

    if (scope.stationLocked) {
      nextStationNo = scope.stationno || user?.stationno || "";
      nextStationLabel = user?.stationname
        ? `${user.stationname}${user.provincename ? ` — ${user.provincename}` : ""}`
        : "";
    } else if (editing?.stationno) {
      nextStationNo = editing.stationno;
    } else {
      nextStationNo = EMPTY_GUID;
      nextStationLabel = "ALL";
    }

    setStationNo(nextStationNo);
    setStation(null);
    setSelectedStationLabel(nextStationLabel);
    setProvinceno(nextProvinceNo);
    setProvincename(nextProvinceName);
    setInitializedForOpen(true);
  }, [
    open,
    initializedForOpen,
    scope.stationLocked,
    scope.stationno,
    editing?.stationno,
    user?.provincename,
    user?.stationname,
    user?.stationno,
  ]);

  // Station code / city / province / logo for the Station Information card.
  // Uses the picker-provided model when present, otherwise resolves it from the
  // station search (with the login's own scope as fallback).
  const stationDetails = useStationDetails({
    stationno: stationNo,
    preloaded: station,
    provinceno: scope.provinceLocked ? scope.provinceno : provinceno,
    enabled: open,
  });

  // Fixed sector constants live in @/lib/fsims-constants (SECTORS).
  // 111=BPLO, 112=GOV, 113=PEZA, 114=TIEZA (OGA=115 intentionally excluded).
  const sectors = SECTORS;
  const sectorsLoading = false;

  const [existingLoading, setExistingLoading] = React.useState(false);
  const [existingTargetNos, setExistingTargetNos] = React.useState<Record<string, string>>({});

  const [existingEditableStatus, setExistingEditableStatus] = React.useState<
    Record<string, number>
  >({});
  const [existingIsRevisionRequest, setExistingIsRevisionRequest] = React.useState<
    Record<string, boolean>
  >({});
  const [revisionRequests, setRevisionRequests] = React.useState<FSISEditRequestModel[]>([]);
  const [revisionRequestsLoading, setRevisionRequestsLoading] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  React.useEffect(() => {
    if (!open) return;
    if (station) {
      const label = station.provincename
        ? `${station.stationname} — ${station.provincename}`
        : station.stationname;
      setSelectedStationLabel(label);
      return;
    }

    if (scope.stationLocked || scope.provinceLocked) {
      const fallbackLabel = user?.stationname
        ? `${user.stationname}${user?.provincename ? ` — ${user.provincename}` : ""}`
        : "";
      setSelectedStationLabel(fallbackLabel);
      return;
    }

    if (!stationNo) {
      setSelectedStationLabel("");
    }
  }, [
    open,
    station,
    stationNo,
    scope.stationLocked,
    scope.provinceLocked,
    user?.stationname,
    user?.provincename,
  ]);

  React.useEffect(() => {
    if (!open || !stationNo || stationNo === EMPTY_GUID) {
      setRevisionRequests([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setRevisionRequestsLoading(true);
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno: stationNo,
          reportyear: Number(isEditProp ? year : Number(selectedDate.slice(0, 4)) || year),
          reportmonth: 0,
          provinceno: provinceno || EMPTY_GUID,
          requesttype: "TARGET",
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
        // Backend returns isSuccess=false with "No data found." when the
        // station has no revision requests for the year — treat as empty
        // instead of surfacing a scary toast.
        const isEmptyResult = /no\s*data|not\s*found|no\s*record/i.test(error || "");
        if (!isEmptyResult) {
          toast.error(error || "Unable to load revision requests.");
        }
        setRevisionRequests([]);
      }
      setRevisionRequestsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stationNo, year, selectedDate.slice(0, 4), provinceno, reloadNonce, isEditProp]);

  // Reset baseline state when opening
  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    setCells({});
    setBaselineCells({});
    setExistingTargetNos({});
    setAutoEdit(false);
    setDuplicatePrompted(false);
    setSelectedDate(formatDateInputValue(new Date()));
    setExistingTargetno(null);
    setPendingExistingRecord(null);
    setDateDuplicateOpen(false);
    setExistingLocked(false);
    promptedDateKeyRef.current = null;
    setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });

    setYear(editing?.year ?? initialYear ?? currentYear);
    setMonth(editing?.month ?? initialMonth ?? currentMonth);
    setProvinceno(scope.provinceLocked ? scope.provinceno || user?.provinceno || "" : EMPTY_GUID);
    setProvincename(scope.provinceLocked ? scope.provincename || user?.provincename || "" : "ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    // primitives only — `editing` is a new object literal on every parent
    // render, which would otherwise wipe the freshly loaded grid values.
    editing?.year,
    editing?.month,
    editing?.stationno,
    currentYear,
    currentMonth,
    initialYear,
    initialMonth,
    scope.provinceLocked,
    scope.provinceno,
    user?.provinceno,
  ]);

  /**
   * EDIT MODE — plot the saved month grid straight from the API.
   * `/api/v1/FSISTargetReference/Detail?stationno&reportyear&reportmonth`
   * returns one row per encoded day (`targetdate`), so each row is mapped onto
   * the `${day}-${sectorno}` cell keys the grid renders. This is authoritative:
   * whatever the API returns is what gets plotted.
   */
  React.useEffect(() => {
    if (!open || !isEdit) return;
    const activeStationNo = scope.stationLocked
      ? scope.stationno || stationNo || user?.stationno || ""
      : stationNo;
    if (!activeStationNo || activeStationNo === EMPTY_GUID) return;

    let cancelled = false;
    (async () => {
      setExistingLoading(true);
      const resp = await targetreferenceAPI.getDetail(
        {
          stationno: activeStationNo,
          reportyear: Number(year),
          reportmonth: Number(month),
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<TargetReferenceDetailModel>(resp);

      const nextCells: CellMap = {};
      const nextIds: Record<string, string> = {};
      const nextEditableStatus: Record<string, number> = {};
      const nextIsRevReq: Record<string, boolean> = {};

      if (ok && data) {
        (data.targetreferencelist ?? []).forEach((it) => {
          if (it.isdeleted) return;
          const day = resolveDetailDay(it, Number(year), Number(month));
          if (!day) return;
          const dayKey = String(day);
          nextCells[`${day}-${SECTOR_NO.BPLO}`] = String(it.bplototal ?? 0);
          nextCells[`${day}-${SECTOR_NO.GOV}`] = String(it.govtotal ?? 0);
          nextCells[`${day}-${SECTOR_NO.PEZA}`] = String(it.pezatotal ?? 0);
          nextCells[`${day}-${SECTOR_NO.TIEZA}`] = String(it.tiezatotal ?? 0);
          nextEditableStatus[dayKey] = Number(it.editablestatus ?? 0);
          nextIsRevReq[dayKey] = Boolean(it.isrevisionrequest);
          if (it.targetno && it.targetno !== EMPTY_GUID) nextIds[dayKey] = it.targetno;
        });
      }

      if (cancelled) return;
      setCells(nextCells);
      setBaselineCells(nextCells);
      setExistingTargetNos(nextIds);
      setExistingEditableStatus(nextEditableStatus);
      setExistingIsRevisionRequest(nextIsRevReq);
      setErrors({});
      setExistingLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isEdit,
    stationNo,
    scope.stationLocked,
    scope.stationno,
    user?.stationno,
    year,
    month,
    reloadNonce,
  ]);

  /**
   * Existence check for the selected station + date.
   * Runs when the modal opens and whenever the date (or station) changes, so
   * the form knows whether Save should CREATE a new row or UPDATE an existing
   * one (identified by `targetno`).
   */
  React.useEffect(() => {
    if (!open || isEditProp) return;
    const activeStationNo = scope.stationLocked
      ? scope.stationno || stationNo || user?.stationno || ""
      : stationNo;
    if (!activeStationNo || activeStationNo === EMPTY_GUID || !selectedDate) {
      setExistingTargetno(null);
      setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });
      return;
    }

    const [yy, mm, dd] = selectedDate.split("-");
    const targetdate = `${mm}/${dd}/${yy}`;

    let cancelled = false;
    (async () => {
      setCheckingExisting(true);
      // Blank the inputs on every station/date switch — they are only refilled
      // when the API returns a record for that exact date.
      setCells((prev) => {
        const next = { ...prev };
        delete next.bplo;
        delete next.gov;
        delete next.peza;
        delete next.tieza;
        return next;
      });
      setBaselineCells({});
      setErrors({});

      const resp = await targetreferenceAPI.getDetailByTargetdate(
        { Stationno: activeStationNo, Targetdate: targetdate },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<TargetReferenceByDateModel[]>(resp);
      const record = ok && Array.isArray(data) ? (data.find((r) => !r.isdeleted) ?? null) : null;
      setCheckingExisting(false);

      if (record && record.targetno && record.targetno !== EMPTY_GUID) {
        setPendingExistingRecord(record);
        setExistingMeta({
          isrevisionrequest: Boolean(record.isrevisionrequest),
          editablestatus: Number(record.editablestatus ?? 0),
        });

        const isPast =
          IS_PAST_DATE_LOCK_ENABLED && parseDateInputValue(selectedDate).getTime() < startOfToday();
        const unlocked = Number(record.editablestatus ?? 0) === 153;
        const pending = !unlocked && Boolean(record.isrevisionrequest);
        const locked = !unlocked && (isPast || pending);
        setExistingLocked(locked);
        // Always confirm first — whether the record will be opened for editing
        // or will require a revision request, the user must acknowledge that a
        // Target Reference already exists for the selected date.
        const key = `${activeStationNo}|${selectedDate}`;
        if (promptedDateKeyRef.current !== key) {
          promptedDateKeyRef.current = key;
          setDateDuplicateOpen(true);
        } else if (locked) {
          plotExistingRecord(record);
        }
      } else {
        // No record for this date → back to a clean CREATE.
        setExistingTargetno(null);
        setPendingExistingRecord(null);
        setDateDuplicateOpen(false);
        setExistingLocked(false);
        promptedDateKeyRef.current = null;
        setExistingMeta({ isrevisionrequest: false, editablestatus: 0 });
        setCells((prev) => {
          const next = { ...prev };
          delete next.bplo;
          delete next.gov;
          delete next.peza;
          delete next.tieza;
          return next;
        });
        setBaselineCells({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    isEditProp,
    selectedDate,
    stationNo,
    scope.stationLocked,
    scope.stationno,
    user?.stationno,
    reloadNonce,
  ]);

  /** Plots a record's totals/remarks into the form and enables update mode. */
  function plotExistingRecord(rec: TargetReferenceByDateModel) {
    const loaded: CellMap = {
      bplo: String(rec.bplototal ?? 0),
      gov: String(rec.govtotal ?? 0),
      peza: String(rec.pezatotal ?? 0),
      tieza: String(rec.tiezatotal ?? 0),
    };
    setCells((prev) => ({ ...prev, ...loaded }));
    setBaselineCells(loaded);
    setExistingTargetno(rec.targetno);
    setErrors({});
  }

  /** Plots the existing record into the form and switches Save into update mode. */
  const handleExistingConfirm = () => {
    if (pendingExistingRecord) plotExistingRecord(pendingExistingRecord);
    setDateDuplicateOpen(false);
  };

  /** Keeps the form blank; user chose not to load the existing record. */
  const handleExistingCancel = () => {
    setDateDuplicateOpen(false);
    // Locked records stay plotted read-only so the revision-request action
    // still has a reference record to point at.
    if (existingLocked && pendingExistingRecord) {
      plotExistingRecord(pendingExistingRecord);
      return;
    }
    setPendingExistingRecord(null);
    setExistingTargetno(null);
  };

  const setCell = (day: number, sectorNo: number, raw: string) => {
    const key = `${day}-${sectorNo}`;
    setCells((prev) => ({ ...prev, [key]: toWhole(raw) }));
    if (errors[key]) {
      setErrors((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!selectedDate) {
      next.date = "Required";
    }

    // If editing a full month grid, only validate days that were modified
    if (isEdit) {
      for (const d of days) {
        const bploKey = `${d}-${SECTOR_NO.BPLO}`;
        const govKey = `${d}-${SECTOR_NO.GOV}`;
        const pezaKey = `${d}-${SECTOR_NO.PEZA}`;
        const tiezaKey = `${d}-${SECTOR_NO.TIEZA}`;
        const bplototal = Number(cells[bploKey] ?? 0);
        const govtotal = Number(cells[govKey] ?? 0);
        const pezatotal = Number(cells[pezaKey] ?? 0);
        const tiezatotal = Number(cells[tiezaKey] ?? 0);

        const baselineBplo = Number(baselineCells[bploKey] ?? 0);
        const baselineGov = Number(baselineCells[govKey] ?? 0);
        const baselinePeza = Number(baselineCells[pezaKey] ?? 0);
        const baselineTieza = Number(baselineCells[tiezaKey] ?? 0);

        const changed =
          bplototal !== baselineBplo ||
          govtotal !== baselineGov ||
          pezatotal !== baselinePeza ||
          tiezatotal !== baselineTieza;

        if (!changed) continue;

        // Validate the four sector totals for the changed row
        [
          [bploKey, bplototal],
          [govKey, govtotal],
          [pezaKey, pezatotal],
          [tiezaKey, tiezatotal],
        ].forEach(([k, v]) => {
          if (v === "" || v === null || v === undefined) {
            next[String(k)] = "Required";
            return;
          }
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0) next[String(k)] = "Invalid";
        });
      }
    } else {
      // Add mode (single date). If creating new (no existingTargetno) require all
      // four sector totals. If updating an existing date, only validate fields
      // that differ from the baseline (or remarks if changed).
      const keys = ["bplo", "gov", "peza", "tieza"];
      if (!existingTargetno) {
        keys.forEach((key) => {
          const value = cells[key] ?? "";
          if (value === "") {
            next[key] = "Required";
            return;
          }
          const n = Number(value);
          if (!Number.isInteger(n) || n < 0) next[key] = "Invalid";
        });
      } else {
        // Updating existing single-date record: validate only changed fields
        keys.forEach((key) => {
          const value = cells[key] ?? "";
          const base = baselineCells[key] ?? "";
          if (String(value).trim() === String(base).trim()) return;
          if (value === "") {
            next[key] = "Required";
            return;
          }
          const n = Number(value);
          if (!Number.isInteger(n) || n < 0) next[key] = "Invalid";
        });
        // Remarks may also be changed; no numeric validation required.
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const stationCode = stationDetails.stationCode;
  const stationName = stationDetails.stationName;
  const logoUrl = stationDetails.logoUrl;
  const cityName = stationDetails.cityName;
  const provinceLabel = stationDetails.provinceName;

  const selectedYear = Number(selectedDate.slice(0, 4));
  const selectedMonth = Number(selectedDate.slice(5, 7));
  const selectedDay = Number(selectedDate.slice(8, 10));

  /* ── Past-date lock rules (Add mode, single date) ───────────────────────── */
  const isPastSelectedDate =
    IS_PAST_DATE_LOCK_ENABLED &&
    !!selectedDate &&
    parseDateInputValue(selectedDate).getTime() < startOfToday();
  const unlockedByApproval = Number(existingMeta.editablestatus) === 153;
  /** Pending revision request for the selected date (used for cancel/delete). */
  const activeAddRequest = React.useMemo(() => {
    const wanted = String(selectedDate).slice(0, 10);
    return (
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "PENDING") return false;
        if (existingTargetno && String(r.referencekey) === String(existingTargetno)) return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === wanted : false;
      }) ?? null
    );
  }, [revisionRequests, selectedDate, existingTargetno]);
  const hasPendingRevision =
    !isEdit && !unlockedByApproval && (existingMeta.isrevisionrequest || !!activeAddRequest);
  /** Locked past date with no approval and no pending request → request revision. */
  const needsRevisionRequest =
    !isEdit && isPastSelectedDate && !unlockedByApproval && !hasPendingRevision;
  const addFieldsLocked =
    !isEdit && !unlockedByApproval && (isPastSelectedDate || hasPendingRevision);

  const handleSave = async () => {
    const submitStationNo = scope.stationLocked
      ? scope.stationno || stationNo || user?.stationno || ""
      : stationNo;

    if (submitStationNo === EMPTY_GUID) {
      toast.error("Please select a station.");
      return;
    }

    if (
      scope.provinceLocked &&
      scope.provinceno &&
      station?.provinceno &&
      String(station.provinceno) !== String(scope.provinceno)
    ) {
      toast.error("Selected station is outside your assigned province.");
      return;
    }
    if (sectors.length === 0) {
      toast.error("No government sectors available.");
      return;
    }
    if (!validate()) {
      toast.error("Please fix invalid target values.");
      return;
    }

    const list: TargetReferenceClass[] = [];

    if (isEdit) {
      for (const d of days) {
        const bploKey = `${d}-${SECTOR_NO.BPLO}`;
        const govKey = `${d}-${SECTOR_NO.GOV}`;
        const pezaKey = `${d}-${SECTOR_NO.PEZA}`;
        const tiezaKey = `${d}-${SECTOR_NO.TIEZA}`;
        const bplototal = Number(cells[bploKey] ?? 0);
        const govtotal = Number(cells[govKey] ?? 0);
        const pezatotal = Number(cells[pezaKey] ?? 0);
        const tiezatotal = Number(cells[tiezaKey] ?? 0);

        const isaccomplished =
          bplototal !== Number(baselineCells[bploKey] ?? 0) ||
          govtotal !== Number(baselineCells[govKey] ?? 0) ||
          pezatotal !== Number(baselineCells[pezaKey] ?? 0) ||
          tiezatotal !== Number(baselineCells[tiezaKey] ?? 0);

        if (!isaccomplished) continue; // only include changed rows

        const existingTargetNo = existingTargetNos[String(d)];
        list.push({
          targetno:
            existingTargetNo && existingTargetNo !== EMPTY_GUID ? existingTargetNo : EMPTY_GUID,
          targetdate: toTargetDate(Number(year), Number(month), Number(d)),
          bplototal,
          govtotal,
          pezatotal,
          tiezatotal,
          isaccomplished,
        } as TargetReferenceClass);
      }
    } else {
      const bplototal = Number(cells[`bplo`] ?? 0);
      const govtotal = Number(cells[`gov`] ?? 0);
      const pezatotal = Number(cells[`peza`] ?? 0);
      const tiezatotal = Number(cells[`tieza`] ?? 0);

      const changed =
        bplototal !== Number(baselineCells[`bplo`] ?? 0) ||
        govtotal !== Number(baselineCells[`gov`] ?? 0) ||
        pezatotal !== Number(baselineCells[`peza`] ?? 0) ||
        tiezatotal !== Number(baselineCells[`tieza`] ?? 0);

      // If nothing changed and there is no existing target, treat as create
      // only when there are values (validate above will have enforced this).
      if (!changed && !existingTargetno) {
        // nothing to save
      } else if (!changed && existingTargetno) {
        // No changes detected for existing record — nothing to send
      } else {
        list.push({
          targetno: existingTargetno || EMPTY_GUID,
          targetdate: toTargetDate(selectedYear, selectedMonth, selectedDay),
          bplototal,
          govtotal,
          pezatotal,
          tiezatotal,
          isaccomplished: Boolean(existingTargetno),
        } as TargetReferenceClass);
      }
    }

    // If there are no changed rows to send, inform the user and do nothing.
    if (list.length === 0) {
      toast.info("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const resp = await targetreferenceAPI.create({
        stationno: submitStationNo,
        provinceno: provinceno || EMPTY_GUID,
        encodedby: user?.memberno ?? "",
        targetreferencelist: list,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save target reference.");
        return;
      }
      toast.success(
        isEdit || existingTargetno ? "Target reference updated." : "Target reference added.",
      );
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Totals (whole-number sums)
  const dayTotal = React.useCallback(
    (d: number) => sectors.reduce((sum, s) => sum + (Number(cells[`${d}-${s.detno}`]) || 0), 0),
    [sectors, cells],
  );
  const sectorTotal = React.useCallback(
    (sn: number) => days.reduce((sum, d) => sum + (Number(cells[`${d}-${sn}`]) || 0), 0),
    [cells, days],
  );
  const grandTotal = React.useMemo(
    () => days.reduce((sum, d) => sum + dayTotal(d), 0),
    [dayTotal, days],
  );

  const loadingGrid = sectorsLoading || existingLoading;

  const isDirty = React.useMemo(() => {
    const norm = (v: string | undefined) => {
      const t = (v ?? "").trim();
      if (t === "") return "";
      const n = Number(t);
      return Number.isFinite(n) ? String(n) : t;
    };
    const keys = new Set([...Object.keys(cells), ...Object.keys(baselineCells)]);
    for (const k of keys) {
      if (norm(cells[k]) !== norm(baselineCells[k])) return true;
    }
    return false;
  }, [cells, baselineCells]);

  /** Switch the reporting period (month / year) being edited. */
  const changePeriod = (nextMonth: number, nextYear: number) => {
    if (nextMonth === month && nextYear === year) return;
    if (isDirty) {
      toast.error("Save or discard your changes before switching the reporting period.");
      return;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  const handleDuplicateConfirm = () => {
    if (pendingDuplicateData) {
      setAutoEdit(true);
      setCells(pendingDuplicateData.cells);
      setBaselineCells(pendingDuplicateData.cells);
      setExistingTargetNos(pendingDuplicateData.ids);
      setPendingDuplicateData(null);
    }
    setDuplicateDialogOpen(false);
  };

  const handleDuplicateCancel = () => {
    setCells({});
    setBaselineCells({});
    setExistingTargetNos({});
    setPendingDuplicateData(null);
    setDuplicateDialogOpen(false);
    setDuplicatePrompted(false); // Reset flag so user can try again with different station/year
  };

  // Handle dialog close via onOpenChange (when user clicks outside or closes)
  const handleDuplicateDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && !pendingDuplicateData) {
      // Dialog was closed without confirming, reset the prompted flag
      setDuplicatePrompted(false);
    }
    setDuplicateDialogOpen(newOpen);
  };

  const lockedFieldClass =
    "cursor-not-allowed bg-muted/50 text-muted-foreground focus:border-border focus:ring-0";

  const addBody = (
    <div className="grid gap-6 px-4 py-4 sm:px-6">
      {addFieldsLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {hasPendingRevision
              ? "A revision request for this date is pending approval. Fields stay locked until it is approved."
              : "This date has already passed and is locked. Submit a revision request to enable editing."}
          </span>
        </div>
      )}
      <div className="grid gap-6 rounded-3xl border border-border/80 bg-surface p-4 sm:grid-cols-2">
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-reference-bplo">
              BPLO <span className="text-destructive">*</span>
            </Label>
            <input
              id="target-reference-bplo"
              {...numericFieldProps({
                value: cells[`bplo`],
                onValueChange: (raw) => setField("bplo", raw),
                disabled: addFieldsLocked,
              })}
              readOnly={addFieldsLocked}
              className={cn(
                "h-12 w-full rounded-xl border bg-background px-3 text-center text-sm tabular-nums outline-none transition focus:border-primary focus:ring-1 focus:ring-primary",
                errors.bplo && "border-destructive focus:border-destructive focus:ring-destructive",
                addFieldsLocked && lockedFieldClass,
              )}
              aria-invalid={Boolean(errors.bplo)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-reference-gov">
              GOV <span className="text-destructive">*</span>
            </Label>
            <input
              id="target-reference-gov"
              {...numericFieldProps({
                value: cells[`gov`],
                onValueChange: (raw) => setField("gov", raw),
                disabled: addFieldsLocked,
              })}
              readOnly={addFieldsLocked}
              className={cn(
                "h-12 w-full rounded-xl border bg-background px-3 text-center text-sm tabular-nums outline-none transition focus:border-primary focus:ring-1 focus:ring-primary",
                errors.gov && "border-destructive focus:border-destructive focus:ring-destructive",
                addFieldsLocked && lockedFieldClass,
              )}
              aria-invalid={Boolean(errors.gov)}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-reference-peza">
              PEZA <span className="text-destructive">*</span>
            </Label>
            <input
              id="target-reference-peza"
              {...numericFieldProps({
                value: cells[`peza`],
                onValueChange: (raw) => setField("peza", raw),
                disabled: addFieldsLocked,
              })}
              readOnly={addFieldsLocked}
              className={cn(
                "h-12 w-full rounded-xl border bg-background px-3 text-center text-sm tabular-nums outline-none transition focus:border-primary focus:ring-1 focus:ring-primary",
                errors.peza && "border-destructive focus:border-destructive focus:ring-destructive",
                addFieldsLocked && lockedFieldClass,
              )}
              aria-invalid={Boolean(errors.peza)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="target-reference-tieza">
              TIEZA <span className="text-destructive">*</span>
            </Label>
            <input
              id="target-reference-tieza"
              {...numericFieldProps({
                value: cells[`tieza`],
                onValueChange: (raw) => setField("tieza", raw),
                disabled: addFieldsLocked,
              })}
              readOnly={addFieldsLocked}
              className={cn(
                "h-12 w-full rounded-xl border bg-background px-3 text-center text-sm tabular-nums outline-none transition focus:border-primary focus:ring-1 focus:ring-primary",
                errors.tieza &&
                  "border-destructive focus:border-destructive focus:ring-destructive",
                addFieldsLocked && lockedFieldClass,
              )}
              aria-invalid={Boolean(errors.tieza)}
            />
          </div>
        </div>
      </div>

      {/* Remarks removed from Target Reference form */}
    </div>
  );

  const editBody = loadingGrid ? (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  ) : sectors.length === 0 ? (
    <div className="py-10 text-center text-sm text-muted-foreground">
      No government sectors available.
    </div>
  ) : (
    <div className="w-full max-w-full overflow-auto" style={{ maxHeight: "70vh" }}>
      <table className="min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="bg-card text-left uppercase tracking-[0.15em] text-primary">
            <th className="min-w-[96px] border-b border-r border-border/60 bg-card px-3 py-2 text-center font-semibold">
              ACTION
            </th>
            <th className="border-b border-border/60 px-3 py-2 font-semibold bg-card">Date</th>
            {sectors.map((s) => (
              <th
                key={s.detno}
                className="border-b border-border/60 bg-card px-3 py-2 text-center font-semibold"
                title={s.description}
              >
                {s.recordcode || s.description}
              </th>
            ))}
            <th className="border-b border-l border-border/60 bg-card px-3 py-2 text-center font-semibold">
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => {
            const revStation = stationNo && stationNo !== EMPTY_GUID ? stationNo : "";
            const activeReq = revisionRequests.find(
              (req) =>
                Number(req.reportmonth) === Number(month) &&
                Number((req as { reportday?: number }).reportday || d) === Number(d) &&
                req.statuscode?.toUpperCase() === "PENDING",
            );
            const editablestatus = existingEditableStatus[String(d)];
            const serverIsRevisionRequest = Boolean(existingIsRevisionRequest?.[String(d)]);
            const serverIsEditable = editablestatus === 153;
            const pstLockActive = hasPstLockActivated(year, Number(month));
            const isEditable = serverIsEditable || !pstLockActive;
            const row = {
              isrevisionrequest: serverIsRevisionRequest || Boolean(activeReq),
            };

            return (
              <tr key={d} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                <td className="min-w-[96px] border-r border-border/60 bg-card px-2 py-1.5 text-center">
                  {row.isrevisionrequest ? (
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
                  ) : isEditable ? null : (
                    <div className="flex items-center justify-center gap-1.5">
                      <EditButton
                        variant="square"
                        tooltip={
                          !revStation
                            ? "Select a station to request a revision"
                            : "Request Revision"
                        }
                        ariaLabel={
                          !revStation
                            ? "Select a station to request a revision"
                            : "Request Revision"
                        }
                        disabled={!revStation}
                        icon={<FilePen className="h-4 w-4" />}
                        onClick={() => setRevisionDay(Number(d))}
                      />
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                  <div className="flex items-center gap-2">
                    {!isEditable && (
                      <Lock className="h-3 w-3 text-warning" aria-label="Locked day" />
                    )}
                    <span className="whitespace-nowrap">{formatDayLabel(year, month, d)}</span>
                    {activeReq ? (
                      <RevisionStatusBadge
                        status={
                          activeReq.statuscode?.toUpperCase() === "PENDING"
                            ? "PENDING"
                            : activeReq.statuscode?.toUpperCase() === "APPROVED"
                              ? "APPROVED"
                              : "CANCELLED"
                        }
                      />
                    ) : null}
                  </div>
                </td>
                {sectors.map((s) => {
                  const key = `${d}-${s.detno}`;
                  const hasErr = Boolean(errors[key]);
                  const val = cells[key] ?? "";
                  const locked = !isEditable;
                  return (
                    <td key={s.detno} className="px-2 py-1">
                      <input
                        {...numericFieldProps({
                          value: val,
                          onValueChange: (raw) => setCell(d, Number(s.detno), raw),
                          disabled: locked,
                        })}
                        readOnly={locked}
                        tabIndex={locked ? -1 : 0}
                        aria-invalid={hasErr}
                        aria-readonly={locked}
                        title={locked ? "This row is not editable." : undefined}
                        className={cn(
                          "h-8 w-full min-w-[80px] rounded-md border bg-background px-2 text-center text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary",
                          hasErr &&
                            "border-destructive focus:border-destructive focus:ring-destructive",
                          locked &&
                            "cursor-not-allowed bg-muted/50 text-muted-foreground focus:border-border focus:ring-0",
                        )}
                      />
                    </td>
                  );
                })}
                <td className="border-l border-border/60 bg-card px-3 py-1.5 text-center font-semibold tabular-nums text-primary">
                  {dayTotal(d).toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="sticky bottom-0 bg-card">
          <tr className="text-primary bg-card">
            <td className="border-r border-t border-border/60 bg-card px-3 py-2" />
            <td className="border-t border-border/60 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.15em] bg-card">
              TOTAL
            </td>
            {sectors.map((s) => (
              <td
                key={s.detno}
                className="border-t border-border/60 bg-card px-3 py-2 text-center font-bold tabular-nums"
              >
                {sectorTotal(Number(s.detno)).toLocaleString()}
              </td>
            ))}
            <td className="border-l border-t border-border/60 bg-card px-3 py-2 text-center font-bold tabular-nums">
              {grandTotal.toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const formBody = isEdit ? editBody : addBody;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:rounded-xl"
        >
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FilePlus2 className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {isEdit ? "Edit Target Reference" : "Target Reference Entry"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Record target references per station and reporting period — monthly, quarterly,
                  semi-annual, and annual totals are auto-computed.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Reporting Period card */}
            <Card className="space-y-4 border-border/60 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <StationSectionTitle
                  icon={<Calendar className="h-4 w-4" />}
                  title="Reporting Period"
                />
                {isEdit && (month !== currentMonth || year !== currentYear) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => changePeriod(currentMonth, currentYear)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to {MONTHS.find((mo) => mo.value === currentMonth)?.name} {currentYear}
                  </Button>
                )}
              </div>
              {isEdit ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Month</span>
                    <Select
                      value={String(month)}
                      onValueChange={(value) => changePeriod(Number(value), year)}
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
                      value={String(year)}
                      onValueChange={(value) => changePeriod(month, Number(value))}
                    >
                      <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 sm:max-w-sm">
                  <Label className="text-xs font-semibold">
                    Reporting Period As Of <span className="text-destructive">*</span>
                  </Label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-11 w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground",
                          errors.date && "border-destructive",
                        )}
                        aria-invalid={Boolean(errors.date)}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate ? formatLongOrdinalDate(selectedDate) : "Pick a date"}
                        {checkingExisting && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={selectedDate ? parseDateInputValue(selectedDate) : undefined}
                        defaultMonth={selectedDate ? parseDateInputValue(selectedDate) : new Date()}
                        month={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        onSelect={(d) => {
                          if (!d) return;
                          setSelectedDate(formatDateInputValue(d));
                          setDateOpen(false);
                          if (errors.date) {
                            setErrors((e) => {
                              const n = { ...e };
                              delete n.date;
                              return n;
                            });
                          }
                        }}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <PastDatesLockedNote />
            </Card>

            {/* Station Information card */}
            <StationInfoCard
              stationName={stationName || (stationDetails.loading ? "Loading…" : "")}
              unitCode={stationCode || ""}
              logoUrl={logoUrl || null}
              fields={[
                {
                  label: "Station Code",
                  value: stationCode || (stationDetails.loading ? "Loading…" : ""),
                },
                {
                  label: "City / Municipality",
                  value: cityName || (stationDetails.loading ? "Loading…" : ""),
                },
                {
                  label: "Province",
                  value: provinceLabel || (stationDetails.loading ? "Loading…" : ""),
                },
              ]}
            >
              {!(isEdit || scope.stationLocked) && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Station</Label>
                  <StationSearchSelect
                    value={stationNo}
                    valueName={selectedStationLabel}
                    provinceno={scope.provinceLocked ? scope.provinceno : provinceno || undefined}
                    onChange={(stationno, stationname, province, station) => {
                      setStationNo(stationno);
                      setStation(station ?? null);
                      if (station?.provinceno) {
                        setProvinceno(station.provinceno);
                        setProvincename(station.provincename || province || "");
                      }
                      setSelectedStationLabel(
                        province ? `${stationname} — ${province}` : stationname,
                      );
                    }}
                    readOnly={isEdit || scope.stationLocked}
                    showAllOption={canShowAllStationOption}
                    placeholder={
                      scope.stationLocked ? "Restricted to your assigned station" : "Select station"
                    }
                  />
                </div>
              )}
            </StationInfoCard>

            <div className="flex flex-col rounded-lg border border-border/60 overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                  Daily Target Reference
                </span>
              </div>

              {formBody}
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-5 py-3">
            {needsRevisionRequest ? (
              <Button
                onClick={() => {
                  if (!stationNo || stationNo === EMPTY_GUID) {
                    toast.error("Please select a station first.");
                    return;
                  }
                  setAddRevisionOpen(true);
                }}
                className="gap-2 bg-primary text-white hover:bg-primary/90"
              >
                <FilePen className="h-4 w-4" /> Request Revision
              </Button>
            ) : hasPendingRevision ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (activeAddRequest) setCancelRequestId(activeAddRequest.requestno);
                    else toast.info("No active revision request to cancel.");
                  }}
                  className="gap-2"
                >
                  <Ban className="h-4 w-4" /> Cancel Request
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (activeAddRequest) setDeleteRequestId(activeAddRequest.requestno);
                    else toast.info("No revision request to delete.");
                  }}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete Request
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="gap-2"
                  disabled={saving}
                >
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    saving ||
                    loadingGrid ||
                    checkingExisting ||
                    sectors.length === 0 ||
                    // In add mode with an existing record loaded, Save always updates
                    // — even when nothing changed.
                    (isEdit ? !isDirty : !existingTargetno && !isDirty)
                  }
                  className="gap-2 bg-primary text-white hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />{" "}
                  {saving ? "Saving…" : existingTargetno && !isEdit ? "Update" : "Save"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={duplicateDialogOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-warning-soft"
        contentIconColorClass="text-warning"
        title="Target Reference Already Exists"
        description={`A Target Reference already exists for this station and period (${MONTHS.find((mo) => mo.value === month)?.name ?? month} ${year}).\n\nOpening the existing record for editing.`}
        confirmLabel="Edit Existing"
        showCancel={false}
        dismissible={false}
        onConfirm={handleDuplicateConfirm}
      />

      <ConfirmDialog
        open={dateDuplicateOpen}
        onOpenChange={(v) => {
          if (!v) handleExistingCancel();
          else setDateDuplicateOpen(true);
        }}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-warning-soft"
        contentIconColorClass="text-warning"
        title="Target Reference Already Exists"
        description={`A Target Reference already exists for ${
          pendingExistingRecord?.stationname || stationName || "this station"
        } on ${formatLongDate(selectedDate)}.\n\n${
          existingLocked
            ? "This record is already locked — it will be opened as read-only and any change will require a revision request."
            : "Do you want to load and edit the existing record?"
        }`}
        confirmLabel={existingLocked ? "Open Record" : "Edit Existing"}
        showCancel={false}
        dismissible={false}
        onConfirm={handleExistingConfirm}
      />

      {addRevisionOpen && (
        <RevisionRequestDialog
          open={addRevisionOpen}
          onOpenChange={(v) => setAddRevisionOpen(v)}
          station={{
            stationno: stationNo,
            stationcode: stationCode || "",
            stationname: stationName || "",
            provinceno: provinceno,
            provincename: provincename,
            cityname: station?.cityname ?? user?.cityname ?? "",
          }}
          year={selectedYear}
          month={selectedMonth}
          referencekey={existingTargetno || EMPTY_GUID}
          dateinspected={selectedDate}
          onSubmitted={() => setReloadNonce((n) => n + 1)}
        />
      )}

      {revisionDay !== null && (
        <RevisionRequestDialog
          open={revisionDay !== null}
          onOpenChange={(v) => !v && setRevisionDay(null)}
          station={{
            stationno: stationNo,
            stationcode: stationCode || "",
            stationname: stationName || "",
            provinceno: provinceno,
            provincename: provincename,
            cityname: station?.cityname ?? user?.cityname ?? "",
          }}
          year={Number(year)}
          month={Number(month)}
          referencekey={
            existingTargetNos[String(revisionDay)] &&
            existingTargetNos[String(revisionDay)] !== EMPTY_GUID
              ? existingTargetNos[String(revisionDay)]
              : EMPTY_GUID
          }
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
        onConfirm={async ({ reason, remarks }) => {
          if (!cancelRequestId) return;
          const resp = await revisionrequestAPI.status({
            requestno: cancelRequestId,
            stationno: stationNo || EMPTY_GUID,
            requesttype: "TARGET",
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
    </>
  );
}
