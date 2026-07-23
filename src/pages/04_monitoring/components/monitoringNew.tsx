import * as React from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { z } from "zod";
import { AlertTriangle, CalendarIcon, FilePlus2, Loader2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { cn } from "@/lib/utils";

import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISInventoryDTO,
  FSISInventoryMonthlyLedgerModel,
} from "@/types/targetinventoryType";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

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
  { key: "not_abatement", label: "AVATEMENT" },
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
}: {
  onSaved?: () => void;
  onCancel?: () => void;
  onEditExisting?: (stationno: string, year: number, month: number, stationName?: string) => void;
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
  // Mode of Issuance is fixed per column: MANUAL = 96, FSIS = 97.
  const manualModeNo = "96";
  const fsisModeNo = "97";
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

  const formatDateKey = (value: string | Date | null | undefined) => {
    if (!value) return null;
    if (typeof value === "string") return value.slice(0, 10);
    if (value instanceof Date && !Number.isNaN(value.getTime())) return format(value, "yyyy-MM-dd");
    return null;
  };

  const checkExistingDailyRecord = async (
    stationNumber: string,
    provinceNumber: string,
    date: Date,
  ) => {
    const resp = await targetinventoryAPI.getMonthly(
      {
        Stationno: stationNumber || EMPTY_GUID,
        Provinceno: provinceNumber || EMPTY_GUID,
        Reportyear: date.getFullYear(),
        Reportmonth: date.getMonth() + 1,
      },
      { suppressGlobalLoading: true },
    );

    const { ok, data, error } = unwrap<FSISInventoryMonthlyLedgerModel[]>(resp);
    if (!ok) {
      toast.error(error || "Unable to verify existing fire safety compliance record.");
      return null;
    }

    const record = Array.isArray(data) ? (data[0] ?? null) : null;
    if (!record || !Array.isArray(record.fsisInventoryLedgerList)) return null;

    const checkKey = formatDateKey(date);
    if (!checkKey) return null;

    const existing = record.fsisInventoryLedgerList.find(
      (item) => formatDateKey(item.dateinspected) === checkKey,
    );
    if (!existing) return null;

    return {
      stationno: stationNumber,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    };
  };

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
      const submitStationNo = scope.stationLocked
        ? scope.stationno || station.no || ""
        : station.no;

      if (!submitStationNo || submitStationNo === EMPTY_GUID) {
        toast.error("Please select a station.");
        return;
      }

      if (!duplicatePrompted) {
        const existing = await checkExistingDailyRecord(
          submitStationNo,
          province.no,
          reportingDate,
        );
        if (existing) {
          setDuplicatePrompted(true);
          setPendingDuplicateTarget({
            stationno: existing.stationno,
            year: existing.year,
            month: existing.month,
            stationName: station.name || user?.stationname,
          });
          setDuplicateDialogOpen(true);
          setSaving(false);
          return;
        }
      }

      const iso = format(reportingDate, "yyyy-MM-dd");
      const buildIssuance = (modeNo: string, vals: Record<string, number>) => {
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
        stationno: submitStationNo,
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

  const handleDuplicateConfirm = () => {
    if (pendingDuplicateTarget && onEditExisting) {
      onEditExisting(
        pendingDuplicateTarget.stationno,
        pendingDuplicateTarget.year,
        pendingDuplicateTarget.month,
        pendingDuplicateTarget.stationName,
      );
    }
    setDuplicatePrompted(false);
    setPendingDuplicateTarget(null);
    setDuplicateDialogOpen(false);
  };

  const handleDuplicateCancel = () => {
    setDuplicatePrompted(false);
    setPendingDuplicateTarget(null);
    setDuplicateDialogOpen(false);
  };

  const handleDuplicateDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && !pendingDuplicateTarget) {
      setDuplicatePrompted(false);
    }
    setDuplicateDialogOpen(newOpen);
  };

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
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

        <TargetAccomplishmentPanel stationno={station.no || undefined} year={year} month={month} />

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
          <IssuanceTable
            manualValues={manualIssuance}
            fsisValues={fsisIssuance}
            setManualValues={setManualIssuance}
            setFsisValues={setFsisIssuance}
          />
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

      <ConfirmDialog
        open={duplicateDialogOpen}
        onOpenChange={handleDuplicateDialogOpenChange}
        ContentIcon={AlertTriangle}
        contentIconBgClass="bg-amber-50"
        contentIconColorClass="text-amber-700"
        title="Fire Safety Compliance Already Exists"
        description="A fire safety compliance record for this station and reporting date already exists. Open the existing record for editing instead."
        confirmLabel="Edit Existing"
        showCancel={true}
        cancelLabel="Continue Adding"
        onConfirm={handleDuplicateConfirm}
        onCancel={handleDuplicateCancel}
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  onEditExisting?: (stationno: string, year: number, month: number, stationName?: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
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
}: {
  manualValues: Record<string, number>;
  fsisValues: Record<string, number>;
  setManualValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setFsisValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
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
      headClass: "bg-sky-700 text-white dark:bg-sky-600",
      subHeadClass: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100",
    },
    {
      title: "FSIC",
      fields: ISSUANCE_FSIC_FIELDS,
      headClass: "bg-slate-700 text-white dark:bg-slate-600",
      subHeadClass: "bg-slate-100 text-slate-900 dark:bg-slate-950/60 dark:text-slate-100",
    },
    {
      title: "NOTICES",
      fields: OTHERS_FIELDS,
      headClass: "bg-cyan-700 text-white dark:bg-cyan-600",
      subHeadClass: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-100",
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
                className="sticky left-0 top-0 z-40 min-w-[110px] border-b border-r bg-blue-700 px-3 py-2 text-center align-middle uppercase tracking-wider text-white"
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
                className="min-w-[90px] border-b border-l bg-blue-700 px-3 py-2 text-center align-middle uppercase tracking-wider text-white"
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
