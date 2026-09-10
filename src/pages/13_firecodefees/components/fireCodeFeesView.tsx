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
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

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

import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import type { FSISFeeCollectionDetailModel } from "@/types/firecodefeesType";
import {
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  SECTOR_BY_CODE,
  flattenFeeAccomItems,
  peso,
  type FireCodeSectorKey,
} from "../feeColumns";
import { useFeeCategories } from "./feeCategories";
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
  const YEARS = React.useMemo(buildYears, []);

  const [year, setYear] = React.useState(initialYear);
  React.useEffect(() => setYear(initialYear), [initialYear]);

  const [months, setMonths] = React.useState<MonthView[]>(() =>
    MONTHS.map((m) => freshMonth(m.value)),
  );
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});

  /* Whole year from the Detail endpoint --------------------------------- */
  React.useEffect(() => {
    if (!station.stationno) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await firecodefeesAPI.getDetail(
        { Stationno: station.stationno, Reportyear: year },
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
  }, [station.stationno, year]);

  /* Revision requests — badges only (read-only screen) ------------------ */
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
  }, [station.stationno, station.provinceno, year]);

  const matches = React.useCallback(
    (r: FSISEditRequestModel, m: MonthView) => {
      if (m.feeno && String(r.referencekey) === m.feeno) return true;
      if (r.dateinspected) return String(r.dateinspected).slice(0, 10) === monthKey(year, m.month);
      return Number(r.reportmonth) === m.month && Number(r.reportyear) === year;
    },
    [year],
  );

  /** Same lock resolution as the editor — surfaced as read-only badges. */
  const lockInfo = React.useCallback(
    (m: MonthView) => {
      const unlockedByApproval = revisionRequests.some(
        (r) => r.statuscode?.toUpperCase() === "APPROVED" && matches(r, m),
      );
      const pending =
        !unlockedByApproval &&
        revisionRequests.some((r) => r.statuscode?.toUpperCase() === "PENDING" && matches(r, m));
      const past = IS_PAST_DATE_LOCK_ENABLED && isPastMonth(year, m.month);
      const locked = !unlockedByApproval && (past || pending);
      return { locked, pending, past, unlockedByApproval };
    },
    [matches, revisionRequests, year],
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
                      <FeeMatrixTable categories={categories} values={m.values} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
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
      </div>
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
      </DialogContent>
    </Dialog>
  );
}
