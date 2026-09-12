import * as React from "react";
import {
  CalendarIcon,
  ChevronDown,
  ChevronUp,
  Coins,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
} from "lucide-react";
import { canShowEditAction } from "@/lib/permissions";

import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { buildYears, cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { EMPTY_GUID, MONTHS } from "@/lib/fsims-constants";
import { isPastDateLockEnabled } from "@/lib/past-date-lock";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { ModalFooterLayout, ModalFooterPortal } from "@/components/shared/ModalFooterPortal";

import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import {
  deriveRevisionLock,
  useRevisionLedger,
} from "@/pages/06_target-reference/revision/useRevisionRequests";
import type { FSISFeeCollectionDetailModel } from "@/types/firecodefeesType";
import {
  FEE_COLUMNS,
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  SECTOR_BY_CODE,
  flattenFeeAccomItems,
  peso,
  type FireCodeSectorKey,
} from "../feeColumns";
import { useFeeCategories } from "./feeCategories";
import { FeeTypeMultiSelect, useFeeTypes } from "./fireCodeFeesFeeTypeFilter";
import {
  FeeMatrixTable,
  MODES,
  emptyValues,
  isPastMonth,
  sumAmounts,
  type FeeEditorStation,
  type ModeCode,
  type SectorValues,
} from "./feeShared";

/* -------------------------------------------------------------------------- */
/*  Month model                                                                */
/* -------------------------------------------------------------------------- */

interface MonthView {
  month: number;
  feeno: string | null;
  values: SectorValues;
}

const freshMonth = (month: number): MonthView => ({
  month,
  feeno: null,
  values: emptyValues(),
});

function fromRecord(month: number, rec: FSISFeeCollectionDetailModel): MonthView {
  const values = emptyValues();
  for (const item of flattenFeeAccomItems(rec)) {
    const sector = SECTOR_BY_CODE.get(Number(item.sectorno));
    if (!sector) continue;
    const mode: ModeCode =
      Number(item.fsicmode) === FIRE_CODE_MODE_FSIS ? FIRE_CODE_MODE_FSIS : FIRE_CODE_MODE_MANUAL;
    const feecateg = Number(item.feecateg) || 0;
    values[sector][mode][feecateg] = Number(item.collectedamount ?? 0) || 0;
  }
  return {
    month,
    feeno: rec.feeno && String(rec.feeno) !== EMPTY_GUID ? String(rec.feeno) : null,
    values,
  };
}

/** Pulls every collection record out of the Detail endpoint payload. */
function pickRecords(data: unknown): FSISFeeCollectionDetailModel[] {
  const out: FSISFeeCollectionDetailModel[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    const obj = value as Record<string, unknown>;
    const isRecord =
      !!obj.feeno &&
      (Array.isArray(obj.sectorlist) ||
        Array.isArray(obj.accomfeelist) ||
        obj.dateaccomplish !== undefined);
    if (isRecord) {
      out.push(obj as unknown as FSISFeeCollectionDetailModel);
      return;
    }
    if (Array.isArray(obj.feedetaillist)) (obj.feedetaillist as unknown[]).forEach(walk);
    if (Array.isArray(obj.data)) (obj.data as unknown[]).forEach(walk);
    else if (obj.data && typeof obj.data === "object") walk(obj.data);
  };
  walk(data);
  return out;
}

const monthTotal = (v: SectorValues) =>
  FEE_SECTORS.reduce((a, s) => a + MODES.reduce((b, m) => b + sumAmounts(v[s.key][m.code]), 0), 0);

const sectorTotal = (v: SectorValues, sector: FireCodeSectorKey) =>
  MODES.reduce((b, m) => b + sumAmounts(v[sector][m.code]), 0);

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}-01`;

/* -------------------------------------------------------------------------- */
/*  Body                                                                       */
/* -------------------------------------------------------------------------- */

export function FireCodeFeesYearViewBody({
  station,
  year: initialYear,
  onClose,
  onYearChange,
  onEdit,
}: {
  station: FeeEditorStation;
  year: number;
  onClose?: () => void;
  onYearChange?: (year: number) => void;
  /** Opens the editor for the year currently shown in this view. */
  onEdit?: (year: number) => void;
}) {
  const { user, systemAccess } = useAuth();
  const canEdit = canShowEditAction(user, systemAccess);
  const { categories } = useFeeCategories();
  const { options: feeTypeOptions, loading: feeTypesLoading } = useFeeTypes();
  const [feeTypes, setFeeTypes] = React.useState<string[]>([]);
  const displayCategories = React.useMemo(
    () =>
      categories.map((c, i) => ({
        ...c,
        code: FEE_COLUMNS[i]?.code || c.code,
        groupLabel: FEE_COLUMNS[i]?.groupLabel || c.groupLabel,
      })),
    [categories],
  );
  const filteredCategories = React.useMemo(() => {
    if (feeTypes.length === 0) return displayCategories;
    const wanted = feeTypes.map((c) => c.toUpperCase());
    const selectedNames = feeTypeOptions
      .filter((o) => feeTypes.includes(o.code))
      .map((o) => o.name.toUpperCase())
      .filter(Boolean);
    const norm = (text: string) => String(text ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    const matches = (text: string) => {
      const t = norm(text);
      if (!t) return false;
      return (
        wanted.some((c) => c && (t === c || t.includes(c))) ||
        selectedNames.some((n) => n && (t === n || t.includes(n) || n.includes(t)))
      );
    };
    const filtered = displayCategories.filter(
      (c) => matches(c.code) || matches(c.label) || matches(c.groupLabel),
    );
    return filtered.length ? filtered : [];
  }, [displayCategories, feeTypes, feeTypeOptions]);

  const selectedFeeParentNos = React.useMemo(() => {
    if (!feeTypeOptions.length || feeTypes.length === 0) return [];
    return feeTypes
      .map((code) => Number(feeTypeOptions.find((option) => option.code === code)?.detno ?? 0))
      .filter((id) => Number.isFinite(id) && id > 0);
  }, [feeTypeOptions, feeTypes]);
  const YEARS = React.useMemo(buildYears, []);

  const [year, setYear] = React.useState(initialYear);
  React.useEffect(() => setYear(initialYear), [initialYear]);

  const [months, setMonths] = React.useState<MonthView[]>(() =>
    MONTHS.map((m) => freshMonth(m.value)),
  );
  const [loading, setLoading] = React.useState(false);
  const [showAllMonthFees, setShowAllMonthFees] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>(() =>
    Object.fromEntries(MONTHS.map((m) => [m.value, false])),
  );

  /* Whole year from the Detail endpoint --------------------------------- */
  React.useEffect(() => {
    if (!station.stationno) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await firecodefeesAPI.getDetail(
        { Stationno: station.stationno, Reportyear: year, Feeparentno: selectedFeeParentNos },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data, error } = unwrap<unknown>(resp);
      const next = MONTHS.map((m) => freshMonth(m.value));
      if (!ok) {
        toast.error(error || "Unable to load the Fire Code Fees collection for this year.");
      } else {
        for (const rec of pickRecords(data)) {
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
  }, [station.stationno, year, selectedFeeParentNos]);

  /* Revision requests — badges only (read-only screen) ------------------ */
  const revisionRequests = useRevisionLedger({
    module: "fire-code-fees",
    stationno: station.stationno,
    reportyear: year,
    provinceno: station.provinceno,
  });

  /** Same lock resolution as the editor — surfaced as read-only badges. */
  const lockInfo = React.useCallback(
    (m: MonthView) => {
      const past = isPastDateLockEnabled("fire-code-fees") && isPastMonth(year, m.month);
      const { unlockedByApproval, hasPendingRevision, fieldsLocked } = deriveRevisionLock({
        requests: revisionRequests,
        referencekey: m.feeno || null,
        dateKey: monthKey(year, m.month),
        report: { year, month: m.month },
        isPast: past,
      });
      return { locked: fieldsLocked, pending: hasPendingRevision, past, unlockedByApproval };
    },
    [revisionRequests, year],
  );

  const yearTotal = React.useMemo(
    () => months.reduce((a, m) => a + monthTotal(m.values), 0),
    [months],
  );

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
              All twelve months of the selected year, read only.
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
      </Card>

      {/* 2. Station information */}
      <StationInfoCard
        stationName={station.stationname}
        unitCode={station.stationcode || ""}
        logoUrl={null}
        cityName=""
        provinceName={station.provincename || ""}
      />

      {/* 3. Months */}
      <Card className="border-border/60 bg-card shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Coins className="h-4 w-4" /> Monthly Collection · {year}
            </h2>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-extrabold tabular-nums text-primary">
              {peso(yearTotal)}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <FeeTypeMultiSelect
              options={feeTypeOptions}
              loading={feeTypesLoading}
              value={feeTypes}
              onChange={setFeeTypes}
            />
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {showAllMonthFees ? "Show" : "Hide"}
              </span>
              <Switch
                checked={showAllMonthFees}
                onCheckedChange={(checked) => {
                  const next = Boolean(checked);
                  setShowAllMonthFees(next);
                  setExpanded((prev) => {
                    const updated: Record<number, boolean> = { ...prev };
                    months.forEach((m) => {
                      updated[m.month] = next;
                    });
                    return updated;
                  });
                }}
                aria-label="Show or hide all monthly fee details"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {showAllMonthFees ? "On" : "Off"}
              </span>
            </div>
          </div>
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
              const name = MONTHS.find((x) => x.value === m.month)?.name ?? String(m.month);
              const ToggleIcon = open ? ChevronUp : ChevronDown;
              return (
                <div key={m.month}>
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
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                          Encoded
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                          No record
                        </span>
                      )}
                      {info.unlockedByApproval && (
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">
                          Revision approved
                        </span>
                      )}
                      {info.pending && (
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 text-warning">
                          Revision pending
                        </span>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                      <div className="hidden md:flex md:items-end">
                        {FEE_SECTORS.map((s) => (
                          <div key={s.key} className="w-28 shrink-0 px-2 text-right">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {s.label}
                            </div>
                            <div className="text-[11px] font-semibold tabular-nums text-foreground">
                              {peso(sectorTotal(m.values, s.key))}
                            </div>
                          </div>
                        ))}
                        <div className="w-32 shrink-0 border-l border-border/60 px-2 text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Total
                          </div>
                          <div className="text-sm font-bold tabular-nums text-primary">
                            {peso(monthTotal(m.values))}
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-primary md:hidden">
                        {peso(monthTotal(m.values))}
                      </span>
                      <ToggleIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-4 border-t border-border/40 bg-muted/10 px-5 py-4">
                      {info.locked && (
                        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                          <span>
                            {info.pending
                              ? "A revision request for this month is pending approval."
                              : "This month has already passed and is locked."}
                          </span>
                        </div>
                      )}
                      <FeeMatrixTable categories={filteredCategories} values={m.values} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <ModalFooterPortal>
        {onEdit && canEdit && (
          <Button type="button" variant="outline" className="gap-2" onClick={() => onEdit(year)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )}
        {onClose && (
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        )}
      </ModalFooterPortal>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal wrapper                                                              */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesYearViewModal({
  open,
  onOpenChange,
  station,
  year,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  station: FeeEditorStation | null;
  year: number;
  /** Opens the Fire Code Fees editor for the station and year being viewed. */
  onEdit?: (station: FeeEditorStation, year: number) => void;
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
        className="flex max-h-[92vh] min-h-0 w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:rounded-xl xl:w-[calc(100vw-4rem)] xl:max-w-[120rem]"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                View Fire Code Fees Collection · {viewYear}
              </DialogTitle>
              <DialogDescription>
                {station?.stationname || "Station"} — monthly collection per fee category and
                establishment sector.
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                View only — values are displayed as recorded and cannot be modified here.
              </p>
            </div>
          </div>
        </DialogHeader>

        <ModalFooterLayout>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {open && station ? (
              <FireCodeFeesYearViewBody
                station={station}
                year={year}
                onYearChange={setViewYear}
                onClose={() => onOpenChange(false)}
                onEdit={
                  onEdit
                    ? (y) => {
                        onOpenChange(false);
                        onEdit(station, y);
                      }
                    : undefined
                }
              />
            ) : null}
          </div>
        </ModalFooterLayout>
      </DialogContent>
    </Dialog>
  );
}
