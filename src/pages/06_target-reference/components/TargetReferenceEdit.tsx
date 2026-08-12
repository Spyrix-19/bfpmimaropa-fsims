import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Building2,
  Calendar,
  RotateCcw,
  Loader2,
  Lock,
  FilePen,
  Save,
  X,
  AlertTriangle,
  Trash2,
  Ban,
} from "lucide-react";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import { toast } from "@/lib/toast";
import { cn, toWhole, buildYears } from "@/lib/utils";
import { numericFieldProps, toWholeNumber } from "@/components/numeric-input";
import { MONTHS, SECTORS, SECTOR_NO } from "@/lib/fsims-constants";

import AvatarWithFallback from "@/components/avatar-with-fallback";

import StationSearchSelect from "@/components/station-search-select";
import StationInfoCard from "@/components/station-info-card";
import { Card } from "@/components/ui/card";

import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import type { SearchStationModel } from "@/types/stationTypes";

import type { TargetReferenceClass, TargetReferenceDetailModel } from "@/types/targetreferenceType";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import { resolveTargetScope, buildDays, formatDayLabel } from "../helpers";
import RevisionRequestDialog from "../revision/RevisionRequestDialog";
import ReasonRemarksDialog from "../revision/ReasonRemarksDialog";
import RevisionStatusBadge from "../revision/RevisionStatusBadge";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

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
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
}

/**
 * Resolves the day-of-month for a Detail row.
 * The API returns `targetdate` (e.g. "2026-07-29T00:00:00"); older payloads may
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
      return Number(m[3]);
    }
  }
  if (it.reportmonth != null) {
    if (Number(it.reportmonth) !== Number(month)) return null;
    if (it.reportyear != null && Number(it.reportyear) !== Number(year)) return null;
    return Number(it.reportday ?? 0) || null;
  }
  return null;
}

function isPastTargetDate(
  year: number,
  month: number,
  day: number,
  now: Date = new Date(),
): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  const targetDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0));
  const todayAtMidnight = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
  );
  return targetDate.getTime() < todayAtMidnight.getTime();
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
  const basePeriodYear = editing?.year ?? initialYear ?? currentYear;
  const basePeriodMonth = editing?.month ?? initialMonth ?? currentMonth;
  const isPeriodChanged = month !== basePeriodMonth || year !== basePeriodYear;
  const changePeriod = React.useCallback((nextMonth: number, nextYear: number) => {
    setMonth(nextMonth);
    setYear(nextYear);
    setDuplicatePrompted(false);
    setAutoEdit(false);
  }, []);
  const currentDay = today.getDate();
  /**
   * Duplicate/existence checks are DATE-based, not month-based: only the
   * specific target date being encoded (today, within the selected period)
   * counts as an existing record.
   */
  const checkDayKey = React.useMemo(
    () => (year === currentYear && month === currentMonth ? String(currentDay) : null),
    [year, month, currentYear, currentMonth, currentDay],
  );
  const checkDateLabel = React.useMemo(
    () =>
      new Date(year, month - 1, checkDayKey ? Number(checkDayKey) : 1).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [year, month, checkDayKey],
  );
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
    editableStatus?: Record<string, number>;
    isRevisionRequest?: Record<string, boolean>;
  } | null>(null);

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
  const [stationLoading, setStationLoading] = React.useState(false);
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

  React.useEffect(() => {
    if (!open || !stationNo || stationNo === EMPTY_GUID) {
      setStation(null);
      return;
    }
    if (station?.stationno === stationNo) return;

    let cancelled = false;
    (async () => {
      setStationLoading(true);
      if (isEdit) {
        const resp = await targetreferenceAPI.getDetail(
          { stationno: stationNo, reportyear: Number(year) },
          { suppressGlobalLoading: true },
        );
        const { ok, data } = unwrap<TargetReferenceDetailModel>(resp);
        if (cancelled) return;
        const detail = ok ? data : null;
        if (detail) {
          const nextStation: SearchStationModel = {
            stationno: detail.stationno,
            stationcode: detail.stationcode ?? "",
            stationname: detail.stationname ?? "",
            regionno: "",
            regioncode: "",
            regionname: "",
            provinceno: detail.provinceno ?? "",
            provincename: detail.provincename ?? "",
            cityno: "",
            cityname: "",
            zipcode: "",
            barangayno: "",
            barangayname: "",
            streetaddress: "",
            logourl: detail.logourl ?? "",
            filetype: "",
          };
          setStation(nextStation);
          if (!scope.provinceLocked) {
            setProvinceno(detail.provinceno || EMPTY_GUID);
            setProvincename(detail.provincename || "");
          }
          setSelectedStationLabel(
            `${detail.stationname}${detail.provincename ? ` — ${detail.provincename}` : ""}`,
          );
        }
      } else {
        // Backend search is text-based (stationcode/name), not GUID.
        // Query with the login's stationcode, then pick the row whose stationno
        // matches — the dropdown becomes the single source of truth.
        const searchKey = user?.stationcode || user?.stationname || "";
        const resp = await stationAPI.search(
          {
            searchKey,
            provinceno: scope.provinceLocked ? scope.provinceno || undefined : undefined,
            pageNumber: 1,
            pageSize: 20,
          },
          { suppressGlobalLoading: true },
        );
        const { ok, data } = unwrap<SearchStationModel[]>(resp);
        if (cancelled) return;
        const list = ok && Array.isArray(data) ? data : [];
        const nextStation =
          list.find((s) => String(s.stationno) === String(stationNo)) ?? list[0] ?? null;
        setStation(nextStation);
      }
      setStationLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    stationNo,
    station,
    scope.provinceLocked,
    scope.provinceno,
    user?.stationcode,
    user?.stationname,
    isEdit,
    year,
  ]);

  // Fixed sector constants live in @/lib/fsims-constants (SECTORS).
  // 111=BPLO, 112=GOV, 113=PEZA, 114=TIEZA (OGA=115 intentionally excluded).
  const sectors = SECTORS;
  const sectorsLoading = false;

  const [existingLoading, setExistingLoading] = React.useState(false);
  // True once a period has been fetched at least once for this open dialog —
  // keeps the grid visible while another period loads (no blink).
  const [gridLoadedOnce, setGridLoadedOnce] = React.useState(false);
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
          reportyear: Number(year),
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
  }, [open, stationNo, year, provinceno, reloadNonce]);

  // Reset baseline state when opening.
  // NOTE: depend on primitive fields (not the `editing` object) — the parent
  // passes a new object literal on every render, which previously re-ran this
  // effect and wiped the freshly loaded grid values.
  const editingYear = editing?.year;
  const editingMonth = editing?.month;
  React.useEffect(() => {
    if (!open) return;
    setErrors({});
    setSaving(false);
    setCells({});
    setBaselineCells({});
    setExistingTargetNos({});
    setAutoEdit(false);
    setDuplicatePrompted(false);
    setGridLoadedOnce(false);
    setYear(editingYear ?? initialYear ?? currentYear);
    setMonth(editingMonth ?? initialMonth ?? currentMonth);
    setProvinceno(scope.provinceLocked ? scope.provinceno || user?.provinceno || "" : EMPTY_GUID);
    setProvincename(scope.provinceLocked ? scope.provincename || user?.provincename || "" : "ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    editingYear,
    editingMonth,
    currentYear,
    currentMonth,
    initialYear,
    initialMonth,
    scope.provinceLocked,
    scope.provinceno,
    user?.provinceno,
  ]);


  // Load existing values for edit — Detail endpoint returns the station's
  // full year in a single call, including database TargetNo for each cell.
  React.useEffect(() => {
    if (!open || !stationNo || stationNo === EMPTY_GUID) return;
    let cancelled = false;
    (async () => {
      setExistingLoading(true);
      const resp = await targetreferenceAPI.getDetail(
        { stationno: stationNo, reportyear: Number(year), reportmonth: Number(month) },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<TargetReferenceDetailModel>(resp);
      if (cancelled) return;
      const nextCells: CellMap = {};
      const nextIds: Record<string, string> = {};
      const nextEditableStatus: Record<string, number> = {};
      const nextIsRevReq: Record<string, boolean> = {};
      if (ok && data) {
        (data.targetreferencelist ?? []).forEach((it) => {
          // Daily mapping — API returns `targetdate` per day of the month.
          const day = resolveDetailDay(it, Number(year), Number(month));
          if (!day || day < 1 || day > days.length) return;
          const dayKey = String(day);
          nextCells[`${day}-${SECTOR_NO.BPLO}`] = String(it.bplototal ?? 0);
          nextCells[`${day}-${SECTOR_NO.GOV}`] = String(it.govtotal ?? 0);
          nextCells[`${day}-${SECTOR_NO.PEZA}`] = String(it.pezatotal ?? 0);
          nextCells[`${day}-${SECTOR_NO.TIEZA}`] = String(it.tiezatotal ?? 0);
          nextEditableStatus[dayKey] = Number(it.editablestatus ?? 0);
          nextIsRevReq[dayKey] = Boolean(it.isrevisionrequest);
          if (it.targetno && it.targetno !== EMPTY_GUID) {
            nextIds[dayKey] = it.targetno;
          }
        });
      }

      // Duplicate detection during Add: DATE-based — only prompt when a target
      // already exists for the exact date being encoded (not anywhere in the month).
      const dateHasSaved = Boolean(checkDayKey && nextIds[checkDayKey]);
      if (!isEditProp && dateHasSaved && !duplicatePrompted) {
        setDuplicatePrompted(true);
        setPendingDuplicateData({
          cells: nextCells,
          ids: nextIds,
          editableStatus: nextEditableStatus,
          isRevisionRequest: nextIsRevReq,
        });
        setDuplicateDialogOpen(true);
        setExistingLoading(false);
        setGridLoadedOnce(true);
        return;
      }

      setCells(nextCells);
      setBaselineCells(nextCells);
      setExistingTargetNos(nextIds);
      setExistingEditableStatus(nextEditableStatus);
      setExistingIsRevisionRequest(nextIsRevReq);
      setExistingLoading(false);
      setGridLoadedOnce(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    stationNo,
    year,
    month,
    days.length,
    isEditProp,
    duplicatePrompted,
    onOpenChange,
    reloadNonce,
    checkDayKey,
  ]);

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

  /** Returns the invalid cell keys (empty array = valid). */
  const validate = (): string[] => {
    const next: Record<string, string> = {};
    Object.entries(cells).forEach(([k, v]) => {
      if (v === "") return;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) next[k] = "Invalid";
    });
    setErrors(next);
    return Object.keys(next);
  };


  const buildExistingTargetData = (detail: TargetReferenceDetailModel | null) => {
    const nextCells: CellMap = {};
    const nextIds: Record<string, string> = {};
    const nextEditableStatus: Record<string, number> = {};
    const nextIsRevReq: Record<string, boolean> = {};

    // API returns a full day-by-day scaffold for the station+year+month, with
    // unsaved days carrying targetno === EMPTY_GUID and zero totals.
    // Treat only rows with a real targetno as actually saved data.
    (detail?.targetreferencelist ?? []).forEach((it) => {
      const day = resolveDetailDay(it, Number(year), Number(month));
      if (!day || day < 1 || day > days.length) return;
      const dayKey = String(day);
      nextEditableStatus[dayKey] = Number(it.editablestatus ?? 0);
      nextIsRevReq[dayKey] = Boolean(it.isrevisionrequest);
      // Values coming from the API are normalized to whole, non-negative
      // numbers so a null / decimal / formatted total can never make the grid
      // fail client-side validation on save.
      nextCells[`${day}-${SECTOR_NO.BPLO}`] = String(toWholeNumber(it.bplototal));
      nextCells[`${day}-${SECTOR_NO.GOV}`] = String(toWholeNumber(it.govtotal));
      nextCells[`${day}-${SECTOR_NO.PEZA}`] = String(toWholeNumber(it.pezatotal));
      nextCells[`${day}-${SECTOR_NO.TIEZA}`] = String(toWholeNumber(it.tiezatotal));

      const isSaved = Boolean(it.targetno) && it.targetno !== EMPTY_GUID;
      if (!isSaved) return;
      nextIds[dayKey] = it.targetno;
    });

    return {
      cells: nextCells,
      ids: nextIds,
      editableStatus: nextEditableStatus,
      isRevisionRequest: nextIsRevReq,
    };
  };

  /** Fetches and maps the saved period data (no date gating). */
  const fetchExistingTargetData = async (stationNumber: string, reportYear: number) => {
    const resp = await targetreferenceAPI.getDetail(
      { stationno: stationNumber, reportyear: reportYear, reportmonth: Number(month) },
      { suppressGlobalLoading: true },
    );

    const { ok, data, error } = unwrap<TargetReferenceDetailModel>(resp);
    if (!ok) {
      // "No data found" from the backend just means nothing exists yet —
      // it's not an error worth showing to the user during duplicate checks.
      const isEmptyResult = /no\s*data|not\s*found|no\s*record/i.test(error || "");
      if (!isEmptyResult) {
        toast.error(error || "Unable to verify existing target reference.");
      }
      return null;
    }
    if (!data) return null;
    return buildExistingTargetData(data);
  };

  const checkExistingTargetReference = async (stationNumber: string, reportYear: number) => {
    const built = await fetchExistingTargetData(stationNumber, reportYear);
    if (!built) return null;
    // Date-based: nothing to duplicate unless the exact target date is saved.
    if (!checkDayKey || !built.ids[checkDayKey]) return null;
    return built;
  };

  const stationCode = station?.stationcode ?? "";
  const stationName = station?.stationname ?? "";
  const logoUrl = station?.logourl ?? "";
  const completeAddress = station?.provincename ?? "";

  const handleSave = async () => {
    const submitStationNo = scope.stationLocked
      ? scope.stationno || stationNo || user?.stationno || ""
      : stationNo;

    if (submitStationNo === EMPTY_GUID) {
      toast.error("Please select a station.");
      return;
    }

    if (!isEdit && !duplicatePrompted) {
      const existing = await checkExistingTargetReference(submitStationNo, Number(year));
      if (existing && Object.keys(existing.cells).length > 0) {
        setPendingDuplicateData(existing);
        setDuplicatePrompted(true);
        setDuplicateDialogOpen(true);
        return;
      }
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
    const invalidKeys = validate();
    if (invalidKeys.length > 0) {
      const detail = invalidKeys
        .slice(0, 3)
        .map((k) => {
          const [d, sn] = k.split("-");
          const sector = sectors.find((s) => String(s.detno) === sn);
          return `${formatDayLabel(year, month, Number(d))} · ${sector?.description ?? `Sector ${sn}`} = "${cells[k]}"`;
        })
        .join("; ");
      toast.error(`Please fix invalid target values: ${detail}`);
      return;
    }


    let resolvedExistingTargetNos = existingTargetNos;
    if (isEdit) {
      const existingLookup = await fetchExistingTargetData(submitStationNo, Number(year));
      if (existingLookup?.ids && Object.keys(existingLookup.ids).length > 0) {
        resolvedExistingTargetNos = { ...existingTargetNos, ...existingLookup.ids };
        setExistingTargetNos(resolvedExistingTargetNos);
      }
    }

    // Only send days that actually changed against the loaded baseline.
    // Untouched days (typically future dates with no value) are skipped so the
    // backend does not count them as encoded/accomplished days.
    const list: TargetReferenceClass[] = [];
    days.forEach((d) => {
      const bploKey = `${d}-${SECTOR_NO.BPLO}`;
      const govKey = `${d}-${SECTOR_NO.GOV}`;
      const pezaKey = `${d}-${SECTOR_NO.PEZA}`;
      const tiezaKey = `${d}-${SECTOR_NO.TIEZA}`;
      const bplototal = Number(cells[bploKey] ?? 0);
      const govtotal = Number(cells[govKey] ?? 0);
      const pezatotal = Number(cells[pezaKey] ?? 0);
      const tiezatotal = Number(cells[tiezaKey] ?? 0);
      // isaccomplished = true when any of the four totals differ from the
      // originally loaded baseline (from targetreferenceAPI.getDetail).
      const isaccomplished =
        bplototal !== Number(baselineCells[bploKey] ?? 0) ||
        govtotal !== Number(baselineCells[govKey] ?? 0) ||
        pezatotal !== Number(baselineCells[pezaKey] ?? 0) ||
        tiezatotal !== Number(baselineCells[tiezaKey] ?? 0);
      if (!isaccomplished) return;
      const existingTargetNo = resolvedExistingTargetNos[String(d)];
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
    });

    if (list.length === 0) {
      toast.info("No changes to save.");
      onOpenChange(false);
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
      toast.success(isEdit ? "Target reference updated." : "Target reference added.");
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

  const handleDuplicateConfirm = () => {
    if (pendingDuplicateData) {
      setAutoEdit(true);
      setCells(pendingDuplicateData.cells);
      setBaselineCells(pendingDuplicateData.cells);
      setExistingTargetNos(pendingDuplicateData.ids);
      setExistingEditableStatus(pendingDuplicateData.editableStatus ?? {});
      setExistingIsRevisionRequest(pendingDuplicateData.isRevisionRequest ?? {});
      setPendingDuplicateData(null);
    }
    setDuplicateDialogOpen(false);
  };

  const handleDuplicateCancel = () => {
    setCells({});
    setBaselineCells({});
    setExistingTargetNos({});
    setExistingEditableStatus({});
    setExistingIsRevisionRequest({});
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

  const tableBody =
    loadingGrid && !gridLoadedOnce ? (
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
                  Number((req as { reportday?: number }).reportday ?? d) === Number(d) &&
                  req.statuscode?.toUpperCase() === "PENDING",
              );
              // Server-driven flags (only source of truth for editability + action state)
              const editablestatus = Number(existingEditableStatus[String(d)] ?? 0);
              const serverIsRevisionRequest = Boolean(existingIsRevisionRequest?.[String(d)]);
              const serverIsEditable = editablestatus === 153;
              const hasPendingRevisionRequest = Boolean(activeReq) || serverIsRevisionRequest;
              const isPastDate = isPastTargetDate(Number(year), Number(month), Number(d));
              const isEditable = serverIsEditable || !isPastDate;
              const row = {
                isrevisionrequest: hasPendingRevisionRequest,
              };

              // Pick a referencekey (targetno) for the row.
              const rowReferenceKey = existingTargetNos?.[String(d)] || "";
              return (
                <tr key={d} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                  <td className="min-w-[96px] border-r border-border/60 bg-card px-2 py-1.5 text-center">
                    {serverIsEditable ? null : row.isrevisionrequest ? (
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
                    ) : isPastDate ? (
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
                    ) : null}
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] gap-0 overflow-y-auto overflow-x-hidden p-0 sm:rounded-xl"
        >
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <DialogTitle className="text-base font-bold">
              {isEdit ? "Edit Target Reference" : "Target Reference Entry"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Record target references per station and reporting period — monthly, quarterly,
              semi-annual, and annual totals are auto-computed.
            </p>
            {IS_PAST_DATE_LOCK_ENABLED && (
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                Past dates are locked until a revision request is approved. Current and future dates
                remain editable.
              </p>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Reporting Period card */}
            <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Calendar className="h-4 w-4" />
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
              <PastDatesLockedNote />
            </Card>

            {/* Station Information card */}
            <StationInfoCard
              stationName={stationName || (stationLoading ? "Loading…" : "")}
              unitCode={stationCode || ""}
              logoUrl={logoUrl || null}
              fields={[
                { label: "Station Code", value: stationCode || (stationLoading ? "Loading…" : "") },
                { label: "City / Municipality", value: station?.cityname ?? "" },
                {
                  label: "Province",
                  value: completeAddress || (stationLoading ? "Loading…" : ""),
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

            {/* Monthly Target Reference table */}
            <div className="flex flex-col rounded-lg border border-border/60 overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                  <Calendar className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                  Daily Target Reference
                </span>
              </div>

              {tableBody}
            </div>
          </div>

          <DialogFooter className="border-t bg-muted/30 px-5 py-3">
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
              disabled={saving || loadingGrid || sectors.length === 0 || !isDirty}
              className="gap-2 bg-primary text-white hover:bg-primary/90"
            >
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
            </Button>
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
        description={`A Target Reference already exists for this station on ${checkDateLabel}.\n\nOpening the existing record for editing.`}
        confirmLabel="Edit Existing"
        showCancel={false}
        onConfirm={handleDuplicateConfirm}
      />

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
          dateinspected={
            revisionDay != null
              ? new Date(Date.UTC(Number(year), Number(month) - 1, Number(revisionDay), 0, 0, 0))
                  .toISOString()
                  .slice(0, 10)
              : undefined
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
