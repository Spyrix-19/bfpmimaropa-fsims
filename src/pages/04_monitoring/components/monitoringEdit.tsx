import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowLeft, Building2, CalendarIcon, Loader2, Save, Table2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
import { isReportMonthLocked } from "@/pages/05_target-reference/helpers";
import { CATEGORY_FIELDS } from "@/lib/inventoryHelpers";

import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type { DailyInventoryDTO } from "@/types/inventoryType";
import type {
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryIssuanceClassDTO,
  FSISUpdateInventoryClass,
  FSISUpdateInventoryDTO,
  TargetAccomplishmentModel,
} from "@/types/targetinventoryType";

import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";
import ReadOnlyField from "@/pages/05_target-reference/components/ReadOnlyField";


/* ========================================================================== */
/*  Shared field definitions (mirror from monitoringView CATEGORY_FIELDS)   */
/* ========================================================================== */

const CATEGORY_ORDER = ["INSPECTION", "FSEC", "FSIC", "NOTICES"] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: CATEGORY_FIELDS[category],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

const GROUP_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: "bg-emerald-600 text-white",
  FSEC: "bg-sky-600 text-white",
  FSIC: "bg-indigo-600 text-white",
  NOTICES: "bg-amber-600 text-white",
};

/* ========================================================================== */
/*  Detail API shapes (per-day records)                                      */
/* ========================================================================== */

interface FSISInventoryDetailItem {
  fsisno: string;
  dateinspected: string | Date;
  remarks?: string | null;

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
  avatementcount?: number | null;
  closurecount?: number | null;
}

interface FSISInventoryDetailStation {
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

  fsisInventoryDetailList?: FSISInventoryDetailItem[] | null;
}

const FIELD_TO_API: Record<string, keyof FSISInventoryDetailItem> = {
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
  not_abatement: "avatementcount",
  not_closure: "closurecount",
};

type DayTotals = Partial<Record<keyof DailyInventoryDTO, number>>;

interface EditableDay {
  day: number;
  label: string;
  key: string;
  data: FSISInventoryDetailItem;
  isLocked: boolean;
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

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Check if a given date has already passed (is before today at midnight)
 */
function isDayLocked(dateStr: string): boolean {
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
 * Build editable day structure from Detail API response.
 * Creates one entry per calendar day, loading data from API list or empty.
 */
function buildEditableDays(
  list: FSISInventoryDetailItem[] | null | undefined,
  year: number,
  month: number,
): Map<string, EditableDay> {
  const map = new Map<string, EditableDay>();
  
  // Index API data by date
  const dataByDate = new Map<string, FSISInventoryDetailItem>();
  if (Array.isArray(list)) {
    for (const item of list) {
      const key = normalizeDateKey(item?.dateinspected);
      if (key) dataByDate.set(key, item);
    }
  }

  const total = daysInMonth(year, month);
  const monthName = MONTHS[month - 1]?.name ?? "";

  for (let d = 1; d <= total; d++) {
    const key = toLocalKey(year, month, d);
    const label = `${monthName} ${d}, ${year}`;
    const apiData = dataByDate.get(key);

    // Compute totals from data
    const totals: DayTotals = {};
    if (apiData) {
      for (const field of DETAIL_FIELDS) {
        const apiKey = FIELD_TO_API[String(field.key)];
        if (apiKey) {
          totals[field.key as keyof DailyInventoryDTO] = num(
            apiData[apiKey]
          );
        }
      }
    } else {
      for (const field of DETAIL_FIELDS) {
        totals[field.key as keyof DailyInventoryDTO] = 0;
      }
    }

    const entry: EditableDay = {
      day: d,
      label,
      key,
      data: apiData ?? {
        fsisno: EMPTY_GUID,
        dateinspected: key,
        remarks: "",
      },
      isLocked: isDayLocked(key),
      totals,
    };
    map.set(key, entry);
  }

  return map;
}


/* ========================================================================== */
/*  Editor body — per-day editable table                                     */
/* ========================================================================== */

function InventoryEditBody({
  stationno,
  year,
  month,
  onSaved,
  onCancel,
}: {
  stationno: string;
  year: number;
  month: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();

  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? String(month);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState<null | "cancel">(null);

  // Station info from Detail API
  const [station, setStation] = React.useState<FSISInventoryDetailStation | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  // Editable days indexed by YYYY-MM-DD
  const [editableDays, setEditableDays] = React.useState<Map<string, EditableDay>>(
    new Map()
  );

  // Baseline to detect unsaved changes
  const [baseline, setBaseline] = React.useState<string>("");
  const currentSnapshot = React.useMemo(
    () => JSON.stringify(Array.from(editableDays.entries())),
    [editableDays]
  );
  const isDirty = !loading && baseline !== "" && currentSnapshot !== baseline;

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
      const resp = await targetinventoryAPI.getDetail(
        {
          Stationno: stationno || EMPTY_GUID,
          Provinceno: provinceno,
          Reportyear: year,
          Reportmonth: month,
        },
        { suppressGlobalLoading: true }
      );
      if (cancelled) return;

      const { ok, data, error } = unwrap<FSISInventoryDetailStation[]>(resp);
      if (!ok) toast.error(error || "Failed to load details.");
      const first = ok && Array.isArray(data) ? data[0] ?? null : null;
      
      setStation(first);
      
      const days = buildEditableDays(first?.fsisInventoryDetailList, year, month);
      setEditableDays(days);
      setBaseline(JSON.stringify(Array.from(days.entries())));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, year, month]);

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

  /* ------------------------------- Handlers ------------------------------ */

  const updateDayField = (dayKey: string, fieldKey: string, raw: string) => {
    setEditableDays((prev) => {
      const newMap = new Map(prev);
      const day = newMap.get(dayKey);
      if (!day) return prev;

      const cleaned = raw.replace(/[^0-9]/g, "");
      const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);

      const apiKey = FIELD_TO_API[fieldKey] as keyof FSISInventoryDetailItem | undefined;
      if (!apiKey) return prev;

      const newData = { ...day.data, [apiKey]: value };
      newMap.set(dayKey, { ...day, data: newData, totals: { ...day.totals, [fieldKey]: value } });
      return newMap;
    });
  };

  const updateDayRemarks = (dayKey: string, remarks: string) => {
    setEditableDays((prev) => {
      const newMap = new Map(prev);
      const day = newMap.get(dayKey);
      if (!day) return prev;
      const newData = { ...day.data, remarks: remarks.slice(0, 1000) };
      newMap.set(dayKey, { ...day, data: newData });
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

    // Check if entire month is locked
    if (isReportMonthLocked(year, month)) {
      setSaveError("This reporting month is locked and cannot be edited.");
      return;
    }

    setSaving(true);
    try {
      // Prepare updates — only modified days
      const updates: FSISUpdateInventoryClass[] = [];

      for (const [, day] of editableDays) {
        if (day.isLocked) continue; // Skip locked days

        const item: FSISUpdateInventoryClass = {
          fsisno: day.data.fsisno || EMPTY_GUID,
          stationno,
          dateinspected: day.key,
          inspectduringcount: num(day.data.inspectduringcount),
          inspectaftercount: num(day.data.inspectaftercount),
          inspectbplocount: num(day.data.inspectbplocount),
          inspectgovcount: num(day.data.inspectgovcount),
          inspectpezacount: num(day.data.inspectpezacount),
          inspecttiezacount: num(day.data.inspecttiezacount),
          remarks: (day.data.remarks ?? "").trim(),
          updatedby: user?.memberno ?? "",
          encodedby: user?.memberno ?? "",
          issuancelist: [],
        };
        updates.push(item);
      }

      if (updates.length === 0) {
        toast.info("No changes to save.");
        onSaved();
        return;
      }

      const payload: FSISUpdateInventoryDTO = {
        stationno,
        updatedby: user?.memberno ?? "",
        encodedby: user?.memberno ?? "",
        fsisUpdateInventoryList: updates,
      };

      const resp = await targetinventoryAPI.update(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) {
        const msg = error || "Failed to save changes. Please try again.";
        setSaveError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Fire safety compliance updated successfully.");
      setBaseline(currentSnapshot);
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

  const days = Array.from(editableDays.values());
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
          <ReadOnlyField label="Station" value={station?.stationname ?? ""} />
          <ReadOnlyField label="Province" value={station?.provincename ?? ""} />
          <ReadOnlyField label="Reporting Month" value={`${monthName} ${year}`} />
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

        {/* Daily table */}
        <div className="max-h-[65vh] w-full max-w-full overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 min-w-[120px] border-b border-r bg-blue-700 px-3 py-2 text-left uppercase tracking-wider text-white"
                >
                  Date
                </th>
                {FIELD_GROUPS.map((group) => (
                  <th
                    key={group.category}
                    colSpan={group.fields.length}
                    className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE[group.category]}`}
                  >
                    {group.category}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-b border-r bg-slate-700 px-3 py-2 text-center uppercase tracking-wider text-white min-w-[80px]"
                >
                  TOTAL
                </th>
              </tr>
              <tr>
                {DETAIL_FIELDS.map((field) => (
                  <th
                    key={String(field.key)}
                    className="border-b border-r bg-emerald-100 px-1.5 py-1 text-right text-[10px] font-bold uppercase text-emerald-900 min-w-[72px] dark:bg-emerald-950/60 dark:text-emerald-100"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((dayEntry, index) => {
                const rowTotal = DETAIL_FIELDS.reduce(
                  (sum, f) => sum + num(dayEntry.totals[f.key as keyof DailyInventoryDTO]),
                  0
                );
                const zebra = index % 2 === 1 ? "bg-muted" : "bg-card";
                return (
                  <tr key={dayEntry.key} className={zebra}>
                    <td
                      className={`sticky left-0 z-20 border-b border-r px-3 py-1.5 font-semibold ${zebra} relative`}
                    >
                      <div className="flex items-center gap-2">
                        {dayEntry.isLocked && <Lock className="h-3 w-3 text-amber-600" />}
                        {dayEntry.label}
                      </div>
                    </td>
                    {DETAIL_FIELDS.map((field) => {
                      const apiKey = FIELD_TO_API[String(field.key)];
                      const value = apiKey
                        ? num(dayEntry.data[apiKey])
                        : 0;
                      return (
                        <td
                          key={String(field.key)}
                          className="border-b border-r px-2 py-1.5 text-right"
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
                                updateDayField(dayEntry.key, String(field.key), e.target.value)
                              }
                              className="h-8 w-full rounded-sm border-border/70 bg-white/90 px-2 py-1 text-right tabular-nums"
                            />
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b px-3 py-1.5 text-right font-semibold tabular-nums">
                      {rowTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Remarks section */}
        <div className="border-t pt-4">
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
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
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
          disabled={saving || allLocked}
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
              You have edited daily inspection or issuance values. Leaving now will discard those changes.
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

export default function InventoryEdit() {
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

      <InventoryEditBody
        stationno={stationno}
        year={y}
        month={m}
        onSaved={() => navigate("/monitoring")}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

export function InventoryEditModal({
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
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
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
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
          {open ? (
            <InventoryEditBody
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
