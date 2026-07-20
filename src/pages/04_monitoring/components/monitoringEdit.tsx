import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Building2, CalendarIcon, Loader2, Plus, Save, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import GentableSearchSelect from "@/components/gentable-search-select";

import { useAuth } from "@/lib/auth";
import { EMPTY_GUID, unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { cn } from "@/lib/utils";

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
import { FSIS_ISSUANCE_TABLE } from "./issuanceMode";

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

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [record, setRecord] = React.useState<FSISInventoryMonthlyLedgerModel | null>(null);
  const [inspection, setInspection] = React.useState<InspectionEdit>(() =>
    emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`),
  );
  const [issuances, setIssuances] = React.useState<IssuanceEdit[]>([]);

  /* ----------------------------- Data loading ---------------------------- */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Resolve provinceno — required by the Monthly endpoint.
      const sResp = await stationAPI.search({
        pageNumber: 1,
        pageSize: 1,
        searchKey: stationno,
      });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seed = Array.isArray(sData) ? sData[0] : undefined;
      const provinceno = seed?.provinceno ?? EMPTY_GUID;

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
      if (!ok) toast.error(error || "Failed to load record.");

      const head = Array.isArray(data) ? data[0] ?? null : null;
      const daily = head?.fsisInventoryLedgerList?.[0];

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
        const list = Array.isArray(daily.issuancelist) ? daily.issuancelist : [];
        setIssuances(
          list.map((iss) => ({
            issuanceno: iss.issuanceno ?? EMPTY_GUID,
            fsicmode: toNum(iss.fsicmode),
            fsicmodename: "",
            fsecbuildingcount: toNum(iss.fsecbuildingcount),
            fsecgovcount: toNum(iss.fsecgovcount),
            fsecpezacount: toNum(iss.fsecpezacount),
            fsectiezacount: toNum(iss.fsectiezacount),
            fsicoccupancycount: toNum(iss.fsicoccupancycount),
            fsicbplonewcount: toNum(iss.fsicbplonewcount),
            fsicbplorenewcount: toNum(iss.fsicbplorenewcount),
            fsicgovcount: toNum(iss.fsicgovcount),
            fsicpezacount: toNum(iss.fsicpezacount),
            fsictiezacount: toNum(iss.fsictiezacount),
            nodcount: toNum(iss.nodcount),
            ntccount: toNum(iss.ntccount),
            ntcvcount: toNum(iss.ntcvcount),
            avatementcount: toNum(iss.avatementcount),
            closurecount: toNum(iss.closurecount),
          })),
        );
      } else {
        setInspection(emptyInspection(`${year}-${String(month).padStart(2, "0")}-01`));
        setIssuances([]);
      }
      setRecord(head);
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

  const setIssMode = (index: number, detno: string, name: string) => {
    setIssuances((prev) =>
      prev.map((iss, i) =>
        i === index ? { ...iss, fsicmode: Number(detno) || 0, fsicmodename: name } : iss,
      ),
    );
  };

  const addIssuance = () =>
    setIssuances((prev) => [...prev, emptyIssuance()]);

  const removeIssuance = (index: number) =>
    setIssuances((prev) => prev.filter((_, i) => i !== index));

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

      {/* Daily Inspection Activities ---------------------------------------- */}
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* MANUAL column */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
            <div className="mb-3 text-sm font-semibold text-foreground">MANUAL</div>
            <div className="space-y-3">
              <NumberField
                label="Inspection During Construction"
                value={inspection.inspectduringcount}
                onChange={(v) => setInspField("inspectduringcount", v)}
              />
              <NumberField
                label="Inspection for FSIC Occupancy"
                value={inspection.inspectaftercount}
                onChange={(v) => setInspField("inspectaftercount", v)}
              />
            </div>
          </div>

          {/* FSIS COMPLIANCE column */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4 lg:col-span-2">
            <div className="mb-3 text-sm font-semibold text-foreground">FSIS COMPLIANCE</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField
                label="1st Inspection BPLO"
                value={inspection.inspectbplocount}
                onChange={(v) => setInspField("inspectbplocount", v)}
              />
              <NumberField
                label="1st Inspection GOV"
                value={inspection.inspectgovcount}
                onChange={(v) => setInspField("inspectgovcount", v)}
              />
              <NumberField
                label="1st Inspection PEZA"
                value={inspection.inspectpezacount}
                onChange={(v) => setInspField("inspectpezacount", v)}
              />
              <NumberField
                label="1st Inspection TIEZA"
                value={inspection.inspecttiezacount}
                onChange={(v) => setInspField("inspecttiezacount", v)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Remarks</Label>
          <Textarea
            rows={3}
            value={inspection.remarks}
            onChange={(e) => setInspField("remarks", e.target.value.slice(0, 1000))}
            placeholder="Additional notes about the inspection…"
          />
        </div>
      </Card>

      {/* Daily Issuance Activities ------------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <SectionTitle
            title="Daily Issuance Activities"
            subtitle={`${issuances.length} issuance${issuances.length === 1 ? "" : "s"}`}
          />
          <Button type="button" variant="outline" size="sm" onClick={addIssuance} className="gap-2">
            <Plus className="h-4 w-4" /> Add Issuance
          </Button>
        </div>

        {issuances.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
            No issuance records for this month.
          </div>
        ) : (
          <div className="space-y-4">
            {issuances.map((iss, idx) => (
              <IssuanceCard
                key={`${iss.issuanceno}-${idx}`}
                index={idx}
                issuance={iss}
                onChangeField={(k, v) => setIssField(idx, k, v)}
                onChangeMode={(no, name) => setIssMode(idx, no, name)}
                onRemove={() => removeIssuance(idx)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Actions ------------------------------------------------------------ */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
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
/*  Issuance card                                                              */
/* -------------------------------------------------------------------------- */

function IssuanceCard({
  index,
  issuance,
  onChangeField,
  onChangeMode,
  onRemove,
}: {
  index: number;
  issuance: IssuanceEdit;
  onChangeField: (key: keyof IssuanceEdit, raw: string) => void;
  onChangeMode: (detno: string, name: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground">Issuance #{index + 1}</div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Remove
        </Button>
      </div>

      <div className="mb-4 max-w-sm">
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Mode of Issuance <span className="text-destructive">*</span>
        </Label>
        <GentableSearchSelect
          tablename={FSIS_ISSUANCE_TABLE}
          value={issuance.fsicmode ? String(issuance.fsicmode) : undefined}
          valueName={issuance.fsicmodename}
          placeholder="Select issuance mode"
          hideCode
          onChange={(detno, description) => onChangeMode(detno, description)}
        />
      </div>

      <SubGroup title="Fire Safety Evaluation Certificate (FSEC)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="FSEC - New Building" value={issuance.fsecbuildingcount} onChange={(v) => onChangeField("fsecbuildingcount", v)} />
          <NumberField label="FSEC - New GOV" value={issuance.fsecgovcount} onChange={(v) => onChangeField("fsecgovcount", v)} />
          <NumberField label="FSEC - New PEZA" value={issuance.fsecpezacount} onChange={(v) => onChangeField("fsecpezacount", v)} />
          <NumberField label="FSEC - New TIEZA" value={issuance.fsectiezacount} onChange={(v) => onChangeField("fsectiezacount", v)} />
        </div>
      </SubGroup>

      <div className="h-3" />

      <SubGroup title="Fire Safety Inspection Certificate (FSIC)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="FSIC - Occupancy" value={issuance.fsicoccupancycount} onChange={(v) => onChangeField("fsicoccupancycount", v)} />
          <NumberField label="FSIC - Business New" value={issuance.fsicbplonewcount} onChange={(v) => onChangeField("fsicbplonewcount", v)} />
          <NumberField label="FSIC - Business Renewal" value={issuance.fsicbplorenewcount} onChange={(v) => onChangeField("fsicbplorenewcount", v)} />
          <NumberField label="FSIC - GOV" value={issuance.fsicgovcount} onChange={(v) => onChangeField("fsicgovcount", v)} />
          <NumberField label="FSIC - PEZA" value={issuance.fsicpezacount} onChange={(v) => onChangeField("fsicpezacount", v)} />
          <NumberField label="FSIC - TIEZA" value={issuance.fsictiezacount} onChange={(v) => onChangeField("fsictiezacount", v)} />
        </div>
      </SubGroup>

      <div className="h-3" />

      <SubGroup title="Other Notices">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NumberField label="NOD" value={issuance.nodcount} onChange={(v) => onChangeField("nodcount", v)} />
          <NumberField label="NTC" value={issuance.ntccount} onChange={(v) => onChangeField("ntccount", v)} />
          <NumberField label="NTCV" value={issuance.ntcvcount} onChange={(v) => onChangeField("ntcvcount", v)} />
          <NumberField label="Avatement" value={issuance.avatementcount} onChange={(v) => onChangeField("avatementcount", v)} />
          <NumberField label="Closure" value={issuance.closurecount} onChange={(v) => onChangeField("closurecount", v)} />
        </div>
      </SubGroup>
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

function SubGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        pattern="[0-9]*"
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (["-", "+", "e", "E", "."].includes(e.key)) e.preventDefault();
        }}
        className={cn("tabular-nums", disabled && "cursor-not-allowed opacity-60")}
      />
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
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
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
