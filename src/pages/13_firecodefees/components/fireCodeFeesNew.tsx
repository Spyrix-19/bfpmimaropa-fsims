import * as React from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Ban,
  CalendarIcon,
  Coins,
  FilePen,
  Loader2,
  Lock,
  Save,
  Trash2,
} from "lucide-react";

import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { buildYears, cn } from "@/lib/utils";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { canManageTargetAndCompliance, canShowEditAction } from "@/lib/permissions";
import { EMPTY_GUID, MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { serializePhilippineDateTime } from "@/lib/date-format";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import StationInfoCard, { StationReadOnlyField } from "@/components/station-info-card";
import { useStationDetails } from "@/hooks/useStationDetails";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";

import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import type {
  FSISFeeCollectionClassDTO,
  FSISFeeCollectionDetailModel,
} from "@/types/firecodefeesType";
import {
  FEE_SECTORS,
  FIRE_CODE_MODES,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  SECTOR_BY_CODE,
  lastDayOfMonthISO,
  peso,
  type FeeAmounts,
  type FireCodeSectorKey,
} from "../feeColumns";
import { groupCategories, useFeeCategories, type FeeCategory } from "./feeCategories";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const MODES = FIRE_CODE_MODES;

export type ModeCode = typeof FIRE_CODE_MODE_MANUAL | typeof FIRE_CODE_MODE_FSIS;
/** Collected amounts keyed by fee category (`feecateg`). */
export type Amounts = FeeAmounts;
export type SectorValues = Record<FireCodeSectorKey, Record<ModeCode, Amounts>>;

const emptyAmounts = (): Amounts => ({});

export const emptyValues = (): SectorValues =>
  Object.fromEntries(
    FEE_SECTORS.map((s) => [
      s.key,
      { [FIRE_CODE_MODE_MANUAL]: emptyAmounts(), [FIRE_CODE_MODE_FSIS]: emptyAmounts() },
    ]),
  ) as unknown as SectorValues;

/** Sum of every collected amount of one sector + mode. */
export const sumAmounts = (amounts: Amounts) =>
  Object.values(amounts).reduce((a, b) => a + (Number(b) || 0), 0);

/** First day of the current month, in ms. Fire Code Fees are monthly, so a
 *  reporting period only counts as "past" once its month has fully ended. */
function startOfCurrentMonth(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}

/** True when the given year/month is earlier than the current month. */
export function isPastMonth(year: number, month: number): boolean {
  return new Date(year, month - 1, 1).getTime() < startOfCurrentMonth();
}

/**
 * `dateaccomplish` of a reporting month — the LAST day of that month, sent as
 * a local date-time string so the saved day is never shifted by a timezone.
 */
export const toDateaccomplish = lastDayOfMonthISO;

/** Keeps digits and a single decimal point, max two decimals. */
function sanitizeAmount(raw: string): string {
  let s = String(raw ?? "").replace(/[^0-9.]/g, "");
  const first = s.indexOf(".");
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, "");
  const [whole, dec] = s.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "");
  return dec === undefined ? cleanWhole : `${cleanWhole}.${dec.slice(0, 2)}`;
}

export const toAmount = (raw: string) => {
  const n = Number(sanitizeAmount(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Pulls the collection record out of whatever shape the detail endpoint returns. */
export function pickFeeRecord(data: unknown): FSISFeeCollectionDetailModel | null {
  const rows: FSISFeeCollectionDetailModel[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    const obj = value as Record<string, unknown>;
    if (obj.feeno) {
      rows.push(obj as unknown as FSISFeeCollectionDetailModel);
      return;
    }
    if (Array.isArray(obj.feedetaillist)) (obj.feedetaillist as unknown[]).forEach(walk);
    if (Array.isArray(obj.sectorlist)) (obj.sectorlist as unknown[]).forEach((sector) => {
      if (sector && typeof sector === "object") {
        const sectorObj = sector as Record<string, unknown>;
        if (Array.isArray(sectorObj.accomfeelist)) {
          (sectorObj.accomfeelist as unknown[]).forEach(walk);
        }
      }
    });
    if (Array.isArray(obj.accomfeelist)) (obj.accomfeelist as unknown[]).forEach(walk);
  };
  walk(data);
  return rows.find((r) => r.feeno && String(r.feeno) !== EMPTY_GUID) ?? null;
}


/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                                */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
  icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {title}
        </h2>
        {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
    </div>
  );
}

/** Peso amount input (digits + up to two decimals). */
function AmountInput({
  value,
  onValueChange,
  disabled,
}: {
  value: number;
  onValueChange: (raw: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState(() => (value ? String(value) : "0"));
  React.useEffect(() => {
    setText(value ? String(value) : "0");
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={disabled}
      readOnly={disabled}
      className={cn("h-9 text-right tabular-nums", disabled && "cursor-not-allowed opacity-60")}
      onFocus={(e) => {
        if (disabled) return;
        if (e.target.value === "0") setText("");
        else e.target.select();
      }}
      onBlur={() => {
        if (disabled) return;
        setText(String(toAmount(text)));
        onValueChange(String(toAmount(text)));
      }}
      onChange={(e) => {
        if (disabled) return;
        const next = sanitizeAmount(e.target.value);
        setText(next);
        onValueChange(next);
      }}
    />
  );
}

/** One sector panel: every fee category with a MANUAL and an FSIC amount. */
export function SectorPanel({
  sectorTitle,
  categories,
  values,
  onChange,
  locked,
}: {
  sectorTitle: string;
  categories: FeeCategory[];
  values: Record<ModeCode, Amounts>;
  onChange: (mode: ModeCode, feecateg: number, raw: string) => void;
  locked?: boolean;
}) {
  const groups = React.useMemo(() => groupCategories(categories), [categories]);
  const totals = MODES.map((m) => sumAmounts(values[m.code]));

  const grand = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fee Category
            </th>
            {MODES.map((m) => (
              <th
                key={m.code}
                className="w-[9.5rem] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {m.label}
              </th>
            ))}
            <th className="w-[7rem] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={`${sectorTitle}-${g.label}`}>
              <tr className="bg-primary/5">
                <td colSpan={4} className="px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {g.code || g.label}
                  </span>
                  {g.items.length > 1 && g.label ? (
                    <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                      {g.label}
                    </span>
                  ) : null}
                </td>
              </tr>
              {g.items.map((c) => {
                const rowTotal = MODES.reduce((a, m) => a + (values[m.code][c.detno] ?? 0), 0);
                return (
                  <tr key={c.key} className="border-t border-border/40">
                    <td className="px-3 py-1.5 align-middle text-foreground/90">{c.label}</td>
                    {MODES.map((m) => (
                      <td key={m.code} className="px-2 py-1.5">
                        <AmountInput
                          value={values[m.code][c.detno] ?? 0}
                          disabled={locked}
                          onValueChange={(raw) => onChange(m.code, c.detno, raw)}
                        />
                      </td>
                    ))}

                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                      {peso(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/60">
            <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider">Total</td>
            {totals.map((t, i) => (
              <td key={MODES[i].code} className="px-3 py-2 text-right font-bold tabular-nums">
                {peso(t)}
              </td>
            ))}
            <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
              {peso(grand)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Matrix view: fee categories as rows, sectors (BPLO, GOV, PEZA, TIEZA) as
 *  column groups with MANUAL / FSIS inputs and a per-sector total. */
function FeeCategoryMatrix({
  categories,
  values,
  onChange,
  locked,
}: {
  categories: FeeCategory[];
  values: SectorValues;
  onChange: (sector: FireCodeSectorKey, mode: ModeCode, feecateg: number, raw: string) => void;
  locked?: boolean;
}) {
  const groups = React.useMemo(() => groupCategories(categories), [categories]);

  /** Overall total across every sector and mode — shown once, never per sector. */
  const grand = React.useMemo(
    () =>
      FEE_SECTORS.reduce(
        (a, s) => a + MODES.reduce((b, m) => b + sumAmounts(values[s.key][m.code]), 0),
        0,
      ),
    [values],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="min-w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr className="bg-muted/50">
            <th
              rowSpan={2}
              className="sticky left-0 z-20 w-64 min-w-64 bg-muted/50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              Fee Category
            </th>
            <th
              rowSpan={2}
              className="sticky left-64 z-20 w-[7rem] border-l border-border/60 bg-muted/50 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              Total
            </th>
            {FEE_SECTORS.map((s) => (
              <th
                key={s.key}
                colSpan={2}
                className="border-l border-border/60 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {s.label}
              </th>
            ))}
          </tr>
          <tr className="bg-muted/50">
            {FEE_SECTORS.map((s) => (
              <React.Fragment key={`${s.key}-sub`}>
                {MODES.map((m, mi) => (
                  <th
                    key={`${s.key}-${m.code}`}
                    className={cn(
                      "w-[9.5rem] px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
                      mi === 0 && "border-l border-border/60",
                    )}
                  >
                    {m.label}
                  </th>
                ))}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <tr className="bg-primary/5">
                <td colSpan={2 + FEE_SECTORS.length * 2} className="px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {g.code || g.label}
                  </span>
                  {g.items.length > 1 && g.label ? (
                    <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                      {g.label}
                    </span>
                  ) : null}
                </td>
              </tr>
              {g.items.map((c) => {
                const rowTotal = FEE_SECTORS.reduce(
                  (a, s) =>
                    a + MODES.reduce((b, m) => b + (values[s.key][m.code][c.detno] ?? 0), 0),
                  0,
                );
                return (
                  <tr key={c.key} className="border-t border-border/40">
                    <td className="sticky left-0 z-10 w-64 min-w-64 bg-background px-3 py-1.5 align-middle text-foreground/90">
                      {c.label}
                    </td>
                    <td className="sticky left-64 z-10 border-l border-border/60 bg-background px-3 py-1.5 text-right font-semibold tabular-nums">
                      {peso(rowTotal)}
                    </td>
                    {FEE_SECTORS.map((s) => {
                      const manual = values[s.key][FIRE_CODE_MODE_MANUAL][c.detno] ?? 0;
                      const fsis = values[s.key][FIRE_CODE_MODE_FSIS][c.detno] ?? 0;
                      return (
                        <React.Fragment key={`${s.key}-${c.key}`}>
                          <td className="border-l border-border/60 px-2 py-1.5">
                            <AmountInput
                              value={manual}
                              disabled={locked}
                              onValueChange={(raw) =>
                                onChange(s.key, FIRE_CODE_MODE_MANUAL, c.detno, raw)
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <AmountInput
                              value={fsis}
                              disabled={locked}
                              onValueChange={(raw) =>
                                onChange(s.key, FIRE_CODE_MODE_FSIS, c.detno, raw)
                              }
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border/60 bg-muted/60">
            <td className="sticky left-0 z-20 bg-muted/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
              Total
            </td>
            <td className="sticky left-64 z-20 border-l border-border/60 bg-muted/60 px-3 py-2 text-right font-bold tabular-nums text-primary">
              {peso(grand)}
            </td>
            <td colSpan={FEE_SECTORS.length * 2} className="border-l border-border/60" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Form body                                                                  */
/* -------------------------------------------------------------------------- */

export function FireCodeFeesFormBody({
  onSaved,
  onCancel,
  initialYear,
  initialMonth,
  initialStation,
}: {
  onSaved?: () => void;
  onCancel?: () => void;
  initialYear?: number;
  initialMonth?: number;
  initialStation?: {
    stationno: string;
    stationname: string;
    provinceno?: string;
    provincename?: string;
  };
}) {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const isSuper = Number(systemAccess?.roleno ?? 0) === 1;
  /** Add / Edit is limited to Personnel at station types 28–31 (or Super Admin). */
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess) && canShowEditAction(user, systemAccess),
    [user, systemAccess],
  );
  const { categories } = useFeeCategories();

  /* Reporting period (monthly basis — the record is keyed on the 1st) ------ */
  const YEARS = React.useMemo(buildYears, []);
  const [year, setYear] = React.useState<number>(() => {
    const now = new Date();
    return initialYear && initialYear > 1900 ? initialYear : now.getFullYear();
  });
  const [month, setMonth] = React.useState<number>(() => {
    const now = new Date();
    return initialMonth && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : now.getMonth() + 1;
  });
  const lockedPeriod = !!initialStation?.stationno && !!initialYear && !!initialMonth;
  const collectedDate = React.useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const monthName = MONTHS.find((m) => m.value === month)?.name ?? "";
  const selectedDateKey = format(collectedDate, "yyyy-MM-dd");

  /* Province / station ---------------------------------------------------- */
  const [province, setProvince] = React.useState<{ no: string; name: string }>(() => {
    if (scope.provinceLocked) return { no: scope.provinceno, name: scope.provincename };
    if (initialStation?.provinceno)
      return { no: initialStation.provinceno, name: initialStation.provincename ?? "" };
    if (isSuper && user?.provinceno) return { no: user.provinceno, name: user.provincename ?? "" };
    return { no: "", name: "" };
  });
  const [station, setStation] = React.useState<{
    no: string;
    name: string;
    model: SearchStationModel | null;
  }>(() => {
    if (scope.stationLocked) return { no: scope.stationno, name: scope.stationname, model: null };
    if (initialStation?.stationno)
      return { no: initialStation.stationno, name: initialStation.stationname, model: null };
    if (isSuper && user?.stationno)
      return { no: user.stationno, name: user.stationname ?? "", model: null };
    return { no: "", name: "", model: null };
  });

  React.useEffect(() => {
    if (scope.provinceLocked) setProvince({ no: scope.provinceno, name: scope.provincename });
    if (scope.stationLocked)
      setStation({ no: scope.stationno, name: scope.stationname, model: null });
  }, [
    scope.provinceLocked,
    scope.provinceno,
    scope.provincename,
    scope.stationLocked,
    scope.stationno,
    scope.stationname,
  ]);

  const stationDetails = useStationDetails({
    stationno: station.no,
    preloaded: station.model,
    searchKey: station.model?.stationcode || station.name || "",
    provinceno: province.no,
  });

  /* Values ---------------------------------------------------------------- */
  const [values, setValues] = React.useState<SectorValues>(emptyValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const setAmount = React.useCallback(
    (sector: FireCodeSectorKey, mode: ModeCode, feecateg: number, raw: string) => {
      setValues((prev) => ({
        ...prev,
        [sector]: { ...prev[sector], [mode]: { ...prev[sector][mode], [feecateg]: toAmount(raw) } },
      }));
    },
    [],
  );

  /* Existing record detection -------------------------------------------- */
  const [existingFeeno, setExistingFeeno] = React.useState<string | null>(null);
  const [existingAccomplishNos, setExistingAccomplishNos] = React.useState<Record<string, string>>(
    {},
  );
  const [checkingExisting, setCheckingExisting] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);

  const clearValues = React.useCallback(() => {
    setValues(emptyValues());
    setErrors({});
  }, []);

  const resetExisting = React.useCallback(() => {
    setExistingFeeno(null);
    setExistingAccomplishNos({});
  }, []);

  const plotExisting = React.useCallback((rec: FSISFeeCollectionDetailModel) => {
    const next = emptyValues();
    const accomplishNos: Record<string, string> = {};
    const sectorGroups = Array.isArray(rec.sectorlist) ? rec.sectorlist : [];
    const items = sectorGroups.flatMap((sector) =>
      Array.isArray(sector?.accomfeelist) ? sector.accomfeelist : [],
    );
    for (const item of items) {
      const sector = SECTOR_BY_CODE.get(Number(item.sectorno));
      if (!sector) continue;
      const mode: ModeCode =
        Number(item.fsicmode) === FIRE_CODE_MODE_FSIS ? FIRE_CODE_MODE_FSIS : FIRE_CODE_MODE_MANUAL;
      const feecateg = Number(item.feecateg) || 0;
      next[sector][mode][feecateg] = Number(item.collectedamount ?? 0) || 0;
      if (item.accomplishno)
        accomplishNos[`${sector}|${mode}|${feecateg}`] = String(item.accomplishno);
    }
    setValues(next);
    setExistingAccomplishNos(accomplishNos);
    setExistingFeeno(String(rec.feeno));
    setErrors({});
  }, []);

  /**
   * Whenever the station, month or year changes (initial load included) the
   * Detail/Date endpoint decides the mode: a record found → edit + plot its
   * amounts, nothing found → a fresh creation.
   */
  /** Last period the existence check ran for — used to only prompt on a
   *  month/year CHANGE, not on the initial load or a station switch. */
  const lastCheckedPeriodRef = React.useRef<string | null>(null);
  /** Existing record waiting for the user's confirmation before it is plotted. */
  const [pendingExisting, setPendingExisting] =
    React.useState<FSISFeeCollectionDetailModel | null>(null);
  const [existingDialogOpen, setExistingDialogOpen] = React.useState(false);


  React.useEffect(() => {
    const activeStationNo = scope.stationLocked ? scope.stationno || station.no : station.no;
    if (!activeStationNo || activeStationNo === EMPTY_GUID) {
      resetExisting();
      clearValues();
      return;
    }
    const periodChanged =
      lastCheckedPeriodRef.current !== null && lastCheckedPeriodRef.current !== selectedDateKey;
    lastCheckedPeriodRef.current = selectedDateKey;
    let cancelled = false;
    (async () => {
      setCheckingExisting(true);
      clearValues();
      resetExisting();
      const resp = await firecodefeesAPI.getDetailBydate(
        { Stationno: activeStationNo, Reportyear: year, Reportmonth: month },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<unknown>(resp);
      const record = ok ? pickFeeRecord(data) : null;
      setCheckingExisting(false);
      if (record) {
        if (periodChanged) {
          setPendingExisting(record);
          setExistingDialogOpen(true);
        } else {
          plotExisting(record);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.no, scope.stationLocked, scope.stationno, selectedDateKey, reloadNonce]);


  /* Revision requests ----------------------------------------------------- */
  const [revisionRequests, setRevisionRequests] = React.useState<FSISEditRequestModel[]>([]);
  const [addRevisionOpen, setAddRevisionOpen] = React.useState(false);
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);

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
          requesttype: "COMPLIANCE",
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data } = unwrap<FSISEditRequestModel[]>(resp);
      setRevisionRequests(ok && Array.isArray(data) ? data : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [station.no, scope.stationLocked, scope.stationno, province.no, year, reloadNonce]);

  const isPastSelectedDate = IS_PAST_DATE_LOCK_ENABLED && isPastMonth(year, month);
  const approvedRequest = React.useMemo(
    () =>
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "APPROVED") return false;
        if (existingFeeno && String(r.referencekey) === String(existingFeeno)) return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === selectedDateKey : false;
      }) ?? null,
    [revisionRequests, selectedDateKey, existingFeeno],
  );
  const unlockedByApproval = !!approvedRequest;
  const activeRequest = React.useMemo(
    () =>
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "PENDING") return false;
        if (existingFeeno && String(r.referencekey) === String(existingFeeno)) return true;
        return r.dateinspected ? String(r.dateinspected).slice(0, 10) === selectedDateKey : false;
      }) ?? null,
    [revisionRequests, selectedDateKey, existingFeeno],
  );
  const hasPendingRevision = !unlockedByApproval && !!activeRequest;
  const needsRevisionRequest =
    canManage && isPastSelectedDate && !unlockedByApproval && !hasPendingRevision;
  const fieldsLocked =
    !canManage || (!unlockedByApproval && (isPastSelectedDate || hasPendingRevision));

  /* Totals ---------------------------------------------------------------- */
  const sectorTotals = React.useMemo(() => {
    const totals = {} as Record<FireCodeSectorKey, Record<ModeCode, number>>;
    for (const s of FEE_SECTORS) {
      const byMode = {} as Record<ModeCode, number>;
      for (const m of MODES) byMode[m.code] = sumAmounts(values[s.key][m.code]);
      totals[s.key] = byMode;
    }
    return totals;
  }, [values]);


  const grandTotal = React.useMemo(
    () =>
      FEE_SECTORS.reduce(
        (a, s) => a + MODES.reduce((b, m) => b + sectorTotals[s.key][m.code], 0),
        0,
      ),
    [sectorTotals],
  );

  /** Overall total per collection mode across all sectors. */
  const modeTotals = React.useMemo(() => {
    const t = {} as Record<ModeCode, number>;
    for (const m of MODES)
      t[m.code] = FEE_SECTORS.reduce((a, s) => a + sectorTotals[s.key][m.code], 0);
    return t;
  }, [sectorTotals]);

  /* Submit ---------------------------------------------------------------- */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!province.no) nextErrors.provinceno = "Province is required";
    const submitStationNo = scope.stationLocked ? scope.stationno || station.no : station.no;
    if (!submitStationNo || submitStationNo === EMPTY_GUID)
      nextErrors.stationno = "Station is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});

    if (fieldsLocked) {
      toast.error("This date is locked. Submit a revision request to enable editing.");
      return;
    }

    const encodedby = user?.memberno ? String(user.memberno) : "";
    if (!encodedby || encodedby === EMPTY_GUID) {
      toast.error("Your session is missing an encoder ID. Please sign in again.");
      return;
    }

    setSaving(true);
    try {
      const fsisfeecollectionList: FSISFeeCollectionClassDTO[] = [];
      for (const s of FEE_SECTORS) {
        for (const m of MODES) {
          const amounts = values[s.key][m.code];
          for (const c of categories) {
            fsisfeecollectionList.push({
              accomplishno: existingAccomplishNos[`${s.key}|${m.code}|${c.detno}`] || EMPTY_GUID,
              fsicmode: m.code,
              feecateg: c.detno,
              collectedamount: amounts[c.detno] ?? 0,
              sectorno: s.code,
            });
          }
        }
      }

      const resp = await firecodefeesAPI.create({
        stationno: submitStationNo,
        encodedby: encodedby,
        fsisfeeList: [
          {
            feeno: existingFeeno || EMPTY_GUID,
            dateaccomplish: lastDayOfMonthISO(year, month),
            isaccomplished: true,
            remarks: "",
            fsisfeecollectionList,
          },
        ],
      });

      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save the Fire Code Fees collection.");
        return;
      }
      toast.success(
        existingFeeno ? "Fire Code Fees collection updated." : "Fire Code Fees collection saved.",
      );
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  /* ----------------------------------------------------------------------- */

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      {!canManage && (
        <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>View only — your role and station are not allowed to encode Fire Code Fees.</span>
        </div>
      )}

      {canManage && fieldsLocked && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {hasPendingRevision
              ? "A revision request for this date is pending approval. Fields stay locked until it is approved."
              : "This date has already passed and is locked. Submit a revision request to enable editing."}
          </span>
        </div>
      )}

      {/* 1. Reporting period */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          icon={<CalendarIcon className="h-4 w-4" />}
          title="Reporting Period"
          subtitle="Fire Code Fees are collected and reported on a monthly basis."
        />
        <div className="grid grid-cols-1 gap-4 sm:max-w-md sm:grid-cols-2">
          <Field label="Month" required>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
              disabled={lockedPeriod}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Year" required>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              disabled={lockedPeriod}
            >
              <SelectTrigger className="h-10">
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
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Reporting month · {monthName} {year}
        </p>
        <PastDatesLockedNote />
      </Card>

      {/* 2. Station information */}
      <StationInfoCard
        stationName={stationDetails.stationName || station.name || ""}
        unitCode={stationDetails.stationCode || ""}
        logoUrl={stationDetails.logoUrl || null}
        fields={[]}
      >
        {!(scope.provinceLocked && scope.stationLocked) && (
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
                onChange={(no, name) => {
                  if (scope.provinceLocked) return;
                  setProvince({ no, name });
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
                  if (
                    !scope.provinceLocked &&
                    model?.provinceno &&
                    model.provinceno !== province.no
                  ) {
                    setProvince({ no: model.provinceno, name: model.provincename ?? "" });
                    if (errors.provinceno) setErrors((e) => ({ ...e, provinceno: "" }));
                  }
                }}
              />
            </Field>
          </div>
        )}

        {(station.no || stationDetails.stationName) && (
          <div className="grid gap-4 sm:grid-cols-3">
            <StationReadOnlyField
              label="Station Code"
              value={stationDetails.stationCode || (stationDetails.loading ? "Loading…" : "")}
            />
            <StationReadOnlyField
              label="City / Municipality"
              value={stationDetails.cityName || (stationDetails.loading ? "Loading…" : "")}
            />
            <StationReadOnlyField
              label="Province"
              value={
                stationDetails.provinceName ||
                province.name ||
                (stationDetails.loading ? "Loading…" : "")
              }
            />
          </div>
        )}
      </StationInfoCard>

      {/* 3. Fee category encoding matrix */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          icon={<Coins className="h-4 w-4" />}
          title="Fire Code Fees Collection"
          subtitle="Encode MANUAL and FSIS amounts per fee category across establishment sectors."
        />
        <FeeCategoryMatrix
          categories={categories}
          values={values}
          locked={fieldsLocked}
          onChange={(sector, mode, feecateg, raw) => setAmount(sector, mode, feecateg, raw)}
        />
      </Card>

      {/* 4. Collection summary — simple per-sector totals */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          icon={<Coins className="h-4 w-4" />}
          title="Collection Summary"
          subtitle="Totals per establishment sector."
        />
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sector
                </th>
                {MODES.map((m) => (
                  <th
                    key={m.code}
                    className="w-44 border-l border-border/60 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="w-44 border-l border-border/60 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {FEE_SECTORS.map((s) => (
                <tr key={s.key} className="border-t border-border/40">
                  <td className="px-3 py-2 align-middle font-medium text-foreground/90">
                    {s.title}
                  </td>
                  <td className="border-l border-border/60 px-3 py-2 text-right tabular-nums">
                    {peso(sectorTotals[s.key][FIRE_CODE_MODE_MANUAL])}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {peso(sectorTotals[s.key][FIRE_CODE_MODE_FSIS])}
                  </td>
                  <td className="border-l border-border/60 px-3 py-2 text-right font-semibold tabular-nums">
                    {peso(
                      sectorTotals[s.key][FIRE_CODE_MODE_MANUAL] +
                        sectorTotals[s.key][FIRE_CODE_MODE_FSIS],
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border/60 bg-muted/60">
                <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider">Total</td>
                <td className="border-l border-border/60 px-3 py-2 text-right font-bold tabular-nums">
                  {peso(modeTotals[FIRE_CODE_MODE_MANUAL])}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {peso(modeTotals[FIRE_CODE_MODE_FSIS])}
                </td>
                <td className="border-l border-border/60 px-3 py-2 text-right font-bold tabular-nums text-primary">
                  {peso(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2">
        {needsRevisionRequest ? (
          <Button
            type="button"
            onClick={() => {
              if (!station.no) {
                toast.info("Select a station first.");
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
              onClick={() =>
                activeRequest
                  ? setCancelRequestId(activeRequest.requestno)
                  : toast.info("No active revision request to cancel.")
              }
            >
              <Ban className="h-4 w-4" /> Cancel Request
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              onClick={() =>
                activeRequest
                  ? setDeleteRequestId(activeRequest.requestno)
                  : toast.info("No revision request to delete.")
              }
            >
              <Trash2 className="h-4 w-4" /> Delete Request
            </Button>
          </>
        ) : (
          <>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {canManage ? "Cancel" : "Close"}
              </Button>
            )}
            {canManage && (
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
              {saving ? "Saving…" : existingFeeno ? "Update" : "Save Collection"}
            </Button>
            )}
          </>
        )}
      </div>

      {addRevisionOpen && (
        <RevisionRequestDialog
          open={addRevisionOpen}
          onOpenChange={setAddRevisionOpen}
          module="monitoring"
          station={{
            stationno: station.no,
            stationcode: stationDetails.stationCode ?? "",
            stationname: station.name || stationDetails.stationName || "",
            provinceno: province.no,
            provincename: province.name,
            cityname: stationDetails.cityName ?? "",
          }}
          year={year}
          month={month}
          referencekey={existingFeeno || EMPTY_GUID}
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
            requesttype: "COMPLIANCE",
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
        open={existingDialogOpen}
        onOpenChange={(v) => {
          if (v) setExistingDialogOpen(true);
        }}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-warning-soft"
        contentIconColorClass="text-warning"
        title="Fire Code Fees Record Already Exists"
        description={`A Fire Code Fees record already exists for this station and period (${monthName} ${year}).\n\nOpening the existing record for editing.`}
        confirmLabel="Edit Existing"
        showCancel={false}
        dismissible={false}
        onConfirm={() => {
          if (pendingExisting) plotExisting(pendingExisting);
          setPendingExisting(null);
          setExistingDialogOpen(false);
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
/*  Modal wrapper — used by the Fire Code Fees ledger Add / Edit buttons.      */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesFormModal({
  open,
  onOpenChange,
  onSaved,
  initialYear,
  initialMonth,
  initialStation,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
  initialYear?: number;
  initialMonth?: number;
  initialStation?: {
    stationno: string;
    stationname: string;
    provinceno?: string;
    provincename?: string;
  };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] min-h-0 w-[calc(100vw-2rem)] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Fire Code Fees Collection</DialogTitle>
              <DialogDescription>
                Select a collection date and station, then encode the amounts collected per sector.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {open ? (
            <FireCodeFeesFormBody
              initialYear={initialYear}
              initialMonth={initialMonth}
              initialStation={initialStation}
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
