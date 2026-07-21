import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowLeft, Building2, CalendarIcon, Loader2, Save, Table2 } from "lucide-react";
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


import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryIssuanceClassDTO,
  FSISUpdateInventoryClass,
  FSISUpdateInventoryDTO,
  TargetAccomplishmentModel,
} from "@/types/targetinventoryType";

import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

const INSP_FIELDS = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
  { key: "inspectbplocount", label: "1st BPLO" },
  { key: "inspectgovcount", label: "1st GOV" },
  { key: "inspectpezacount", label: "1st PEZA" },
  { key: "inspecttiezacount", label: "1st TIEZA" },
] as const;
const FSEC_FIELDS = [
  { key: "fsecbuildingcount", label: "Building" },
  { key: "fsecgovcount", label: "Gov" },
  { key: "fsecpezacount", label: "PEZA" },
  { key: "fsectiezacount", label: "TIEZA" },
] as const;
const FSIC_FIELDS = [
  { key: "fsicoccupancycount", label: "Occupancy" },
  { key: "fsicbplonewcount", label: "BPLO New" },
  { key: "fsicbplorenewcount", label: "BPLO Renew" },
  { key: "fsicgovcount", label: "Gov" },
  { key: "fsicpezacount", label: "PEZA" },
  { key: "fsictiezacount", label: "TIEZA" },
] as const;
const NOTICE_FIELDS = [
  { key: "nodcount", label: "NOD" },
  { key: "ntccount", label: "NTC" },
  { key: "ntcvcount", label: "NTCV" },
  { key: "avatementcount", label: "Avatement" },
  { key: "closurecount", label: "Closure" },
] as const;



/* -------------------------------------------------------------------------- */
/*  Local editable shapes — mirror DTO fields 1:1 (no adapter/alias).         */
/* -------------------------------------------------------------------------- */

interface InspectionEdit {
  fsisno: string;
  dateinspected: string; // ISO string retained from API
  remarks: string;

  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
}

interface IssuanceEdit {
  issuanceno: string;
  fsicmode: number;
  fsicmodename: string;

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
  avatementcount: number;
  closurecount: number;
}

function emptyIssuance(): IssuanceEdit {
  return {
    issuanceno: EMPTY_GUID,
    fsicmode: 0,
    fsicmodename: "",
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
    avatementcount: 0,
    closurecount: 0,
  };
}

function emptyInspection(iso: string): InspectionEdit {
  return {
    fsisno: EMPTY_GUID,
    dateinspected: iso,
    remarks: "",
    inspectduringcount: 0,
    inspectaftercount: 0,
    inspectbplocount: 0,
    inspectgovcount: 0,
    inspectpezacount: 0,
    inspecttiezacount: 0,
  };
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/* -------------------------------------------------------------------------- */
/*  Editor body                                                                */
/* -------------------------------------------------------------------------- */

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

  // Past reporting months are read-only; current and future months remain editable.
  const locked = React.useMemo(() => isReportMonthLocked(year, month), [year, month]);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState<null | "cancel">(null);

  const [record, setRecord] = React.useState<FSISInventoryMonthlyLedgerModel | null>(null);
  const [inspection, setInspection] = React.useState<InspectionEdit>(() =>
    emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`),
  );
  const [issuances, setIssuances] = React.useState<IssuanceEdit[]>(() => [
    { ...emptyIssuance(), fsicmode: 96, fsicmodename: "MANUAL" },
    { ...emptyIssuance(), fsicmode: 97, fsicmodename: "FSIS" },
  ]);
  // Baseline snapshots to detect unsaved changes.
  const [baseline, setBaseline] = React.useState<string>("");
  const currentSnapshot = React.useMemo(
    () => JSON.stringify({ inspection, issuances }),
    [inspection, issuances],
  );
  const isDirty = !loading && baseline !== "" && currentSnapshot !== baseline;

  /* ----------------------------- Data loading ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const sResp = await stationAPI.search({
        pageNumber: 1,
        pageSize: 1,
        searchKey: stationno,
      });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seed = Array.isArray(sData) ? sData[0] : undefined;
      const provinceno = seed?.provinceno ?? EMPTY_GUID;

      // Fetch only the target reporting month — daily-basis single record.
      const resp = await targetinventoryAPI.getMonthly(
        {
          Stationno: stationno || EMPTY_GUID,
          Provinceno: provinceno,
          Reportyear: year,
          Reportmonth: month,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data, error } = unwrap<FSISInventoryMonthlyLedgerModel[]>(resp);
      if (!ok && error) toast.error(error);
      const head = ok && Array.isArray(data) ? data[0] ?? null : null;
      const daily = head?.fsisInventoryLedgerList?.[0] ?? null;

      const normalizeIssuances = (
        list: Array<Partial<IssuanceEdit> & { fsicmode?: number | string }>,
      ): IssuanceEdit[] => {
        const findMode = (mode: number): IssuanceEdit => {
          const match = list.find((i) => toNum(i.fsicmode) === mode);
          if (!match) {
            return {
              ...emptyIssuance(),
              fsicmode: mode,
              fsicmodename: mode === 96 ? "MANUAL" : "FSIS",
            };
          }
          return {
            issuanceno: (match.issuanceno as string) ?? EMPTY_GUID,
            fsicmode: mode,
            fsicmodename: mode === 96 ? "MANUAL" : "FSIS",
            fsecbuildingcount: toNum(match.fsecbuildingcount),
            fsecgovcount: toNum(match.fsecgovcount),
            fsecpezacount: toNum(match.fsecpezacount),
            fsectiezacount: toNum(match.fsectiezacount),
            fsicoccupancycount: toNum(match.fsicoccupancycount),
            fsicbplonewcount: toNum(match.fsicbplonewcount),
            fsicbplorenewcount: toNum(match.fsicbplorenewcount),
            fsicgovcount: toNum(match.fsicgovcount),
            fsicpezacount: toNum(match.fsicpezacount),
            fsictiezacount: toNum(match.fsictiezacount),
            nodcount: toNum(match.nodcount),
            ntccount: toNum(match.ntccount),
            ntcvcount: toNum(match.ntcvcount),
            avatementcount: toNum(match.avatementcount),
            closurecount: toNum(match.closurecount),
          };
        };
        return [findMode(96), findMode(97)];
      };

      if (daily) {
        const nextInsp: InspectionEdit = {
          fsisno: daily.fsisno ?? EMPTY_GUID,
          dateinspected:
            typeof daily.dateinspected === "string"
              ? daily.dateinspected
              : new Date(daily.dateinspected as unknown as string).toISOString(),
          remarks: daily.remarks ?? "",
          inspectduringcount: toNum(daily.inspectduringcount),
          inspectaftercount: toNum(daily.inspectaftercount),
          inspectbplocount: toNum(daily.inspectbplocount),
          inspectgovcount: toNum(daily.inspectgovcount),
          inspectpezacount: toNum(daily.inspectpezacount),
          inspecttiezacount: toNum(daily.inspecttiezacount),
        };
        const nextIss = normalizeIssuances(
          Array.isArray(daily.issuancelist) ? (daily.issuancelist as Array<Partial<IssuanceEdit>>) : [],
        );
        setInspection(nextInsp);
        setIssuances(nextIss);
        setBaseline(JSON.stringify({ inspection: nextInsp, issuances: nextIss }));
      } else {
        const nextInsp = emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`);
        const nextIss = normalizeIssuances([]);
        setInspection(nextInsp);
        setIssuances(nextIss);
        setBaseline(JSON.stringify({ inspection: nextInsp, issuances: nextIss }));
      }
      setRecord(head);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month]);

  /* ---------------- Warn on browser-level navigation while dirty --------- */
  React.useEffect(() => {
    if (!isDirty || locked) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, locked]);

  const requestCancel = () => {
    if (isDirty && !locked) {
      setConfirmLeave("cancel");
      return;
    }
    onCancel();
  };

  /* ------------------------------- Handlers ------------------------------ */

  const setInspField = (key: keyof InspectionEdit, raw: string) => {
    setInspection((prev) => {
      if (key === "remarks" || key === "fsisno" || key === "dateinspected") {
        return { ...prev, [key]: raw } as InspectionEdit;
      }
      const cleaned = raw.replace(/[^0-9]/g, "");
      const n = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
      return { ...prev, [key]: n } as InspectionEdit;
    });
  };

  const setIssField = (index: number, key: keyof IssuanceEdit, raw: string) => {
    setIssuances((prev) =>
      prev.map((iss, i) => {
        if (i !== index) return iss;
        if (key === "issuanceno" || key === "fsicmodename") {
          return { ...iss, [key]: raw } as IssuanceEdit;
        }
        const cleaned = raw.replace(/[^0-9]/g, "");
        const n = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
        return { ...iss, [key]: n } as IssuanceEdit;
      }),
    );
  };


  /* ------------------------------ Validation ----------------------------- */

  const MAX_COUNT = 9999;

  const validationErrors = React.useMemo(() => {
    const errs: string[] = [];
    const allNumeric: Array<[string, number]> = [
      ...INSP_FIELDS.map((f) => [f.label, (inspection as unknown as Record<string, number>)[f.key] ?? 0] as [string, number]),
      ...issuances.flatMap((iss) => {
        const rec = iss as unknown as Record<string, number>;
        return [
          ...FSEC_FIELDS.map((f) => [`${iss.fsicmodename} · FSEC ${f.label}`, rec[f.key] ?? 0] as [string, number]),
          ...FSIC_FIELDS.map((f) => [`${iss.fsicmodename} · FSIC ${f.label}`, rec[f.key] ?? 0] as [string, number]),
          ...NOTICE_FIELDS.map((f) => [`${iss.fsicmodename} · ${f.label}`, rec[f.key] ?? 0] as [string, number]),
        ];
      }),
    ];
    for (const [label, val] of allNumeric) {
      if (!Number.isFinite(val) || !Number.isInteger(val)) {
        errs.push(`${label} must be a whole number.`);
      } else if (val < 0) {
        errs.push(`${label} cannot be negative.`);
      } else if (val > MAX_COUNT) {
        errs.push(`${label} exceeds the maximum of ${MAX_COUNT}.`);
      }
    }
    // Notes required when any punitive notice was issued.
    const noticeTotal = issuances.reduce(
      (s, i) => s + i.nodcount + i.ntccount + i.ntcvcount + i.avatementcount + i.closurecount,
      0,
    );
    if (noticeTotal > 0 && !inspection.remarks.trim()) {
      errs.push("Remarks are required when notices (NOD/NTC/NTCV/Abatement/Closure) are issued.");
    }
    return errs;
  }, [inspection, issuances]);

  /* --------------------------- Target Accomp panel ----------------------- */

  const summaryData = React.useMemo<TargetAccomplishmentModel | null>(() => {
    if (!record) return null;
    const bplo = inspection.inspectbplocount +
      issuances.reduce((s, i) => s + i.fsicbplonewcount + i.fsicbplorenewcount, 0);
    const gov = inspection.inspectgovcount +
      issuances.reduce((s, i) => s + i.fsecgovcount + i.fsicgovcount, 0);
    const peza = inspection.inspectpezacount +
      issuances.reduce((s, i) => s + i.fsecpezacount + i.fsicpezacount, 0);
    const tieza = inspection.inspecttiezacount +
      issuances.reduce((s, i) => s + i.fsectiezacount + i.fsictiezacount, 0);
    return {
      stationno: record.stationno,
      month: record.month ?? month,
      year: record.year ?? year,
      totaltargetbplo: toNum(record.totaltargetbplo),
      totaltargetgov: toNum(record.totaltargetgov),
      totaltargetpeza: toNum(record.totaltargetpeza),
      totaltargettieza: toNum(record.totaltargettieza),
      totalAccomplishmentbplo: bplo,
      totalAccomplishmentgov: gov,
      totalAccomplishmentpeza: peza,
      totalAccomplishmenttieza: tieza,
    };
  }, [record, inspection, issuances, month, year]);

  /* --------------------------------- Save -------------------------------- */

  const handleSave = async () => {
    setSaveError(null);
    if (!record) {
      setSaveError("No record loaded.");
      return;
    }
    if (locked) {
      setSaveError("This reporting month is locked and cannot be edited.");
      return;
    }
    if (validationErrors.length > 0) {
      setSaveError(validationErrors[0]);
      toast.error("Please fix validation issues before saving.");
      return;
    }
    setSaving(true);
    try {
      const issuancelist: FSISInventoryIssuanceClassDTO[] = issuances.map((i) => ({
        issuanceno: i.issuanceno || EMPTY_GUID,
        fsicmode: i.fsicmode,
        fsecbuildingcount: i.fsecbuildingcount,
        fsecgovcount: i.fsecgovcount,
        fsecpezacount: i.fsecpezacount,
        fsectiezacount: i.fsectiezacount,
        fsicoccupancycount: i.fsicoccupancycount,
        fsicbplonewcount: i.fsicbplonewcount,
        fsicbplorenewcount: i.fsicbplorenewcount,
        fsicgovcount: i.fsicgovcount,
        fsicpezacount: i.fsicpezacount,
        fsictiezacount: i.fsictiezacount,
        nodcount: i.nodcount,
        ntccount: i.ntccount,
        ntcvcount: i.ntcvcount,
        avatementcount: i.avatementcount,
        closurecount: i.closurecount,
      }));

      const item: FSISUpdateInventoryClass = {
        fsisno: inspection.fsisno || EMPTY_GUID,
        stationno,
        dateinspected: inspection.dateinspected,
        inspectduringcount: inspection.inspectduringcount,
        inspectaftercount: inspection.inspectaftercount,
        inspectbplocount: inspection.inspectbplocount,
        inspectgovcount: inspection.inspectgovcount,
        inspectpezacount: inspection.inspectpezacount,
        inspecttiezacount: inspection.inspecttiezacount,
        remarks: inspection.remarks ?? "",
        updatedby: user?.memberno ?? "",
        encodedby: user?.memberno ?? "",
        issuancelist,
      };

      const payload: FSISUpdateInventoryDTO = {
        stationno,
        updatedby: user?.memberno ?? "",
        encodedby: user?.memberno ?? "",
        fsisUpdateInventoryList: [item],
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

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  const inspectedLabel = (() => {
    try {
      return format(parseISO(inspection.dateinspected), "PPP");
    } catch {
      return inspection.dateinspected;
    }
  })();

  const manual = issuances.find((i) => i.fsicmode === 96) ?? issuances[0];
  const fsis = issuances.find((i) => i.fsicmode === 97) ?? issuances[1];
  const manualIdx = issuances.indexOf(manual);
  const fsisIdx = issuances.indexOf(fsis);

  return (
    <div className="space-y-6">
      {/* Station Information ------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle icon={<Building2 className="h-4 w-4" />} title="Station Information" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Station" value={record?.stationname ?? ""} />
          <ReadOnlyField label="Province" value={record?.provincename ?? ""} />
          <ReadOnlyField
            label="Reporting Period"
            value={`${monthName} ${year}`}
            icon={<CalendarIcon className="h-4 w-4" />}
          />
          <ReadOnlyField label="Date Inspected" value={inspectedLabel} />
        </div>
      </Card>

      {/* Daily Inspection Activities --------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Inspection Activities"
          subtitle={`Reporting month · ${monthName} ${year}`}
        />

        <TargetAccomplishmentPanel
          stationno={stationno}
          year={year}
          month={month}
          data={summaryData}
        />

        <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
          <div className="mb-3 text-sm font-semibold text-foreground">Inspection Activities</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INSP_FIELDS.map((f) => (
              <NumericField
                key={f.key}
                label={f.label}
                value={(inspection as unknown as Record<string, number>)[f.key] ?? 0}
                disabled={locked}
                onChange={(v) => setInspField(f.key as keyof InspectionEdit, v)}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Daily Issuance Activities ----------------------------------------- */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Issuance Activities"
          subtitle="Encode issuances separately for MANUAL and FSIS"
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <IssuanceEditColumn
            heading="MANUAL"
            values={manual as unknown as Record<string, number>}
            disabled={locked}
            onChange={(k, v) => setIssField(manualIdx, k as keyof IssuanceEdit, v)}
          />
          <IssuanceEditColumn
            heading="FSIS"
            values={fsis as unknown as Record<string, number>}
            disabled={locked}
            onChange={(k, v) => setIssField(fsisIdx, k as keyof IssuanceEdit, v)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Remarks</label>
          <Textarea
            rows={3}
            value={inspection.remarks}
            disabled={locked}
            onChange={(e) => setInspField("remarks", e.target.value.slice(0, 1000))}
            placeholder="Additional notes about the inspection…"
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
      {!saveError && validationErrors.length > 0 && !locked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{validationErrors.length} validation issue{validationErrors.length > 1 ? "s" : ""}</div>
            <ul className="mt-1 list-disc pl-4">
              {validationErrors.slice(0, 3).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
              {validationErrors.length > 3 && <li>and {validationErrors.length - 3} more…</li>}
            </ul>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {locked && (
          <div className="mr-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
            This reporting month has already passed and is locked. Only the current and upcoming months can be edited.
          </div>
        )}
        <Button variant="outline" onClick={requestCancel} className="gap-2" disabled={saving}>
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || locked || validationErrors.length > 0}
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

function NumericField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? 0}
        disabled={disabled}
        readOnly={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
        }}
        className={`tabular-nums ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      />
    </div>
  );
}

function IssuanceEditColumn({
  heading,
  values,
  disabled,
  onChange,
}: {
  heading: string;
  values: Record<string, number>;
  disabled?: boolean;
  onChange: (key: string, raw: string) => void;
}) {
  const renderGroup = (
    title: string,
    fields: ReadonlyArray<{ key: string; label: string }>,
  ) => (
    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <NumericField
            key={f.key}
            label={f.label}
            value={values[f.key] ?? 0}
            disabled={disabled}
            onChange={(v) => onChange(f.key, v)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-4">
      <div className="text-sm font-semibold uppercase tracking-wider text-foreground">
        {heading}
      </div>
      {renderGroup("Fire Safety Evaluation Certificate (FSEC)", FSEC_FIELDS)}
      {renderGroup("Fire Safety Inspection Certificate (FSIC)", FSIC_FIELDS)}
      {renderGroup("Other Notices", NOTICE_FIELDS)}
    </div>
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


function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm">
        {icon}
        <span className="truncate">{value || "—"}</span>
      </div>
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
