import * as React from "react";
import {  Dialog,  DialogContent,  DialogHeader,  DialogTitle,  DialogFooter,} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {  Select,  SelectContent,  SelectItem,  SelectTrigger,  SelectValue,} from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Building2, Calendar, Loader2, Lock, RotateCcw, Save, X, AlertTriangle, Trash2, Ban } from "lucide-react";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import { toast } from "sonner";
import { cn, buildYears, toWhole } from "@/lib/utils";
import { MONTHS, SECTORS, SECTOR_NO } from "@/lib/fsims-constants";

import AvatarWithFallback from "@/components/avatar-with-fallback";

import StationSearchSelect from "@/components/station-search-select";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import type { SearchStationModel } from "@/types/stationTypes";

import type {  TargetReferenceClass,  TargetReferenceDetailModel,} from "@/types/targetreferenceType";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import { resolveTargetScope } from "../helpers";
import RevisionRequestDialog from "../revision/RevisionRequestDialog";
import ReasonRemarksDialog from "../revision/ReasonRemarksDialog";
import RevisionStatusBadge from "../revision/RevisionStatusBadge";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, opens in Edit mode for that station+year. */
  editing?: { year: number; stationno?: string } | null;
  onSaved: () => void;
}

/** cellKey = `${month}-${sectorno}` -> raw string input value */
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
function hasPstLockActivated(reportyear: number, reportmonth: number, now: Date = new Date()): boolean {
  const y = Number(reportyear);
  const m = Number(reportmonth);
  if (!y || !m || m < 1 || m > 12) return false;
  const manilaNowMs = now.getTime() + 8 * 60 * 60 * 1000;
  const lockActivationMs = Date.UTC(y, m /* next month, 0-indexed */, 4, 0, 0, 0);
  return manilaNowMs >= lockActivationMs;
}


export default function TargetReferenceForm({
  open,
  onOpenChange,
  editing,
  onSaved,
}: Props) {
  const { user, systemAccess } = useAuth();
  const [revisionMonth, setRevisionMonth] = React.useState<number | null>(null);
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
  const YEARS = React.useMemo(buildYears, []);
  const currentYear = new Date().getFullYear();

  const [year, setYear] = React.useState<number>(currentYear);
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
    let nextProvinceNo = scope.provinceLocked ? scope.provinceno || user?.provinceno || "" : EMPTY_GUID;
    let nextProvinceName = scope.provinceLocked ? scope.provincename || user?.provincename || "" : "ALL";

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
  }, [open, initializedForOpen, scope.stationLocked, scope.stationno, editing?.stationno, user?.provincename, user?.stationname, user?.stationno]);

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
  }, [open, stationNo, station, scope.provinceLocked, scope.provinceno, user?.stationcode, user?.stationname, isEdit, year]);

  // Fixed sector constants live in @/lib/fsims-constants (SECTORS).
  // 111=BPLO, 112=GOV, 113=PEZA, 114=TIEZA (OGA=115 intentionally excluded).
  const sectors = SECTORS;
  const sectorsLoading = false;

  const [existingLoading, setExistingLoading] = React.useState(false);
  const [existingTargetNos, setExistingTargetNos] = React.useState<Record<string, string>>({});
  
  const [existingEditableStatus, setExistingEditableStatus] = React.useState<Record<string, number>>({});
  const [existingIsRevisionRequest, setExistingIsRevisionRequest] = React.useState<Record<string, boolean>>({});
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
  }, [open, station, stationNo, scope.stationLocked, scope.provinceLocked, user?.stationname, user?.provincename]);

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
    setYear(editing?.year ?? currentYear);
    setProvinceno(scope.provinceLocked ? scope.provinceno || user?.provinceno || "" : EMPTY_GUID);
    setProvincename(scope.provinceLocked ? scope.provincename || user?.provincename || "" : "ALL");
  }, [open, editing, currentYear, scope.provinceLocked, scope.provinceno, user?.provinceno]);

  // Load existing values for edit — Detail endpoint returns the station's
  // full year in a single call, including database TargetNo for each cell.
  React.useEffect(() => {
    if (!open || !stationNo || stationNo === EMPTY_GUID) return;
    let cancelled = false;
    (async () => {
      setExistingLoading(true);
      const resp = await targetreferenceAPI.getDetail(
        { stationno: stationNo, reportyear: Number(year) },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<TargetReferenceDetailModel>(resp);
      if (cancelled) return;
      const nextCells: CellMap = {};
      const nextIds: Record<string, string> = {};
      const nextEditableStatus: Record<string, number> = {};
      const nextIsRevReq: Record<string, boolean> = {};
      let hasAny = false;
      if (ok && data) {
        (data.targetreferencelist ?? []).forEach((it) => {
          const month = Number(it.reportmonth);
          if (!month || month < 1 || month > 12) return;
          nextCells[`${month}-${SECTOR_NO.BPLO}`] = String(it.bplototal ?? 0);
          nextCells[`${month}-${SECTOR_NO.GOV}`] = String(it.govtotal ?? 0);
          nextCells[`${month}-${SECTOR_NO.PEZA}`] = String(it.piezatotal ?? 0);
          nextCells[`${month}-${SECTOR_NO.TIEZA}`] = String(it.tiezatotal ?? 0);
          nextEditableStatus[String(month)] = Number(it.editablestatus ?? 0);
          nextIsRevReq[String(month)] = Boolean(it.isrevisionrequest);
          if (it.targetno && it.targetno !== EMPTY_GUID) {
            nextIds[String(month)] = it.targetno;
            hasAny = true;
          }
        });
      }

      // Duplicate detection during Add: if any target already exists for the
      // selected station + year, prompt the user to switch into Edit mode.
      if (!isEditProp && hasAny && !duplicatePrompted) {
        setDuplicatePrompted(true);
        setPendingDuplicateData({ cells: nextCells, ids: nextIds });
        setDuplicateDialogOpen(true);
        setExistingLoading(false);
        return;
      }

      setCells(nextCells);
      setBaselineCells(nextCells);
      setExistingTargetNos(nextIds);
      setExistingEditableStatus(nextEditableStatus);
      setExistingIsRevisionRequest(nextIsRevReq);
      setExistingLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, stationNo, year, isEditProp, duplicatePrompted, onOpenChange, reloadNonce]);

  const setCell = (month: number, sectorNo: number, raw: string) => {
    const key = `${month}-${sectorNo}`;
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
    Object.entries(cells).forEach(([k, v]) => {
      if (v === "") return;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) next[k] = "Invalid";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildExistingTargetData = (detail: TargetReferenceDetailModel | null) => {
    const nextCells: CellMap = {};
    const nextIds: Record<string, string> = {};

    // API now returns a full 12-month scaffold per station+year, with
    // unsaved months carrying targetno === EMPTY_GUID and zero totals.
    // Treat only rows with a real targetno as actually saved data.
    (detail?.targetreferencelist ?? []).forEach((it) => {
      const month = Number(it.reportmonth);
      if (!month || month < 1 || month > 12) return;
      const isSaved = Boolean(it.targetno) && it.targetno !== EMPTY_GUID;
      if (!isSaved) return;
      nextCells[`${month}-${SECTOR_NO.BPLO}`] = String(it.bplototal ?? 0);
      nextCells[`${month}-${SECTOR_NO.GOV}`] = String(it.govtotal ?? 0);
      nextCells[`${month}-${SECTOR_NO.PEZA}`] = String(it.piezatotal ?? 0);
      nextCells[`${month}-${SECTOR_NO.TIEZA}`] = String(it.tiezatotal ?? 0);
      nextIds[String(month)] = it.targetno;
    });

    return { cells: nextCells, ids: nextIds };
  };

  const checkExistingTargetReference = async (stationNumber: string, reportYear: number) => {
    const resp = await targetreferenceAPI.getDetail(
      { stationno: stationNumber, reportyear: reportYear },
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
    const built = buildExistingTargetData(data);
    // No real saved month -> nothing to duplicate.
    if (Object.keys(built.ids).length === 0) return null;
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

    if (scope.provinceLocked && scope.provinceno && station?.provinceno && String(station.provinceno) !== String(scope.provinceno)) {
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

    let resolvedExistingTargetNos = existingTargetNos;
    if (isEdit) {
      const existingLookup = await checkExistingTargetReference(submitStationNo, Number(year));
      if (existingLookup?.ids && Object.keys(existingLookup.ids).length > 0) {
        resolvedExistingTargetNos = { ...existingTargetNos, ...existingLookup.ids };
        setExistingTargetNos(resolvedExistingTargetNos);
      }
    }

    const list: TargetReferenceClass[] = MONTHS.map((m) => {
      const bploKey = `${m.value}-${SECTOR_NO.BPLO}`;
      const govKey = `${m.value}-${SECTOR_NO.GOV}`;
      const pezaKey = `${m.value}-${SECTOR_NO.PEZA}`;
      const tiezaKey = `${m.value}-${SECTOR_NO.TIEZA}`;
      const bplototal = Number(cells[bploKey] ?? 0);
      const govtotal = Number(cells[govKey] ?? 0);
      const piezatotal = Number(cells[pezaKey] ?? 0);
      const tiezatotal = Number(cells[tiezaKey] ?? 0);
      // isaccomplished = true when any of the four totals differ from the
      // originally loaded baseline (from targetreferenceAPI.getDetail).
      const isaccomplished =
        bplototal !== Number(baselineCells[bploKey] ?? 0) ||
        govtotal !== Number(baselineCells[govKey] ?? 0) ||
        piezatotal !== Number(baselineCells[pezaKey] ?? 0) ||
        tiezatotal !== Number(baselineCells[tiezaKey] ?? 0);
      const existingTargetNo = resolvedExistingTargetNos[String(m.value)];
      return {
        targetno: existingTargetNo && existingTargetNo !== EMPTY_GUID ? existingTargetNo : EMPTY_GUID,
        reportyear: Number(year),
        reportmonth: Number(m.value),
        bplototal,
        govtotal,
        piezatotal,
        tiezatotal,
        isaccomplished,
      } as TargetReferenceClass & { isaccomplished: boolean };
    });

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
  const monthTotal = React.useCallback(
    (m: number) =>
      sectors.reduce((sum, s) => sum + (Number(cells[`${m}-${s.detno}`]) || 0), 0),
    [sectors, cells],
  );
  const sectorTotal = React.useCallback(
    (sn: number) =>
      MONTHS.reduce((sum, m) => sum + (Number(cells[`${m.value}-${sn}`]) || 0), 0),
    [cells],
  );
  const grandTotal = React.useMemo(
    () => MONTHS.reduce((sum, m) => sum + monthTotal(m.value), 0),
    [monthTotal],
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

  const tableBody = loadingGrid ? (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
    </div>
  ) : sectors.length === 0 ? (
    <div className="py-10 text-center text-sm text-muted-foreground">No government sectors available.</div>
  ) : (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="bg-card text-left uppercase tracking-[0.15em] text-primary">
            <th className="min-w-[96px] border-b border-r border-border/60 bg-card px-3 py-2 text-center font-semibold">ACTION</th>
            <th className="border-b border-border/60 px-3 py-2 font-semibold bg-card">Month</th>
            {sectors.map((s) => (
              <th
                key={s.detno}
                className="border-b border-border/60 bg-card px-3 py-2 text-right font-semibold"
                title={s.description}
              >
                {s.recordcode || s.description}
              </th>
            ))}
            <th className="border-b border-l border-border/60 bg-card px-3 py-2 text-right font-semibold">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((m, i) => {
            const revStation = stationNo && stationNo !== EMPTY_GUID ? stationNo : "";
            const activeReq = revisionRequests.find(
              (req) => Number(req.reportmonth) === Number(m.value) && req.statuscode?.toUpperCase() === "PENDING",
            );
            // Server-driven flags (only source of truth for editability + action state)
            const editablestatus = existingEditableStatus[String(m.value)];
            const serverIsRevisionRequest = Boolean(existingIsRevisionRequest?.[String(m.value)]);
            const serverIsEditable = editablestatus === 153;
            // PST lock-activation gate: until day 4 00:00 of the following
            // month (Asia/Manila), the row must behave like an unlocked /
            // current month regardless of any server-side lock hint.
            const pstLockActive = hasPstLockActivated(year, Number(m.value));
            const isEditable = serverIsEditable || !pstLockActive;
            const row = {
              isrevisionrequest: serverIsRevisionRequest || Boolean(activeReq),
            };

            // Pick a referencekey (targetno) for the row.
            const rowReferenceKey = existingTargetNos?.[String(m.value)] || "";
            return (
            <tr key={m.value} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
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
                ) : serverIsEditable ? null : (
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
                      icon={<RotateCcw className="h-4 w-4" />}
                      onClick={() => setRevisionMonth(Number(m.value))}
                    />
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-1.5 font-medium">
                <div className="flex items-center gap-2">
                  {!isEditable && <Lock className="h-3 w-3 text-warning" aria-label="Locked month" />}
                  <span>{m.name}</span>
                  {activeReq ? (
                    <RevisionStatusBadge status={activeReq.statuscode?.toUpperCase() === "PENDING" ? "PENDING" : activeReq.statuscode?.toUpperCase() === "APPROVED" ? "APPROVED" : "CANCELLED"} />
                  ) : null}
                </div>
              </td>
              {sectors.map((s) => {
                const key = `${m.value}-${s.detno}`;
                const hasErr = Boolean(errors[key]);
                const val = cells[key] ?? "";
                const locked = !isEditable;
                return (
                  <td key={s.detno} className="px-2 py-1">
                    <input
                      inputMode="numeric"
                      value={val}
                      readOnly={locked}
                      tabIndex={locked ? -1 : 0}
                      onFocus={(e) => {
                        if (locked) return;
                        e.target.select();
                      }}
                      onBlur={(e) => {
                        if (locked) return;
                        if (e.target.value === "") setCell(m.value, Number(s.detno), "0");
                      }}
                      onChange={(e) => {
                        if (locked) return;
                        setCell(m.value, Number(s.detno), e.target.value);
                      }}
                      aria-invalid={hasErr}
                      aria-readonly={locked}
                      title={locked ? "This row is not editable." : undefined}
                      className={cn(
                        "h-8 w-full min-w-[80px] rounded-md border bg-background px-2 text-right text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary",
                        hasErr && "border-destructive focus:border-destructive focus:ring-destructive",
                        locked && "cursor-not-allowed bg-muted/50 text-muted-foreground focus:border-border focus:ring-0",
                      )}
                    />
                  </td>
                );
              })}
              <td className="border-l border-border/60 bg-card px-3 py-1.5 text-right font-semibold tabular-nums text-primary">
                {monthTotal(m.value).toLocaleString()}
              </td>
            </tr>
            );
          })}

        </tbody>
        <tfoot className="sticky bottom-0 bg-card">
          <tr className="text-primary bg-card">
            <td className="border-r border-t border-border/60 bg-card px-3 py-2" />
            <td className="border-t border-border/60 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.15em] bg-card">TOTAL</td>
            {sectors.map((s) => (
              <td key={s.detno} className="border-t border-border/60 bg-card px-3 py-2 text-right font-bold tabular-nums">
                {sectorTotal(Number(s.detno)).toLocaleString()}
              </td>
            ))}
            <td className="border-l border-t border-border/60 bg-card px-3 py-2 text-right font-bold tabular-nums">{grandTotal.toLocaleString()}</td>
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
          className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
        >
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <DialogTitle className="text-base font-bold">
              {isEdit ? "Edit Target Reference" : "Add Target Reference"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Encode monthly targets — quarterly, semi-annual, and annual totals are auto-computed.
            </p>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
            {/* Year */}
            <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Year <span className="text-destructive">*</span>
              </Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Station</Label>
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
                placeholder={scope.stationLocked ? "Restricted to your assigned station" : "Select station"}
              />
            </div>

          </div>

          {/* Station Information card */}
          <div className="rounded-lg border border-border/60">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                Station Information
              </span>
            </div>
            <div className="flex items-start gap-4 p-4">
              <AvatarWithFallback
                entity={{ name: stationName || "Station" }}
                src={logoUrl || undefined}
                name={stationName || "?"}
                className="h-16 w-16 shrink-0 rounded-full ring-2 ring-primary/20"
              />
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Station Code
                  </div>
                  <div className="text-sm font-semibold">
                    {stationCode || (stationLoading ? "Loading…" : "—")}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Station Name
                  </div>
                  <div className="truncate text-sm font-semibold">
                    {stationName || (stationLoading ? "Loading…" : "—")}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Complete Address
                  </div>
                  <div className="text-sm">
                    {completeAddress || (stationLoading ? "Loading…" : "—")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Target Reference table */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border/60 overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                Monthly Target Reference
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
      description={`A Target Reference already exists for this station and year (${year}).\n\nOpening the existing record for editing.`}
      confirmLabel="Edit Existing"
      showCancel={false}
      onConfirm={handleDuplicateConfirm}
    />

    {revisionMonth !== null && (
      <RevisionRequestDialog
        open={revisionMonth !== null}
        onOpenChange={(v) => !v && setRevisionMonth(null)}
        station={{
          stationno: stationNo,
          stationcode: stationCode || "",
          stationname: stationName || "",
          provinceno: provinceno,
          provincename: provincename,
          cityname: station?.cityname ?? user?.cityname ?? "",
        }}
        year={Number(year)}
        month={Number(revisionMonth)}
        referencekey={
          existingTargetNos[String(revisionMonth)] &&
          existingTargetNos[String(revisionMonth)] !== EMPTY_GUID
            ? existingTargetNos[String(revisionMonth)]
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
