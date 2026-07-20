import * as React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import { CalendarIcon, FilePlus2, Loader2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";

import GentableSearchSelect from "@/components/gentable-search-select";

import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { cn } from "@/lib/utils";

import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type { FSISInventoryDTO } from "@/types/targetinventoryType";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";
import { FSIS_ISSUANCE_TABLE } from "./issuanceMode";

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
  { key: "fsic_business_new", label: "FSIC - Business New" },
  { key: "fsic_business_renewal", label: "FSIC - Business Renewal" },
  { key: "fsic_gov", label: "FSIC - GOV" },
  { key: "fsic_peza", label: "FSIC - PEZA" },
  { key: "fsic_tieza", label: "FSIC - TIEZA" },
];

const OTHERS_FIELDS: NumericFieldSpec[] = [
  { key: "not_nod", label: "NOD", tooltip: "Notice Of Disapproval" },
  { key: "not_ntc", label: "NTC", tooltip: "Notice to Comply" },
  { key: "not_ntcv", label: "NTCV", tooltip: "Notice To Correct Violation" },
  { key: "not_abatement", label: "AVATEMENT" },
  { key: "not_closure", label: "Closure" },
];

const ISSUANCE_FIELDS = [
  ...ISSUANCE_FSEC_FIELDS,
  ...ISSUANCE_FSIC_FIELDS,
  ...OTHERS_FIELDS,
];

const ALL_NUMERIC_FIELDS = [
  ...DAILY_INSPECTION_FIELDS,
];

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

const numericShape = Object.fromEntries(
  ALL_NUMERIC_FIELDS.map((f) => [f.key, nonNegativeInt]),
);

const schema = z
  .object({
    reportingDate: z.date({ required_error: "Reporting period is required" }),
    provinceno: z.string().trim().min(1, { message: "Province is required" }),
    stationno: z.string().trim().min(1, { message: "Station is required" }),
    remarks: z.string().max(1000).optional().default(""),
  })
  .extend(numericShape);

type FormValues = z.infer<typeof schema>;

const defaultNumeric = Object.fromEntries(
  ALL_NUMERIC_FIELDS.map((f) => [f.key, 0]),
) as Record<string, number>;

const defaultIssuance = Object.fromEntries(
  ISSUANCE_FIELDS.map((f) => [f.key, 0]),
) as Record<string, number>;

/* -------------------------------------------------------------------------- */
/*  Screen body — used stand-alone AND inside the modal wrapper.              */
/* -------------------------------------------------------------------------- */

function InspectionsNewBody({
  onSaved,
  onCancel,
}: {
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const [reportingDate, setReportingDate] = React.useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = React.useState(false);

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
  }, [scope.provinceLocked, scope.provinceno, scope.provincename, scope.stationLocked, scope.stationno, scope.stationname]);

  const [numeric, setNumeric] = React.useState<Record<string, number>>(defaultNumeric);
  const [manualIssuance, setManualIssuance] = React.useState<Record<string, number>>(defaultIssuance);
  const [fsisIssuance, setFsisIssuance] = React.useState<Record<string, number>>(defaultIssuance);
  const [manualModeNo, setManualModeNo] = React.useState<string>("");
  const [manualModeName, setManualModeName] = React.useState<string>("");
  const [fsisModeNo, setFsisModeNo] = React.useState<string>("");
  const [fsisModeName, setFsisModeName] = React.useState<string>("");
  const [remarks, setRemarks] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const year = reportingDate.getFullYear();
  const month = reportingDate.getMonth() + 1;
  const monthName = MONTHS.find((m) => m.value === month)?.name ?? "";

  /* ------------------------- Monthly summary lookups ---------------------- */
  // Data now lives in <TargetAccomplishmentPanel/>, which fetches via
  // targetinventoryAPI.getTargetAccomplishment whenever (station, year, month)
  // changes and dedupes identical requests.


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
      const iso = format(reportingDate, "yyyy-MM-dd");
      const buildIssuance = (
        modeNo: string,
        vals: Record<string, number>,
      ) => {
        const modeNum = Number(modeNo);
        return {
          issuanceno: EMPTY_GUID,
          fsicmode: Number.isFinite(modeNum) ? modeNum : 0,
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
          avatementcount: vals.not_abatement ?? 0,
          closurecount: vals.not_closure ?? 0,
        };
      };
      const payload: FSISInventoryDTO = {
        fsisno: EMPTY_GUID,
        stationno: station.no,
        dateinspected: iso,
        inspectduringcount: numeric.insp_during_construction ?? 0,
        inspectaftercount: numeric.insp_fsic_occupancy ?? 0,
        inspectbplocount: numeric.insp_1st_bplo ?? 0,
        inspectgovcount: numeric.insp_1st_gov ?? 0,
        inspectpezacount: numeric.insp_1st_peza ?? 0,
        inspecttiezacount: numeric.insp_1st_tieza ?? 0,
        remarks: remarks ?? "",
        updatedby: user?.memberno ?? "",
        encodedby: user?.memberno ?? "",
        issuancelist: [
          buildIssuance(manualModeNo, manualIssuance),
          buildIssuance(fsisModeNo, fsisIssuance),
        ],
      };
      const resp = await targetinventoryAPI.create(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save fire safety compliance.");
        return;
      }
      toast.success("Fire safety compliance saved.");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };


  /* ---------------------------------- UI ---------------------------------- */



  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {/* 1. Reporting Period ------------------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle icon={<CalendarIcon className="h-4 w-4" />} title="Reporting Period" />
        <div className="grid grid-cols-1 gap-4 sm:max-w-md">
          <Field
            label="Reporting Period As Of"
            required
            error={errors.reportingDate}
          >
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
                scope.stationLocked
                  ? station.name || "Assigned station"
                  : "Select station"
              }
              onChange={(no, name, _prov, model) => {
                if (scope.stationLocked) return;
                setStation({ no, name, model: model ?? null });
                if (errors.stationno) setErrors((e) => ({ ...e, stationno: "" }));
                // Auto-sync province from the selected station so the two
                // pickers stay in lockstep (bi-directional cross-filter).
                if (!scope.provinceLocked && model?.provinceno && model.provinceno !== province.no) {
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
          stationno={station.no || undefined}
          year={year}
          month={month}
        />


        <div className="space-y-4">
          <InspectionMatrix
            constructionFields={DAILY_INSPECTION_CONSTRUCTION_FIELDS}
            firstFields={DAILY_INSPECTION_FIRST_FIELDS}
            values={numeric}
            errors={errors}
            onChange={setNumericField}
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
          {(() => {
            const makeSetter = (
              setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
            ) => (key: string, raw: string) => {
              const cleaned = raw.replace(/[^0-9]/g, "");
              const value = cleaned === "" ? 0 : Math.max(0, parseInt(cleaned, 10) || 0);
              setter((prev) => ({ ...prev, [key]: value }));
            };
            const setManualField = makeSetter(setManualIssuance);
            const setFsisField = makeSetter(setFsisIssuance);

            const renderColumn = (
              heading: string,
              modeNo: string,
              modeName: string,
              onModeChange: (no: string, name: string) => void,
              values: Record<string, number>,
              onFieldChange: (key: string, raw: string) => void,
            ) => (
              <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-4">
                <div className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  {heading}
                </div>
                <Field label="Issuance Mode" required>
                  <GentableSearchSelect
                    tablename={FSIS_ISSUANCE_TABLE}
                    value={modeNo || undefined}
                    valueName={modeName}
                    placeholder="Select issuance mode"
                    hideCode
                    onChange={(detno, description) => onModeChange(detno, description)}
                  />
                </Field>
                <SubGroup title="Fire Safety Evaluation Certificate (FSEC)">
                  <NumericGrid
                    fields={ISSUANCE_FSEC_FIELDS}
                    values={values}
                    errors={{}}
                    onChange={onFieldChange}
                    disabled={!modeNo}
                  />
                </SubGroup>
                <SubGroup title="Fire Safety Inspection Certificate (FSIC)">
                  <NumericGrid
                    fields={ISSUANCE_FSIC_FIELDS}
                    values={values}
                    errors={{}}
                    onChange={onFieldChange}
                    disabled={!modeNo}
                  />
                </SubGroup>
                <SubGroup title="Other Notices">
                  <NumericGrid
                    fields={OTHERS_FIELDS}
                    values={values}
                    errors={{}}
                    onChange={onFieldChange}
                    disabled={!modeNo}
                  />
                </SubGroup>
              </div>
            );

            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {renderColumn(
                  "MANUAL",
                  manualModeNo,
                  manualModeName,
                  (no, name) => {
                    setManualModeNo(no);
                    setManualModeName(name);
                  },
                  manualIssuance,
                  setManualField,
                )}
                {renderColumn(
                  "FSIS",
                  fsisModeNo,
                  fsisModeName,
                  (no, name) => {
                    setFsisModeNo(no);
                    setFsisModeName(name);
                  },
                  fsisIssuance,
                  setFsisField,
                )}
              </div>
            );
          })()}
        </TooltipProvider>

        <Field label="Remarks">
          <Textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value.slice(0, 1000))}
            placeholder="Additional notes about the inspection…"
          />
        </Field>
      </Card>

      {/* Actions ----------------------------------------------------------- */}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={saving}
          className="bg-gradient-primary text-primary-foreground shadow-elegant"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Saving…" : "Save Inspection"}
        </Button>
      </div>

      {/* Track auth context so unused-var lint stays quiet in stand-alone mode. */}
      <input type="hidden" value={user?.memberno ?? ""} readOnly />
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <FilePlus2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Fire Safety Compliance Entry</DialogTitle>
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
                onSaved={() => {
                  onSaved?.();
                  onOpenChange(false);
                }}
                onCancel={() => onOpenChange(false)}
              />
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Presentational helpers                                                    */
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
    <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 text-sm font-semibold text-foreground">{title}</div>
      {children}
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
}: {
  constructionFields: NumericFieldSpec[];
  firstFields: NumericFieldSpec[];
  values: Record<string, number>;
  errors: Record<string, string>;
  onChange: (key: string, raw: string) => void;
}) {
  const constructionRow = constructionFields.find((f) => f.key === "insp_during_construction");
  const occupancyRow = constructionFields.find((f) => f.key === "insp_fsic_occupancy");

  const renderNumericInput = (f: NumericFieldSpec, disabled?: boolean) => (
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
      {errors[f.key] && (
        <p className="text-[11px] font-medium text-destructive">{errors[f.key]}</p>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Column 1 — Inspection Activities */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-br from-primary/5 to-transparent p-4">
        <div className="mb-3 text-sm font-semibold text-foreground">Inspection Activities</div>
        <div className="space-y-4">
          <div className="space-y-3">
            {constructionRow && renderNumericInput(constructionRow)}
          </div>
          <div className="space-y-3">
            {occupancyRow && renderNumericInput(occupancyRow)}
          </div>
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
          ? "text-amber-600 dark:text-amber-400"
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
