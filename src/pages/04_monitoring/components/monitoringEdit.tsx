import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Building2, CalendarIcon, Loader2, Save, Table2 } from "lucide-react";
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



import { useAuth } from "@/lib/auth";
import { EMPTY_GUID, unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { isReportMonthLocked } from "@/pages/05_target-reference/helpers";


import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryMonthlyClass,
  FSISIssuanceClassModel,
  FSISInventoryIssuanceClassDTO,
  FSISUpdateInventoryClass,
  FSISUpdateInventoryDTO,
  TargetAccomplishmentModel,
} from "@/types/targetinventoryType";

import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

// Mirror the view page palette so both pages share the same visual identity.
const GROUP_TONE = {
  INSPECTION: "bg-emerald-600 text-white",
  FSEC: "bg-sky-600 text-white",
  FSIC: "bg-indigo-600 text-white",
  NOTICES: "bg-amber-600 text-white",
} as const;

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
type InspKey = (typeof INSP_FIELDS)[number]["key"];
type IssuanceKey =
  | (typeof FSEC_FIELDS)[number]["key"]
  | (typeof FSIC_FIELDS)[number]["key"]
  | (typeof NOTICE_FIELDS)[number]["key"];


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

  const [record, setRecord] = React.useState<FSISInventoryMonthlyLedgerModel | null>(null);
  // Full year of slices — every month is displayed, target month is editable.
  const [monthSlices, setMonthSlices] = React.useState<
    { month: number; daily: FSISInventoryMonthlyClass | null }[]
  >(() =>
    MONTHS.map((m) => ({ month: m.value, daily: null })),
  );
  const [inspection, setInspection] = React.useState<InspectionEdit>(() =>
    emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`),
  );
  const [issuances, setIssuances] = React.useState<IssuanceEdit[]>(() => [
    { ...emptyIssuance(), fsicmode: 96, fsicmodename: "MANUAL" },
    { ...emptyIssuance(), fsicmode: 97, fsicmodename: "FSIS" },
  ]);

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

      // Fetch every month in parallel so the full Jan–Dec matrix is populated.
      const responses = await Promise.all(
        MONTHS.map((m) =>
          targetinventoryAPI.getMonthly(
            {
              Stationno: stationno || EMPTY_GUID,
              Provinceno: provinceno,
              Reportyear: year,
              Reportmonth: m.value,
            },
            { suppressGlobalLoading: true },
          ),
        ),
      );
      if (cancelled) return;

      let firstError: string | null = null;
      const slices = responses.map((resp, idx) => {
        const { ok, data, error } = unwrap<FSISInventoryMonthlyLedgerModel[]>(resp);
        if (!ok && !firstError) firstError = error || null;
        const head = ok && Array.isArray(data) ? data[0] ?? null : null;
        return {
          month: MONTHS[idx].value,
          head,
          daily: head?.fsisInventoryLedgerList?.[0] ?? null,
        };
      });
      if (firstError) toast.error(firstError);

      const target = slices.find((s) => s.month === month);
      const head = target?.head ?? null;
      const daily = target?.daily ?? null;

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
        setInspection({
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
        });
        setIssuances(normalizeIssuances(
          Array.isArray(daily.issuancelist) ? (daily.issuancelist as Array<Partial<IssuanceEdit>>) : [],
        ));
      } else {
        setInspection(emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`));
        setIssuances(normalizeIssuances([]));
      }
      setRecord(head);
      setMonthSlices(slices.map((s) => ({ month: s.month, daily: s.daily })));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month]);

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
    if (!record) {
      toast.error("No record loaded.");
      return;
    }
    if (locked) {
      toast.error("This reporting month is locked and cannot be edited.");
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
        toast.error(error || "Failed to save changes.");
        return;
      }
      toast.success("Fire safety compliance updated.");
      onSaved();
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

      {/* Matrix table ------------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Inspection & Issuance Activities"
          subtitle={`Reporting month · ${monthName} ${year}`}
        />

        <TargetAccomplishmentPanel
          stationno={stationno}
          year={year}
          month={month}
          data={summaryData}
        />

        <YearlyMatrixEditor
          slices={monthSlices}
          targetMonth={month}
          inspection={inspection}
          issuances={issuances}
          manualIdx={manualIdx}
          fsisIdx={fsisIdx}
          setInspField={setInspField}
          setIssField={setIssField}
          locked={locked}
        />
      </Card>

      {/* Actions ------------------------------------------------------------ */}
      <div className="flex flex-wrap justify-end gap-2">
        {locked && (
          <div className="mr-auto rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-100">
            This reporting month has already passed and is locked. Only the current and upcoming months can be edited.
          </div>
        )}
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || locked}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Yearly matrix editor — colored group headers, all 12 months, totals row   */
/* -------------------------------------------------------------------------- */

function YearlyMatrixEditor({
  slices,
  targetMonth,
  inspection,
  issuances,
  manualIdx,
  fsisIdx,
  setInspField,
  setIssField,
  locked,
}: {
  slices: { month: number; daily: FSISInventoryMonthlyClass | null }[];
  targetMonth: number;
  inspection: InspectionEdit;
  issuances: IssuanceEdit[];
  manualIdx: number;
  fsisIdx: number;
  setInspField: (key: keyof InspectionEdit, raw: string) => void;
  setIssField: (index: number, key: keyof IssuanceEdit, raw: string) => void;
  locked?: boolean;
}) {
  const manual = issuances[manualIdx];
  const fsis = issuances[fsisIdx];

  const modeOf = (
    daily: FSISInventoryMonthlyClass | null,
    mode: number,
  ): FSISIssuanceClassModel | undefined => {
    const list = (daily?.issuancelist ?? []) as FSISIssuanceClassModel[];
    return list.find((i) => Number(i.fsicmode) === mode);
  };

  // Column totals: sum across every month, both MANUAL + FSIS modes.
  const inspTotals: Record<InspKey, number> = React.useMemo(() => {
    const acc = Object.fromEntries(INSP_FIELDS.map((f) => [f.key, 0])) as Record<InspKey, number>;
    for (const s of slices) {
      const src =
        s.month === targetMonth
          ? (inspection as unknown as Record<InspKey, number>)
          : ((s.daily ?? {}) as unknown as Record<InspKey, number>);
      for (const f of INSP_FIELDS) acc[f.key] += Number(src?.[f.key] ?? 0) || 0;
    }
    return acc;
  }, [slices, targetMonth, inspection]);

  const issTotals: Record<IssuanceKey, number> = React.useMemo(() => {
    const keys = [...FSEC_FIELDS, ...FSIC_FIELDS, ...NOTICE_FIELDS];
    const acc = Object.fromEntries(keys.map((f) => [f.key, 0])) as Record<IssuanceKey, number>;
    for (const s of slices) {
      if (s.month === targetMonth) {
        for (const f of keys) {
          acc[f.key] +=
            (Number((manual as unknown as Record<string, number>)[f.key]) || 0) +
            (Number((fsis as unknown as Record<string, number>)[f.key]) || 0);
        }
      } else {
        const m = modeOf(s.daily, 96);
        const fs = modeOf(s.daily, 97);
        for (const f of keys) {
          acc[f.key] +=
            (Number((m as unknown as Record<string, number> | undefined)?.[f.key]) || 0) +
            (Number((fs as unknown as Record<string, number> | undefined)?.[f.key]) || 0);
        }
      }
    }
    return acc;
  }, [slices, targetMonth, manual, fsis]);

  const grandTotal =
    Object.values(inspTotals).reduce((a, b) => a + b, 0) +
    Object.values(issTotals).reduce((a, b) => a + b, 0);

  const readonlyCell =
    "border border-border/60 px-2 py-1 text-right text-[11px] tabular-nums text-muted-foreground";
  const editCell = "border border-border/60 p-1";

  const renderRow = (
    label: string,
    src: Record<string, number> | undefined,
    editable: boolean,
    idx: number,
  ) => {
    const get = (k: string) => Number(src?.[k] ?? 0) || 0;
    return (
      <>
        <td className="border border-border/60 bg-muted/40 px-2 py-1 text-center text-[11px] font-semibold text-foreground">
          {label}
        </td>
        {[...FSEC_FIELDS, ...FSIC_FIELDS, ...NOTICE_FIELDS].map((f) =>
          editable ? (
            <td key={f.key} className={editCell}>
              <CellNumber
                value={get(f.key)}
                onChange={(v) => setIssField(idx, f.key as keyof IssuanceEdit, v)}
              />
            </td>
          ) : (
            <td key={f.key} className={readonlyCell}>
              {get(f.key).toLocaleString()}
            </td>
          ),
        )}
      </>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <table className="w-full min-w-[1600px] border-collapse text-xs">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="border border-border/60 bg-blue-700 px-3 py-2 text-center align-middle font-semibold uppercase tracking-wider text-white"
            >
              Month
            </th>
            <th
              colSpan={INSP_FIELDS.length}
              className={`border border-border/60 px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE.INSPECTION}`}
            >
              Inspection
            </th>
            <th
              rowSpan={2}
              className="border border-border/60 bg-slate-700 px-2 py-2 text-center align-middle font-semibold uppercase tracking-wider text-white"
            >
              Mode
            </th>
            <th
              colSpan={FSEC_FIELDS.length}
              className={`border border-border/60 px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE.FSEC}`}
            >
              FSEC
            </th>
            <th
              colSpan={FSIC_FIELDS.length}
              className={`border border-border/60 px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE.FSIC}`}
            >
              FSIC
            </th>
            <th
              colSpan={NOTICE_FIELDS.length}
              className={`border border-border/60 px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE.NOTICES}`}
            >
              Notices
            </th>
            <th
              rowSpan={2}
              className="border border-border/60 bg-slate-700 px-3 py-2 text-center align-middle font-semibold uppercase tracking-wider text-white"
            >
              Total
            </th>
            <th
              rowSpan={2}
              className="border border-border/60 bg-slate-700 px-3 py-2 text-left align-middle font-semibold uppercase tracking-wider text-white"
            >
              Remarks
            </th>
          </tr>
          <tr>
            {INSP_FIELDS.map((f) => (
              <th
                key={f.key}
                className="border border-border/60 bg-emerald-100 px-1.5 py-1 text-center text-[10px] font-bold uppercase text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
              >
                {f.label}
              </th>
            ))}
            {FSEC_FIELDS.map((f) => (
              <th
                key={f.key}
                className="border border-border/60 bg-sky-100 px-1.5 py-1 text-center text-[10px] font-bold uppercase text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
              >
                {f.label}
              </th>
            ))}
            {FSIC_FIELDS.map((f) => (
              <th
                key={f.key}
                className="border border-border/60 bg-indigo-100 px-1.5 py-1 text-center text-[10px] font-bold uppercase text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100"
              >
                {f.label}
              </th>
            ))}
            {NOTICE_FIELDS.map((f) => (
              <th
                key={f.key}
                className="border border-border/60 bg-amber-100 px-1.5 py-1 text-center text-[10px] font-bold uppercase text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
              >
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slices.map((s, i) => {
            const monthName = MONTHS.find((mo) => mo.value === s.month)?.name ?? String(s.month);
            const isTarget = s.month === targetMonth;
            const isEditable = isTarget && !locked;
            const zebra = i % 2 === 1 ? "bg-muted/30" : "bg-card";
            const inspSrc = (
              isTarget
                ? (inspection as unknown as Record<string, number>)
                : ((s.daily ?? {}) as unknown as Record<string, number>)
            );
            const manualSrc = isTarget
              ? (manual as unknown as Record<string, number>)
              : ((modeOf(s.daily, 96) ?? {}) as unknown as Record<string, number>);
            const fsisSrc = isTarget
              ? (fsis as unknown as Record<string, number>)
              : ((modeOf(s.daily, 97) ?? {}) as unknown as Record<string, number>);

            const rowTotal =
              INSP_FIELDS.reduce((a, f) => a + (Number(inspSrc?.[f.key]) || 0), 0) +
              [...FSEC_FIELDS, ...FSIC_FIELDS, ...NOTICE_FIELDS].reduce(
                (a, f) =>
                  a +
                  (Number(manualSrc?.[f.key]) || 0) +
                  (Number(fsisSrc?.[f.key]) || 0),
                0,
              );

            return (
              <React.Fragment key={s.month}>
                {/* MANUAL row (also spans inspection + month + remarks). */}
                <tr className={zebra}>
                  <td
                    rowSpan={2}
                    className="border border-border/60 bg-blue-50 px-2 py-1.5 text-center align-middle text-[11px] font-bold text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                  >
                    {monthName}
                    {isEditable ? (
                      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                        Editing
                      </div>
                    ) : isTarget ? (
                      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        Locked
                      </div>
                    ) : null}
                  </td>
                  {INSP_FIELDS.map((f) =>
                    isEditable ? (
                      <td key={f.key} rowSpan={2} className="border border-border/60 p-1 align-middle">
                        <CellNumber
                          value={Number(inspSrc?.[f.key]) || 0}
                          onChange={(v) => setInspField(f.key as keyof InspectionEdit, v)}
                        />
                      </td>
                    ) : (
                      <td key={f.key} rowSpan={2} className={`${readonlyCell} align-middle`}>
                        {(Number(inspSrc?.[f.key]) || 0).toLocaleString()}
                      </td>
                    ),
                  )}
                  {renderRow("MANUAL", manualSrc, isEditable, manualIdx)}
                  <td
                    rowSpan={2}
                    className="border border-border/60 bg-accent px-2 py-1 text-center align-middle text-[11px] font-bold tabular-nums text-foreground"
                  >
                    {rowTotal.toLocaleString()}
                  </td>
                  <td rowSpan={2} className="border border-border/60 p-1 align-middle">
                    {isEditable ? (
                      <Textarea
                        rows={3}
                        value={inspection.remarks}
                        onChange={(e) => setInspField("remarks", e.target.value.slice(0, 1000))}
                        placeholder="Notes…"
                        className="min-w-[160px] text-xs"
                      />
                    ) : (
                      <span
                        className="block max-w-[220px] truncate text-[11px] text-muted-foreground"
                        title={isTarget ? inspection.remarks : s.daily?.remarks ?? ""}
                      >
                        {(isTarget ? inspection.remarks : s.daily?.remarks) || "—"}
                      </span>
                    )}
                  </td>
                </tr>
                {/* FSIS row. */}
                <tr className={zebra}>{renderRow("FSIS", fsisSrc, isEditable, fsisIdx)}</tr>
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border bg-accent font-bold text-foreground">
            <td className="border border-border/60 bg-accent px-3 py-2 text-left uppercase tracking-wide">
              Total
            </td>
            {INSP_FIELDS.map((f) => (
              <td
                key={f.key}
                className="border border-border/60 bg-accent px-2 py-2 text-center tabular-nums"
              >
                {inspTotals[f.key].toLocaleString()}
              </td>
            ))}
            <td className="border border-border/60 bg-accent px-2 py-2 text-center">—</td>
            {[...FSEC_FIELDS, ...FSIC_FIELDS, ...NOTICE_FIELDS].map((f) => (
              <td
                key={f.key}
                className="border border-border/60 bg-accent px-2 py-2 text-center tabular-nums"
              >
                {issTotals[f.key as IssuanceKey].toLocaleString()}
              </td>
            ))}
            <td className="border border-border/60 bg-accent px-3 py-2 text-center tabular-nums">
              {grandTotal.toLocaleString()}
            </td>
            <td className="border border-border/60 bg-accent px-3 py-2" aria-hidden />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Compact table-cell numeric input                                          */
/* -------------------------------------------------------------------------- */

function CellNumber({
  value,
  onChange,
}: {
  value: number;
  onChange: (raw: string) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? 0}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
      }}
      className="h-8 w-full min-w-[56px] px-1.5 py-0 text-center text-xs tabular-nums"
    />
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
