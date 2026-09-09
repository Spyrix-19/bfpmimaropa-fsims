import * as React from "react";
import {
  Ban,
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Coins,
  Eye,
  FilePen,
  Loader2,
  Lock,
  LockOpen,
  Save,
  Trash2,
} from "lucide-react";

import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { buildYears, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { EMPTY_GUID, MONTHS } from "@/lib/fsims-constants";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StationInfoCard from "@/components/station-info-card";
import { PastDatesLockedNote } from "@/components/past-dates-locked-note";
import RevisionRequestDialog from "@/pages/06_target-reference/revision/RevisionRequestDialog";
import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";

import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import type {
  FSISFeeCollectionClass,
  FSISFeeCollectionClassDTO,
  FSISFeeCollectionDetailModel,
  FSISStationFeeDetailModel,
} from "@/types/firecodefeesType";
import {
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  SECTOR_BY_CODE,
  lastDayOfMonthISO,
  peso,
  type FireCodeSectorKey,
} from "../feeColumns";
import { useFeeCategories } from "./feeCategories";
import {
  MODES,
  SectorPanel,
  emptyValues,
  isPastMonth,
  sumAmounts,
  toAmount,
  type ModeCode,
  type SectorValues,
} from "./fireCodeFeesNew";

/* -------------------------------------------------------------------------- */
/*  Types & helpers                                                            */
/* -------------------------------------------------------------------------- */

export interface FeeEditorStation {
  stationno: string;
  stationcode?: string;
  stationname: string;
  provinceno?: string;
  provincename?: string;
}

interface MonthState {
  month: number;
  feeno: string | null;
  accomplishNos: Record<string, string>;
  values: SectorValues;
  baseline: string;
}

const snapshot = (v: SectorValues) => JSON.stringify(v);

const freshMonth = (month: number): MonthState => {
  const values = emptyValues();
  return {
    month,
    feeno: null,
    accomplishNos: {},
    values,
    baseline: snapshot(values),
  };
};

/** Converts a raw collection record into an editable month state. */
function fromRecord(month: number, rec: FSISFeeCollectionDetailModel): MonthState {
  const values = emptyValues();
  const accomplishNos: Record<string, string> = {};
  for (const item of Array.isArray(rec.accomfeelist) ? rec.accomfeelist : []) {
    const sector = SECTOR_BY_CODE.get(Number(item.sectorno));
    if (!sector) continue;
    const mode: ModeCode =
      Number(item.fsicmode) === FIRE_CODE_MODE_FSIS ? FIRE_CODE_MODE_FSIS : FIRE_CODE_MODE_MANUAL;
    const feecateg = Number(item.feecateg) || 0;
    values[sector][mode][feecateg] = Number(item.collectedamount ?? 0) || 0;
    if (item.accomplishno) accomplishNos[`${sector}|${mode}|${feecateg}`] = String(item.accomplishno);
  }
  return {
    month,
    feeno: rec.feeno && String(rec.feeno) !== EMPTY_GUID ? String(rec.feeno) : null,
    accomplishNos,
    values,
    baseline: snapshot(values),
  };
}

const monthTotal = (v: SectorValues) =>
  FEE_SECTORS.reduce(
    (a, s) => a + MODES.reduce((b, m) => b + sumAmounts(v[s.key][m.code]), 0),
    0,
  );

const sectorTotal = (v: SectorValues, sector: FireCodeSectorKey) =>
  MODES.reduce((b, m) => b + sumAmounts(v[sector][m.code]), 0);

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;


/* -------------------------------------------------------------------------- */
/*  Body                                                                       */
/* -------------------------------------------------------------------------- */

export function FireCodeFeesYearEditorBody({
  station,
  year: initialYear,
  readOnly,
  onSaved,
  onCancel,
  onYearChange,
}: {
  station: FeeEditorStation;
  year: number;
  readOnly?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  onYearChange?: (year: number) => void;
}) {
  const { user, systemAccess } = useAuth();
  const { categories } = useFeeCategories();
  const YEARS = React.useMemo(buildYears, []);

  const [year, setYear] = React.useState(initialYear);
  React.useEffect(() => setYear(initialYear), [initialYear]);

  const [months, setMonths] = React.useState<MonthState[]>(() =>
    MONTHS.map((m) => freshMonth(m.value)),
  );
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [reloadNonce, setReloadNonce] = React.useState(0);
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
  const [expandedSector, setExpandedSector] = React.useState<Record<string, boolean>>({});
  const [visibleSectors, setVisibleSectors] = React.useState<Record<FireCodeSectorKey, boolean>>(
    () => Object.fromEntries(FEE_SECTORS.map((s) => [s.key, true])) as Record<FireCodeSectorKey, boolean>,
  );

  /* Load every month of the year for this station ------------------------- */
  React.useEffect(() => {
    if (!station.stationno) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await firecodefeesAPI.getLedger(
        {
          parameters: {
            Searchkey: "",
            Reportyear: year,
            Reportmonth: MONTHS.map((m) => m.value),
            Interval: 2,
            Dateaccomplish: monthKey(year, 1),
            Provinces: [
              { Provinceno: station.provinceno || EMPTY_GUID, Stationnos: [station.stationno] },
            ],
          },
          pagenumber: 1,
          pagesize: 5,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data, error } = unwrap<FSISStationFeeDetailModel[]>(resp);
      const next = MONTHS.map((m) => freshMonth(m.value));
      if (!ok) {
        toast.error(error || "Unable to load the Fire Code Fees collection for this year.");
      } else {
        const st = (Array.isArray(data) ? data : []).find(
          (s) => String(s.stationno) === String(station.stationno),
        );
        for (const rec of Array.isArray(st?.feedetaillist) ? st!.feedetaillist : []) {
          const iso = String(rec?.dateaccomplish ?? "").slice(0, 10);
          if (!iso || iso.startsWith("1900") || Number(iso.slice(0, 4)) !== year) continue;
          const m = Number(iso.slice(5, 7)) || 0;
          if (m >= 1 && m <= 12) next[m - 1] = fromRecord(m, rec);
        }
      }
      setMonths(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [station.stationno, station.provinceno, year, reloadNonce]);

  /* Revision requests ----------------------------------------------------- */
  const [revisionRequests, setRevisionRequests] = React.useState<FSISEditRequestModel[]>([]);
  React.useEffect(() => {
    if (!station.stationno) return;
    let cancelled = false;
    (async () => {
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno: station.stationno,
          reportyear: year,
          reportmonth: 0,
          provinceno: station.provinceno || EMPTY_GUID,
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
  }, [station.stationno, station.provinceno, year, reloadNonce]);

  const pendingFor = React.useCallback(
    (m: MonthState) =>
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "PENDING") return false;
        if (m.feeno && String(r.referencekey) === m.feeno) return true;
        if (r.dateinspected) return String(r.dateinspected).slice(0, 10) === monthKey(year, m.month);
        return Number(r.reportmonth) === m.month && Number(r.reportyear) === year;
      }) ?? null,
    [revisionRequests, year],
  );

  /** Approved revision request that unlocks a month. */
  const approvedFor = React.useCallback(
    (m: MonthState) =>
      revisionRequests.find((r) => {
        if (r.statuscode?.toUpperCase() !== "APPROVED") return false;
        if (m.feeno && String(r.referencekey) === m.feeno) return true;
        if (r.dateinspected) return String(r.dateinspected).slice(0, 10) === monthKey(year, m.month);
        return Number(r.reportmonth) === m.month && Number(r.reportyear) === year;
      }) ?? null,
    [revisionRequests, year],
  );

  /** Per-month lock resolution — mirrors the compliance editor rules. */
  const lockInfo = React.useCallback(
    (m: MonthState) => {
      const unlockedByApproval = !!approvedFor(m);
      const request = pendingFor(m);
      const pending = !unlockedByApproval && !!request;
      const past = IS_PAST_DATE_LOCK_ENABLED && isPastMonth(year, m.month);
      const locked = readOnly || (!unlockedByApproval && (past || pending));
      const needsRequest = !readOnly && past && !unlockedByApproval && !pending;
      return { locked, pending, past, unlockedByApproval, request, needsRequest };
    },
    [approvedFor, pendingFor, readOnly, year],
  );

  const setAmount = React.useCallback(
    (month: number, sector: FireCodeSectorKey, mode: ModeCode, feecateg: number, raw: string) => {
      setMonths((prev) =>
        prev.map((m) =>
          m.month !== month
            ? m
            : {
                ...m,
                values: {
                  ...m.values,
                  [sector]: {
                    ...m.values[sector],
                    [mode]: { ...m.values[sector][mode], [feecateg]: toAmount(raw) },
                  },
                },
              },
        ),
      );
    },
    [],
  );

  const dirtyMonths = React.useMemo(
    () => months.filter((m) => snapshot(m.values) !== m.baseline),
    [months],
  );
  const yearTotal = React.useMemo(() => months.reduce((a, m) => a + monthTotal(m.values), 0), [months]);

  /* Save ------------------------------------------------------------------ */
  const save = async () => {
    if (readOnly) return;
    const encodedby = user?.memberno ? String(user.memberno) : "";
    if (!encodedby || encodedby === EMPTY_GUID) {
      toast.error("Your session is missing an encoder ID. Please sign in again.");
      return;
    }
    const updates = dirtyMonths.filter((m) => !lockInfo(m).locked);
    if (updates.length === 0) {
      toast.info("No unlocked changes to save.");
      return;
    }
    setSaving(true);
    try {
      const fsisfeeList: FSISFeeCollectionClass[] = updates.map((m) => {
        const fsisfeecollectionList: FSISFeeCollectionClassDTO[] = [];
        for (const s of FEE_SECTORS) {
          if (!visibleSectors[s.key]) continue;
          for (const mode of MODES) {
            const amounts = m.values[s.key][mode.code];
            for (const c of categories) {
              fsisfeecollectionList.push({
                accomplishno: m.accomplishNos[`${s.key}|${mode.code}|${c.detno}`] || EMPTY_GUID,
                fsicmode: mode.code,
                feecateg: c.detno,
                collectedamount: amounts[c.detno] ?? 0,
                sectorno: s.code,
              });
            }
          }
        }
        return {
          feeno: m.feeno || EMPTY_GUID,
          dateaccomplish: lastDayOfMonthISO(year, m.month),
          isaccomplished: true,
          remarks: "",
          fsisfeecollectionList,
        };
      });
      const resp = await firecodefeesAPI.create({
        stationno: station.stationno,
        encodedby: encodedby,
        fsisfeeList,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to save the Fire Code Fees collection.");
        return;
      }
      toast.success(`Fire Code Fees collection saved for ${updates.length} month${updates.length > 1 ? "s" : ""}.`);
      onSaved?.();
      setReloadNonce((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  /* Revision dialogs ------------------------------------------------------ */
  const [revisionMonth, setRevisionMonth] = React.useState<MonthState | null>(null);
  const [cancelRequestId, setCancelRequestId] = React.useState<string | null>(null);
  const [deleteRequestId, setDeleteRequestId] = React.useState<string | null>(null);

  const anyEditable = !readOnly && months.some((m) => !lockInfo(m).locked);

  /* ----------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* 1. Reporting year */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarIcon className="h-4 w-4" /> Reporting Year
            </h2>
            <p className="text-[11px] text-muted-foreground">
              All twelve months of the selected year are shown below.
            </p>
          </div>
          <div className="w-full space-y-1.5 sm:w-40">
            <Label className="text-xs font-medium text-muted-foreground">Year</Label>
            <Select
              value={String(year)}
              onValueChange={(v) => {
                const y = Number(v);
                setYear(y);
                setExpanded({});
                onYearChange?.(y);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
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
        </div>
        {!readOnly && <PastDatesLockedNote />}
      </Card>

      {/* 2. Station information */}
      <StationInfoCard
        stationName={station.stationname}
        unitCode={station.stationcode || ""}
        logoUrl={null}
        cityName=""
        provinceName={station.provincename || ""}
      />

      {/* 3. Sector visibility */}
      {!readOnly && (
        <Card className="space-y-3 border-border/60 bg-card p-5 shadow-soft">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Coins className="h-4 w-4" /> Establishment Sectors
          </h2>
          <div className="flex flex-wrap gap-4">
            {FEE_SECTORS.map((s) => (
              <label
                key={s.key}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs font-semibold"
              >
                <Checkbox
                  checked={visibleSectors[s.key]}
                  onCheckedChange={(v) => setVisibleSectors((p) => ({ ...p, [s.key]: Boolean(v) }))}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Months */}
      <Card className="border-border/60 bg-card shadow-soft">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Coins className="h-4 w-4" /> Monthly Collection · {year}
          </h2>
          <span className="text-xs font-bold tabular-nums text-primary">{peso(yearTotal)}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading collection records…
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {months.map((m) => {
              const info = lockInfo(m);
              const open = !!expanded[m.month];
              const dirty = snapshot(m.values) !== m.baseline;
              const name = MONTHS.find((x) => x.value === m.month)?.name ?? String(m.month);
              const ToggleIcon = open ? ChevronUp : ChevronDown;
              return (
                <div key={m.month} className={cn(dirty && "bg-primary/[0.03]")}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => setExpanded((p) => ({ ...p, [m.month]: !p[m.month] }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpanded((p) => ({ ...p, [m.month]: !p[m.month] }));
                      }
                    }}
                    className="flex cursor-pointer select-none flex-wrap items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-[9rem] items-center gap-2">
                      {info.locked ? (
                        <Lock className="h-3.5 w-3.5 text-warning" />
                      ) : (
                        <LockOpen className="h-3.5 w-3.5 text-success" />
                      )}
                      <span className="text-sm font-semibold">{name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                      {m.feeno ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Encoded</span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">No record</span>
                      )}
                      {info.unlockedByApproval && (
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">Revision approved</span>
                      )}
                      {info.pending && (
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">Revision pending</span>
                      )}
                      {dirty && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Unsaved</span>}
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <div className="hidden gap-3 text-[11px] tabular-nums text-muted-foreground md:flex">
                        {FEE_SECTORS.map((s) => (
                          <span key={s.key}>
                            {s.label} <span className="font-semibold text-foreground">{peso(sectorTotal(m.values, s.key))}</span>
                          </span>
                        ))}
                      </div>
                      <span className="text-sm font-bold tabular-nums text-primary">{peso(monthTotal(m.values))}</span>
                      <ToggleIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-4 border-t border-border/40 bg-muted/10 px-5 py-4">
                      {info.locked && !readOnly && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                          <span className="flex items-start gap-2">
                            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            {info.pending
                              ? "A revision request for this month is pending approval. Fields stay locked until it is approved."
                              : "This month has already passed and is locked. Submit a revision request to enable editing."}
                          </span>
                          <span className="flex gap-2">
                            {info.needsRequest && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setRevisionMonth(m)}
                                className="gap-1.5 bg-gradient-primary text-primary-foreground"
                              >
                                <FilePen className="h-3.5 w-3.5" /> Request Revision
                              </Button>
                            )}
                            {info.pending && info.request && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => setCancelRequestId(info.request!.requestno)}
                                >
                                  <Ban className="h-3.5 w-3.5" /> Cancel Request
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1.5"
                                  onClick={() => setDeleteRequestId(info.request!.requestno)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Delete Request
                                </Button>
                              </>
                            )}
                          </span>
                        </div>
                      )}

                      {FEE_SECTORS.filter((s) => readOnly || visibleSectors[s.key]).map((s) => {
                        const sKey = `${m.month}|${s.key}`;
                        const sOpen = expandedSector[sKey] ?? s.key === "bplo";
                        const SIcon = sOpen ? ChevronUp : ChevronDown;
                        return (
                          <div key={s.key} className="space-y-2">
                            <div
                              role="button"
                              tabIndex={0}
                              aria-expanded={sOpen}
                              onClick={() => setExpandedSector((p) => ({ ...p, [sKey]: !sOpen }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setExpandedSector((p) => ({ ...p, [sKey]: !sOpen }));
                                }
                              }}
                              className="flex cursor-pointer select-none items-center justify-between rounded-lg px-1 py-1 hover:bg-muted/40"
                            >
                              <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">
                                {s.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold tabular-nums">
                                  {peso(sectorTotal(m.values, s.key))}
                                </span>
                                <SIcon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                            {sOpen && (
                              <SectorPanel
                                sectorTitle={`${name}-${s.title}`}
                                categories={categories}
                                values={m.values[s.key]}
                                locked={info.locked}
                                onChange={(mode, key, raw) => setAmount(m.month, s.key, mode, key, raw)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {readOnly && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> View only
          </span>
        )}
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
        )}
        {!readOnly && (
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !anyEditable || dirtyMonths.length === 0}
            className="bg-gradient-primary text-primary-foreground shadow-elegant"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {saving ? "Saving…" : `Save Changes${dirtyMonths.length ? ` (${dirtyMonths.length})` : ""}`}
          </Button>
        )}
      </div>

      {revisionMonth && (
        <RevisionRequestDialog
          open={!!revisionMonth}
          onOpenChange={(o) => !o && setRevisionMonth(null)}
          module="monitoring"
          station={{
            stationno: station.stationno,
            stationcode: station.stationcode ?? "",
            stationname: station.stationname,
            provinceno: station.provinceno ?? "",
            provincename: station.provincename ?? "",
            cityname: "",
          }}
          year={year}
          month={revisionMonth.month}
          referencekey={revisionMonth.feeno || EMPTY_GUID}
          dateinspected={monthKey(year, revisionMonth.month)}
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
            stationno: station.stationno || EMPTY_GUID,
            requesttype: "COMPLIANCE",
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal wrapper                                                              */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesYearEditorModal({
  open,
  onOpenChange,
  station,
  year,
  readOnly,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  station: FeeEditorStation | null;
  year: number;
  readOnly?: boolean;
  onSaved?: () => void;
}) {
  const [viewYear, setViewYear] = React.useState(year);
  React.useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] min-h-0 w-[calc(100vw-2rem)] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {readOnly ? "View" : "Edit"} Fire Code Fees Collection · {viewYear}
              </DialogTitle>
              <DialogDescription>
                {station?.stationname || "Station"} — monthly collection per establishment sector.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {open && station ? (
            <FireCodeFeesYearEditorBody
              station={station}
              year={year}
              readOnly={readOnly}
              onYearChange={setViewYear}
              onSaved={onSaved}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
