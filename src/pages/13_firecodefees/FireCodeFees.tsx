import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AddButton from "@/components/add-button";
import {
  Coins,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Plus,
  Eye,
} from "lucide-react";

import { toast } from "@/lib/toast";
import { unwrap } from "@/lib/api-envelope";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { canManageTargetAndCompliance, canShowEditAction } from "@/lib/permissions";
import { MONTHS } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import PaginationControls from "@/components/pagination";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import {
  ScopedLocationMultiFilterPair,
  useScopedLocationMulti,
} from "@/components/shared/ScopedLocationMultiFilterPair";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolveModuleMonths,
} from "@/components/shared/ModuleFilterBar";

import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import type {
  FSISFeeCollectionDetailModel,
  FSISFeeCollectionParamClass,
  FSISStationFeeDetailModel,
} from "@/types/firecodefeesType";
import {
  FEE_CATEGS,
  FEE_COLUMNS,
  FEE_GROUPS,
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIC,
  SECTOR_BY_CODE,
  peso,
  type FeeAmounts,
  type FireCodeFeeLedgerRow,
  type FireCodeSectorKey,
} from "./feeColumns";
import { exportFireCodeFeesLedgerWorkbook } from "./components/fireCodeFeesLedgerExport";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import SecureDeleteDialog from "@/components/secure-delete-dialog";
import FireCodeFeesFormModal from "./components/fireCodeFeesNew";
import FireCodeFeesYearEditorModal, {
  type FeeEditorStation,
} from "./components/fireCodeFeesEdit";

/** Station + period context handed to the entry form when editing a ledger card. */
interface FeeFormTarget {
  year?: number;
  month?: number;
  station?: {
    stationno: string;
    stationname: string;
    provinceno?: string;
    provincename?: string;
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

type Granularity = "month" | "quarter" | "semester" | "annual";

const emptyAmounts = (): FeeAmounts =>
  Object.fromEntries(FEE_CATEGS.map((categ) => [categ, 0])) as FeeAmounts;

interface SectorBucket {
  manual: FeeAmounts;
  fsic: FeeAmounts;
}

interface FeeLine {
  key: string;
  label: string;
  sectors: Record<FireCodeSectorKey, SectorBucket>;
}

const emptyLine = (key: string, label: string): FeeLine => ({
  key,
  label,
  sectors: Object.fromEntries(
    FEE_SECTORS.map((s) => [s.key, { manual: emptyAmounts(), fsic: emptyAmounts() }]),
  ) as Record<FireCodeSectorKey, SectorBucket>,
});

const monthLabel = (ym: string) => {
  const m = Number(ym.slice(5, 7)) || 0;
  const name = MONTHS.find((x) => x.value === m)?.name ?? ym.slice(5, 7);
  return `${name} ${ym.slice(0, 4)}`;
};

/** Sums every collection record of a station into one line per period bucket. */
function buildFeeLines(
  records: FSISFeeCollectionDetailModel[] | undefined,
  groupBy: Granularity,
): FeeLine[] {
  const byKey = new Map<string, FeeLine>();

  for (const rec of Array.isArray(records) ? records : []) {
    const iso = String(rec?.Dateaccomplish ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;

    const year = iso.slice(0, 4);
    const month = Number(iso.slice(5, 7)) || 1;

    const key =
      groupBy === "month"
        ? iso.slice(0, 7)
        : groupBy === "quarter"
          ? `${year}-q${Math.ceil(month / 3)}`
          : groupBy === "semester"
            ? `${year}-s${month <= 6 ? 1 : 2}`
            : year;

    let line = byKey.get(key);
    if (!line) {
      const label =
        groupBy === "month"
          ? monthLabel(iso)
          : groupBy === "quarter"
            ? `Q${Math.ceil(month / 3)} ${year}`
            : groupBy === "semester"
              ? `${month <= 6 ? "1st" : "2nd"} Semester ${year}`
              : `Annual ${year}`;
      line = emptyLine(key, label);
      byKey.set(key, line);
    }

    const items = Array.isArray(rec?.Accomfeelist) ? rec.Accomfeelist : [];
    for (const item of items) {
      const sector = SECTOR_BY_CODE.get(Number(item.Sectorno));
      if (!sector) continue;
      const bucket =
        num(item.Fsicmode) === FIRE_CODE_MODE_FSIC
          ? line.sectors[sector].fsic
          : line.sectors[sector].manual;
      const categ = Number(item.Feecateg) || 0;
      bucket[categ] = (bucket[categ] ?? 0) + num(item.Collectedamount);
    }
  }

  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, l]) => l);
}

function sumAmounts(a: FeeAmounts) {
  return FEE_CATEGS.reduce((acc, categ) => acc + (a[categ] ?? 0), 0);
}

/** Sector column totals across every line (MANUAL, FSIC and combined). */
function totalsForSector(lines: FeeLine[], sector: FireCodeSectorKey) {
  const manual = emptyAmounts();
  const fsic = emptyAmounts();
  const combined = emptyAmounts();
  for (const l of lines) {
    for (const categ of FEE_CATEGS) {
      const m = l.sectors[sector].manual[categ] ?? 0;
      const f = l.sectors[sector].fsic[categ] ?? 0;
      manual[categ] += m;
      fsic[categ] += f;
      combined[categ] += m + f;
    }
  }
  return { manual, fsic, combined };
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function FireCodeFeesPage() {
  const { user, systemAccess } = useAuth();
  const navigate = useNavigate();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  // Edit / Delete require Personnel at station types 28–31 (or Super Admin)
  // and must stay hidden for the restricted role/station-type combinations.
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess) && canShowEditAction(user, systemAccess),
    [user, systemAccess],
  );

  const YEARS = React.useMemo(buildYears, []);

  // Fire Code Fees reports only from Monthly upward — there is no daily form.
  const {
    state: filterState,
    set: setFilterState,
    resetState: resetFilterState,
  } = useModuleFilterState({ interval: "MONTHLY", months: [] });

  const year = filterState.year;
  const selectedMonths = React.useMemo(() => resolveModuleMonths(filterState), [filterState]);
  const monthsKey = selectedMonths.join(",");
  const month = String(selectedMonths[0] ?? 1);

  /** Backend interval codes: 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual. */
  const intervalCode = React.useMemo(() => {
    switch (filterState.interval) {
      case "MONTHLY":
        return 2;
      case "QUARTERLY":
        return 3;
      case "SEMESTER":
        return 4;
      default:
        return 5;
    }
  }, [filterState.interval]);

  const granularity: Granularity = React.useMemo(() => {
    switch (filterState.interval) {
      case "QUARTERLY":
        return "quarter";
      case "SEMESTER":
        return "semester";
      case "ANNUAL":
        return "annual";
      default:
        return "month";
    }
  }, [filterState.interval]);

  const periodLabel = React.useMemo(() => {
    const name = (m: number) => MONTHS.find((x) => x.value === m)?.name ?? String(m);
    switch (filterState.interval) {
      case "ANNUAL":
        return `Annual ${year}`;
      case "QUARTERLY":
        return filterState.quarter === "all"
          ? `All Quarters ${year}`
          : `${filterState.quarter.toUpperCase()} ${year}`;
      case "SEMESTER":
        return filterState.semester === "all"
          ? `All Semesters ${year}`
          : `${filterState.semester === "s2" ? "2nd" : "1st"} Semester ${year}`;
      default:
        return selectedMonths.length === 12
          ? `All Months ${year}`
          : `${selectedMonths.map(name).join(", ")} ${year}`;
    }
  }, [filterState.interval, filterState.quarter, filterState.semester, selectedMonths, year]);

  const locationSel = useScopedLocationMulti(scope);
  const { paramsKey: locationParamsKey } = locationSel;
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const [rows, setRows] = React.useState<FireCodeFeeLedgerRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [matrixRow, setMatrixRow] = React.useState<FireCodeFeeLedgerRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formTarget, setFormTarget] = React.useState<FeeFormTarget>({});
  const [reloadKey, setReloadKey] = React.useState(0);

  // Year editor (View / Edit) for one station.
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorReadOnly, setEditorReadOnly] = React.useState(true);
  const [editorStation, setEditorStation] = React.useState<FeeEditorStation | null>(null);
  const [editorYear, setEditorYear] = React.useState<number>(Number(filterState.year));

  // Secure delete
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<FireCodeFeeLedgerRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const openAddForm = React.useCallback(() => {
    // New collections always start on today's date, never on the list filters.
    setFormTarget({});
    setFormOpen(true);
  }, []);

  const toEditorStation = (row: FireCodeFeeLedgerRow): FeeEditorStation => ({
    Stationno: row.Stationno,
    Stationcode: row.Stationcode,
    Stationname: row.Stationname,
    Provinceno: row.Provinceno,
    Provincename: row.Provincename,
  });

  const openEditor = React.useCallback((row: FireCodeFeeLedgerRow, readOnly: boolean) => {
    setEditorStation(toEditorStation(row));
    setEditorYear(Number(row.year));
    setEditorReadOnly(readOnly);
    setEditorOpen(true);
  }, []);

  const openStationMatrix = React.useCallback((row: FireCodeFeeLedgerRow) => {
    setMatrixRow(row);
    setMatrixOpen(true);
  }, []);

  const askDelete = React.useCallback((row: FireCodeFeeLedgerRow) => {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const resp = await firecodefeesAPI.delete({
        stationno: deleteTarget.Stationno,
        reportyear: Number(deleteTarget.year),
        reportmonth: Number(deleteTarget.month),
        deletedby: user?.memberno ?? "",
        roleno: Number(systemAccess?.roleno ?? 0) || 0,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to delete this Fire Code Fees collection record.");
        return;
      }
      toast.success("Fire Code Fees collection record deleted.");
      setDeleteOpen(false);
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  };

  React.useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const handleResetFilters = () => {
    resetFilterState();
    locationSel.reset();
    setPage(1);
  };

  const mapStation = React.useCallback(
    (station: FSISStationFeeDetailModel, monthSet: Set<number>): FireCodeFeeLedgerRow => {
      const list = Array.isArray(station.Feedetaillist) ? station.Feedetaillist : [];
      const records = list.filter((rec) => {
        const iso = String(rec?.Dateaccomplish ?? "").slice(0, 10);
        if (!iso || iso.startsWith("1900")) return false;
        const m = Number(iso.slice(5, 7)) || 0;
        return !!m && monthSet.has(m);
      });

      const lines = buildFeeLines(records, granularity);
      const sectorTotals = Object.fromEntries(
        FEE_SECTORS.map((s) => {
          const t = totalsForSector(lines, s.key);
          return [s.key, sumAmounts(t.combined)];
        }),
      ) as Record<FireCodeSectorKey, number>;

      let latest = "";
      for (const rec of records) {
        const iso = String(rec?.Dateaccomplish ?? "").slice(0, 10);
        if (iso > latest) latest = iso;
      }

      return {
        key: `${station.Stationno}|${year}|${monthsKey}`,
        Stationno: String(station.Stationno ?? ""),
        Stationcode: String(station.Stationcode ?? ""),
        Stationname: String(station.Stationname ?? ""),
        Provinceno: String(station.Provinceno ?? ""),
        Provincename: String(station.Provincename ?? ""),
        year: Number(year),
        month: Number(month),
        grandTotal: Object.values(sectorTotals).reduce((a, b) => a + b, 0),
        sectorTotals,
        lastupdated: latest,
        Feedetaillist: records,
      };
    },
    [granularity, month, monthsKey, year],
  );

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const Provinces = (
        JSON.parse(locationParamsKey) as { provinceno: string; stationnos: string[] }[]
      ).map<FSISFeeCollectionParamClass>((p) => ({
        Provinceno: p.provinceno,
        Stationnos: p.stationnos,
      }));
      const resp = await firecodefeesAPI.getLedger(
        {
          parameters: {
            Searchkey: "",
            Reportyear: Number(year),
            Reportmonth: [...selectedMonths],
            Interval: intervalCode,
            Dateaccomplish: `${year}-${String(month).padStart(2, "0")}-01`,
            Provinces,
          },
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true, signal: controller.signal },
      );

      const { ok, data, total: apiTotal, error, canceled } = unwrap<FSISStationFeeDetailModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load the Fire Code Fees collection ledger.");
        setRows([]);
        setTotal(0);
      } else {
        const monthSet = new Set(selectedMonths);
        const stations = Array.isArray(data) ? data : [];
        const mapped = stations.map((st) => mapStation(st, monthSet));
        setRows(mapped);
        setTotal(Number(apiTotal || mapped.length || 0));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, monthsKey, intervalCode, locationParamsKey, page, pageSize, reloadKey]);

  React.useEffect(() => {
    setPage(1);
  }, [year, monthsKey, intervalCode, locationParamsKey, pageSize, setPage]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await firecodefeesAPI.getLedger(
        {
          parameters: {
            Searchkey: "",
            Reportyear: Number(year),
            Reportmonth: [...selectedMonths],
            Interval: intervalCode,
            Dateaccomplish: `${year}-${String(month).padStart(2, "0")}-01`,
            Provinces: locationSel.provinceParams.map<FSISFeeCollectionParamClass>((p) => ({
              Provinceno: p.provinceno,
              Stationnos: p.stationnos,
            })),
          },
          pagenumber: 0,
          pagesize: 0,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );

      const { ok, data, error } = unwrap<FSISStationFeeDetailModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export the Fire Code Fees collection ledger.");
        return;
      }

      const monthSet = new Set(selectedMonths);
      const exportRows = (Array.isArray(data) ? data : []).map((st) => mapStation(st, monthSet));
      if (exportRows.length === 0) {
        toast.info("No Fire Code Fees collection records to export.");
        return;
      }

      await exportFireCodeFeesLedgerWorkbook({
        rows: exportRows,
        periodLabel,
        year: Number(year),
        signatory: {
          rank: user?.rankcode ?? user?.rankname ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: user?.designation ?? "",
        },
      });
      toast.success("Fire Code Fees collection ledger exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export the Fire Code Fees collection ledger.");
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Coins className="h-5 w-5 text-primary" />
            Fire Code Fees
          </h1>
          <p className="text-xs text-muted-foreground">
            Summary accomplishment report on Fire Code Fees collection.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting || rows.length === 0}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setMatrixRow(null);
              setMatrixOpen(true);
            }}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> Fire Code Fees Matrix
          </Button>

          {canManage && (
            <AddButton onClick={openAddForm} className="w-full justify-center sm:w-auto">
              <Plus className="h-4 w-4" /> Add Record
            </AddButton>
          )}
        </div>
      </div>

      <ModuleFilterBar
        years={YEARS}
        state={filterState}
        onChange={setFilterState}
        onReset={handleResetFilters}
        intervals={["MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
      >
        <ScopedLocationMultiFilterPair
          scope={scope}
          selection={locationSel}
          reportyear={Number(year)}
        />
      </ModuleFilterBar>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Fire Code Fees collection…
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No Fire Code Fees collection records for the selected period.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rows.map((r) => (
            <FireCodeFeesLedgerCard
              key={r.key}
              row={r}
              groupBy={granularity}
              periodLabel={periodLabel}
              canManage={canManage}
              onView={() => openEditor(r, true)}
              onEdit={() => openEditor(r, false)}
              onDelete={() => askDelete(r)}
              onMatrix={() => openStationMatrix(r)}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border/60 pt-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <Dialog
        open={matrixOpen}
        onOpenChange={(o) => {
          setMatrixOpen(o);
          if (!o) setMatrixRow(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {matrixRow ? `${matrixRow.Stationname} — Fire Code Fees Matrix` : "Fire Code Fees Matrix"}
            </DialogTitle>
            <DialogDescription>
              {matrixRow
                ? `Sector totals per period for this station · ${periodLabel}`
                : "Sector totals for the current Fire Code Fees ledger period."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border/60">
            {matrixRow ? (
              <StationMatrixTable row={matrixRow} groupBy={granularity} />
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No collection records for the selected period.
              </div>
            ) : (
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 bg-background px-3 py-2 text-left font-semibold">
                      Station
                    </th>
                    {FEE_SECTORS.map((sector) => (
                      <th
                        key={sector.key}
                        className="bg-background px-3 py-2 text-right font-semibold"
                      >
                        {sector.title}
                      </th>
                    ))}
                    <th className="bg-background px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-t border-border/40">
                      <td className="sticky left-0 bg-background px-3 py-2 text-left font-medium">
                        {row.Stationname}
                      </td>
                      {FEE_SECTORS.map((sector) => (
                        <td key={`${row.key}-${sector.key}`} className="px-3 py-2 text-right">
                          {peso(row.sectorTotals[sector.key] ?? 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-semibold">{peso(row.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FireCodeFeesFormModal
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setFormTarget({});
        }}
        initialYear={formTarget.year}
        initialMonth={formTarget.month}
        initialStation={formTarget.station}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      <FireCodeFeesYearEditorModal
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setEditorStation(null);
        }}
        station={editorStation}
        year={editorYear}
        readOnly={editorReadOnly}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      <SecureDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => !deleting && setDeleteOpen(o)}
        title="Delete Fire Code Fees collection?"
        subject={
          deleteTarget ? (
            <>
              {deleteTarget.Stationname} — {periodLabel}
            </>
          ) : null
        }
        description="This deletes the Fire Code Fees collection records for the selected station and period. This action cannot be undone."
        confirmLabel="Delete"
        deleting={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

const headCell =
  "border-b border-border/40 head-soft backdrop-blur-sm px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap text-center";
const bodyCell =
  "border-b border-border/25 px-2.5 py-1.5 text-xs tabular-nums text-right text-foreground/90";
const footCell =
  "border-t border-border/50 total-row backdrop-blur-sm px-2.5 py-2 text-xs font-bold tabular-nums text-right";
const rowHeadCell =
  "sticky left-0 z-10 border-b border-border/25 border-r border-r-border/50 bg-inherit px-2.5 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap shadow-[2px_0_6px_-4px_hsl(var(--foreground)/0.35)]";
const strongRight = "border-r-2 border-r-border/80";

function Amount({ v }: { v: number }) {
  const value = num(v);
  return value ? (
    <span className="font-medium">{peso(value)}</span>
  ) : (
    <span className="text-muted-foreground">0.00</span>
  );
}

function ModeBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-primary">
      {label}
    </span>
  );
}

function SectionToggleHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-muted/40"
    >
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</h3>
      <ToggleIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
    </div>
  );
}

/** One sector table: MANUAL / FSIC rows per period bucket, with a totals footer. */
function SectorTable({
  lines,
  sector,
  periodHeading,
}: {
  lines: FeeLine[];
  sector: FireCodeSectorKey;
  periodHeading: string;
}) {
  const totals = React.useMemo(() => totalsForSector(lines, sector), [lines, sector]);

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 p-6 text-center text-xs text-muted-foreground">
        No collection entries for this period.
      </div>
    );
  }

  return (
    <div className="max-h-[26rem] overflow-auto rounded-xl border border-border/40 bg-card shadow-inner">
      <table className="w-full min-w-[2400px] border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className={`${headCell} sticky left-0 top-0 z-40 min-w-[9.5rem] border-r border-r-border/50 text-left shadow-[2px_0_6px_-4px_hsl(var(--foreground)/0.35)]`}
            >
              {periodHeading}
            </th>
            <th rowSpan={2} className={`${headCell} sticky top-0 z-30 ${strongRight}`}>
              Mode of Issuance
            </th>
            {FEE_GROUPS.map((g) => (
              <th
                key={g.label}
                colSpan={g.cols.length}
                className={`${headCell} sticky top-0 z-30 ${strongRight}`}
              >
                <span className="block leading-tight">{g.label}</span>
                {g.code ? (
                  <span className="block text-[9px] font-normal normal-case text-muted-foreground">
                    {g.code}
                  </span>
                ) : null}
              </th>
            ))}
            <th rowSpan={2} className={`${headCell} sticky top-0 z-30`}>
              Total
            </th>
          </tr>
          <tr>
            {FEE_GROUPS.flatMap((g) =>
              g.cols.map((c) => (
                <th
                  key={c.key}
                  className={`${headCell} sticky top-[38px] z-30 min-w-[8rem] normal-case ${strongRight}`}
                >
                  {c.label}
                </th>
              )),
            )}
          </tr>
        </thead>

        <tbody>
          {lines.map((l) => {
            const manual = l.sectors[sector].manual;
            const fsic = l.sectors[sector].fsic;
            return (
              <React.Fragment key={l.key}>
                <tr className="group bg-card even:row-alt transition-colors hover:bg-primary/5">
                  <th scope="row" rowSpan={2} className={rowHeadCell}>
                    {l.label}
                  </th>
                  <td className={`${bodyCell} text-center ${strongRight}`}>
                    <ModeBadge label="MANUAL" />
                  </td>
                  {FEE_CATEGS.map((k) => (
                    <td key={k} className={`${bodyCell} ${strongRight}`}>
                      <Amount v={manual[k] ?? 0} />
                    </td>
                  ))}
                  <td className={`${bodyCell} font-semibold`}>
                    <Amount v={sumAmounts(manual)} />
                  </td>
                </tr>
                <tr className="group row-alt transition-colors hover:bg-primary/5">
                  <td className={`${bodyCell} text-center ${strongRight}`}>
                    <ModeBadge label="FSIC" />
                  </td>
                  {FEE_CATEGS.map((k) => (
                    <td key={k} className={`${bodyCell} ${strongRight}`}>
                      <Amount v={fsic[k] ?? 0} />
                    </td>
                  ))}
                  <td className={`${bodyCell} font-semibold`}>
                    <Amount v={sumAmounts(fsic)} />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <th
              scope="row"
              className={`${footCell} sticky bottom-0 left-0 z-40 border-r border-r-border/50 text-left uppercase`}
            >
              Total
            </th>
            <td className={`${footCell} sticky bottom-0 z-30 text-center ${strongRight}`}>Total</td>
            {FEE_CATEGS.map((k) => (
              <td key={k} className={`${footCell} sticky bottom-0 z-30 ${strongRight}`}>
                <Amount v={totals.combined[k]} />
              </td>
            ))}
            <td className={`${footCell} sticky bottom-0 z-30`}>
              <Amount v={sumAmounts(totals.combined)} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Per-station matrix: one row per period bucket, sector totals across. */
function StationMatrixTable({
  row,
  groupBy,
}: {
  row: FireCodeFeeLedgerRow;
  groupBy: Granularity;
}) {
  const lines = React.useMemo(() => buildFeeLines(row.Feedetaillist, groupBy), [row.Feedetaillist, groupBy]);

  if (lines.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No collection records for this station in the selected period.
      </div>
    );
  }

  return (
    <table className="min-w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          <th className="sticky left-0 top-0 bg-background px-3 py-2 text-left font-semibold">
            Period
          </th>
          {FEE_SECTORS.map((sector) => (
            <th key={sector.key} className="bg-background px-3 py-2 text-right font-semibold">
              {sector.title}
            </th>
          ))}
          <th className="bg-background px-3 py-2 text-right font-semibold">Total</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const perSector = FEE_SECTORS.map((s) => ({
            key: s.key,
            value: sumAmounts(totalsForSector([line], s.key).combined),
          }));
          const lineTotal = perSector.reduce((a, b) => a + b.value, 0);
          return (
            <tr key={line.key} className="border-t border-border/40">
              <td className="sticky left-0 bg-background px-3 py-2 text-left font-medium">
                {line.label}
              </td>
              {perSector.map((s) => (
                <td key={s.key} className="px-3 py-2 text-right">
                  {peso(s.value)}
                </td>
              ))}
              <td className="px-3 py-2 text-right font-semibold">{peso(lineTotal)}</td>
            </tr>
          );
        })}
        <tr className="border-t border-border/60">
          <td className="sticky left-0 bg-background px-3 py-2 text-left text-xs font-bold uppercase">
            Total
          </td>
          {FEE_SECTORS.map((sector) => (
            <td key={sector.key} className="px-3 py-2 text-right font-semibold">
              {peso(row.sectorTotals[sector.key] ?? 0)}
            </td>
          ))}
          <td className="px-3 py-2 text-right font-bold">{peso(row.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function FireCodeFeesLedgerCard({
  row,
  groupBy,
  periodLabel,
  canManage,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  row: FireCodeFeeLedgerRow;
  groupBy: Granularity;
  periodLabel: string | null;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const lines = React.useMemo(() => buildFeeLines(row.Feedetaillist, groupBy), [row.Feedetaillist, groupBy]);
  const periodHeading = groupBy === "month" ? "Month" : groupBy === "annual" ? "Year" : "Period";

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const monthName = MONTHS.find((m) => m.value === row.month)?.name ?? String(row.month);

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 shadow-soft transition-shadow hover:shadow-elegant dark:border-border/40">
      <div className="flex items-start gap-3 border-b border-border/40 bg-gradient-to-r from-primary/5 via-primary/5 to-transparent p-4 dark:border-border/50">
        <AvatarWithFallback
          entity={{ name: row.Stationname }}
          name={row.Stationname}
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-primary/20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {row.Stationcode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
              {periodLabel ?? `${monthName} ${row.year}`}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground dark:text-slate-100">
            {row.Stationname}
          </div>
          <div className="text-[11px] text-muted-foreground dark:text-slate-400">
            
            {row.Provincename}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="grid h-10 min-w-[6rem] place-items-center rounded-lg bg-primary/10 px-2 text-center text-primary"
            title="Total collection"
          >
            <div className="text-[8px] font-bold uppercase leading-none">Total</div>
            <div className="text-xs font-bold leading-none">{peso(row.grandTotal)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-3">
        {FEE_SECTORS.map((s) => (
          <section key={s.key} className="space-y-1.5">
            <SectionToggleHeader
              title={`${s.title} — Fire Code Fees Collection`}
              expanded={!!expanded[s.key]}
              onToggle={() => toggle(s.key)}
            />
            {expanded[s.key] && (
              <SectorTable lines={lines} sector={s.key} periodHeading={periodHeading} />
            )}
          </section>
        ))}

        <div className="text-[10px] text-muted-foreground dark:text-slate-400">
          Last updated: {row.lastupdated ? new Date(row.lastupdated).toLocaleDateString() : "—"}
        </div>
      </div>

      {/* Card actions */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t bg-muted/20 p-2">
        <button
          type="button"
          onClick={onView}
          aria-label={`View Fire Code Fees collection for ${row.Stationname}`}
          title="View"
          className="rounded-md border border-border bg-card p-2 text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canManage && <EditButton onClick={onEdit} tooltip="Edit" />}
        {canManage && <DeleteButton onClick={onDelete} tooltip="Delete" />}
        <button
          type="button"
          onClick={onMatrix}
          aria-label={`Fire Code Fees matrix for ${row.Stationname}`}
          title="Fire Code Fees Matrix"
          className="rounded-md border border-border bg-card p-2 text-primary transition-colors hover:bg-primary hover:text-white"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
