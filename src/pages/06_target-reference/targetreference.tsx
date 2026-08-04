import * as React from "react";
import { usePagination } from "@/hooks/usePagination";
import {
  ScopedLocationMultiFilterPair,
  useScopedLocationMulti,
} from "@/components/shared/ScopedLocationMultiFilterPair";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  BarChart3,
  Layers,
  Trophy,
  Eye,
  LayoutGrid,
  Target,
  Loader2,
  Download,
} from "lucide-react";
import { toast } from "@/lib/toast";
import AddButton from "@/components/add-button";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import PaginationControls from "@/components/pagination";

import SecureDeleteDialog from "@/components/secure-delete-dialog";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import FilterField from "@/components/filter-field";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolvePrimaryMonth,
} from "@/components/shared/ModuleFilterBar";
import { resolveModuleMonths, resolveSelectedDay } from "@/components/shared/ModuleFilterBar";

import { useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS, QUARTERS, HALVES } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  TargetReferenceModel,
  TargetReferenceParamClass,
} from "@/types/targetreferenceType";

import TargetReferenceEdit from "./components/TargetReferenceEdit";
import TargetReferenceDetails from "./components/TargetReferenceDetails";
import TargetMatrixModal from "./components/TargetMatrix";
import { exportTargetReferenceWorkbook } from "./components/targetReferenceExport";
import {
  PERIOD_OPTIONS,
  computeDerivedFromList,
  computeDailyFromList,
  formatDayLabel,
  resolveTargetScope,
  buildLedgerRequest,
  addBucket,
  emptyBucket,
  type TargetPeriod,
  type TargetBucket,
} from "./helpers";
import ReadOnlyField from "./components/ReadOnlyField";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CurrentMonthNote } from "@/components/shared/CurrentMonthNote";

function BucketCell({
  b,
  k,
  className,
}: {
  b: TargetBucket;
  k: keyof TargetBucket;
  className?: string;
}) {
  const v = b[k];
  return (
    <td
      className={`px-2 py-1.5 text-center tabular-nums ${v === 0 ? "text-muted-foreground/60" : ""} ${className ?? ""}`}
    >
      {v.toLocaleString()}
    </td>
  );
}

interface GroupItem {
  key: string;
  year: number;
  stationno: string;
  stationCode: string;
  stationName: string;
  province: string;
  logoUrl: string;
  row: TargetReferenceModel;
}

function toGroup(row: TargetReferenceModel, year: number): GroupItem {
  return {
    key: `${year}|${row.stationno}`,
    year,
    stationno: row.stationno,
    stationCode: row.stationcode ?? "",
    stationName: row.stationname ?? "",
    province: row.provincename ?? "—",
    logoUrl: row.logourl ?? "",
    row,
  };
}

export default function TargetReferenceIndexPage() {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveTargetScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  // Only Personnel (roleno 3) assigned to station types 28/29/30/31 may
  // Add / Edit / Delete target references. All other users see View-only.
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess),
    [user, systemAccess],
  );

  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = () => setRefreshTick((t) => t + 1);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const {
    state: filterState,
    set: setFilterState,
    resetState: resetFilterState,
  } = useModuleFilterState();
  const year = filterState.year;
  const month = String(resolvePrimaryMonth(filterState));
  const period: TargetPeriod =
    filterState.interval === "ALL"
      ? "ANNUAL"
      : filterState.interval === "SEMESTER"
        ? "SEMI-ANNUAL"
        : filterState.interval;
  /** Months the display should render, driven by the active interval. */
  const selectedMonths = React.useMemo(() => resolveModuleMonths(filterState), [filterState]);
  /** DAILY only: a specific day, or null when "All" is selected. */
  const selectedDay = React.useMemo(() => resolveSelectedDay(filterState), [filterState]);
  const locationSel = useScopedLocationMulti(scope);
  const {
    provinceno: provinceFilter,
    provincename: provinceFilterName,
    stationno: stationFilter,
    stationname: stationFilterName,
    paramsKey: locationParamsKey,
  } = locationSel;
  const YEARS = React.useMemo(buildYears, []);
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });



  const [rows, setRows] = React.useState<TargetReferenceModel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  // Province → station selection used to build the Ledger POST body. When a
  // province has no explicitly selected station, every station available under
  // it is included.
  const [provincePayload, setProvincePayload] = React.useState<TargetReferenceParamClass[] | null>(
    null,
  );
  React.useEffect(() => {
    const params = JSON.parse(locationParamsKey) as TargetReferenceParamClass[];
    let cancelled = false;
    (async () => {
      // Provinces with an explicit station selection are already complete.
      const needsFill = params.length === 0 || params.some((p) => p.stationnos.length === 0);
      if (!needsFill) {
        setProvincePayload(params);
        return;
      }
      setProvincePayload(null);
      const targets: (string | undefined)[] =
        params.length === 0
          ? [undefined]
          : params.filter((p) => p.stationnos.length === 0).map((p) => p.provinceno);

      const byProvince = new Map<string, string[]>();
      params
        .filter((p) => p.stationnos.length > 0)
        .forEach((p) => byProvince.set(p.provinceno, [...p.stationnos]));

      for (const provinceno of targets) {
        const resp = await stationAPI.search(
          {
            provinceno: provinceno && provinceno !== EMPTY_GUID ? provinceno : undefined,
            pageNumber: 1,
            pageSize: 1000,
          },
          { suppressGlobalLoading: true, suppressErrorToast: true },
        );
        const { ok, data } = unwrap<SearchStationModel[]>(resp);
        if (cancelled) return;
        if (ok && Array.isArray(data)) {
          data.forEach((s) => {
            const p = s.provinceno || provinceno || EMPTY_GUID;
            if (!byProvince.has(p)) byProvince.set(p, []);
            if (s.stationno) byProvince.get(p)!.push(s.stationno);
          });
        }
      }
      if (cancelled) return;
      const payload = Array.from(byProvince.entries()).map(([provinceno, stationnos]) => ({
        provinceno,
        stationnos,
      }));
      setProvincePayload(payload.length ? payload : [{ provinceno: EMPTY_GUID, stationnos: [] }]);
    })();
    return () => {
      cancelled = true;
    };
  }, [locationParamsKey]);

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<{
    year: number;
    stationno: string;
  } | null>(null);

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [detailsTarget, setDetailsTarget] = React.useState<{
    stationno: string;
    reportyear: number;
  } | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<GroupItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [matrixTarget, setMatrixTarget] = React.useState<{
    year: number;
    stationno: string;
    stationName: string;
    provinceno: string;
    provinceName: string;
  } | null>(null);

  const openMatrixForCard = (g: GroupItem) => {
    setMatrixTarget({
      year: g.year,
      stationno: g.stationno,
      stationName: g.stationName,
      provinceno: g.row.provinceno ?? "",
      provinceName: g.province,
    });
    setMatrixOpen(true);
  };
  const openMatrixGlobal = () => {
    setMatrixTarget(null);
    setMatrixOpen(true);
  };

  // Fetch ledger for the selected year using server-side pagination.
  React.useEffect(() => {
    if (!provincePayload) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await targetreferenceAPI.getLedger(
        {
          parameters: buildLedgerRequest(filterState, "", provincePayload),
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data, total: apiTotal, error } = unwrap<TargetReferenceModel[]>(resp);
      if (cancelled) return;
      if (!ok) {
        toast.error(error || "Unable to load target references.");
        setRows([]);
        setTotal(0);
      } else {
        setRows(Array.isArray(data) ? data : []);
        setTotal(apiTotal || 0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    filterState,
    provincePayload,
    refreshTick,
    page,
    pageSize,
  ]);

  const groups: GroupItem[] = React.useMemo(
    () => rows.map((r) => toGroup(r, Number(year))),
    [rows, year],
  );

  // Server-side pagination — sort only the current page for stable display.
  const pageGroups = React.useMemo(
    () =>
      [...groups].sort(
        (a, b) =>
          a.province.localeCompare(b.province) || a.stationName.localeCompare(b.stationName),
      ),
    [groups],
  );

  React.useEffect(() => {
    setPage(1);
  }, [filterState, locationParamsKey, pageSize]);

  const handleAdd = () => {
    setEditingGroup(null);
    setFormOpen(true);
  };

  const handleResetFilters = () => {
    resetFilterState();
    locationSel.reset();
    setPage(1);
  };


  const handleEdit = (g: GroupItem) => {
    setEditingGroup({ year: g.year, stationno: g.stationno });
    setFormOpen(true);
  };
  const handleView = (g: GroupItem) => {
    setDetailsTarget({ stationno: g.stationno, reportyear: g.year });
    setDetailsOpen(true);
  };
  const askDelete = (g: GroupItem) => {
    setDeleteTarget(g);
    setDeleteOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const resp = await targetreferenceAPI.delete({
        stationno: deleteTarget.stationno,
        reportyear: deleteTarget.year,
        deletedby: user?.memberno ?? "",
        roleno: Number(systemAccess?.roleno ?? 0) || 0,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to delete target reference.");
        return;
      }
      toast.success("Target reference deleted.");
      refresh();
      setDeleteOpen(false);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await targetreferenceAPI.getLedger(
        {
          parameters: buildLedgerRequest(filterState, "", provincePayload ?? []),
          pagenumber: 0,
          pagesize: 0,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      const { ok, data, error } = unwrap<TargetReferenceModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export target references.");
        return;
      }

      const exportRows = Array.isArray(data) ? data : [];
      if (exportRows.length === 0) {
        toast.info("No target references to export.");
        return;
      }

      await exportTargetReferenceWorkbook({
        year: Number(year),
        groups: exportRows.map((row) => {
          const group = toGroup(row, Number(year));
          return {
            province: group.province,
            stationCode: group.stationCode,
            stationName: group.stationName,
            targetreferencelist: group.row.targetreferencelist,
          };
        }),
        interval: period,
        selectedMonths: selectedMonths,
        quarter: filterState.quarter,
        semester: filterState.semester,
        signatory: {
          rank: user?.rankcode ?? user?.rankname ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: user?.designation ?? "",
        },
      });
      toast.success("Target Reference exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Target Reference.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Target Reference
          </h1>
          <p className="text-xs text-muted-foreground">
            Review Fire Safety Inspection target plans for each station, organized by year with
            automatic totals and summary metrics.
          </p>
        </div>
        <div
          className={`grid w-full gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center ${canManage ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || pageGroups.length === 0}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button
            variant="outline"
            onClick={openMatrixGlobal}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> Target Matrix
          </Button>
          {canManage && (
            <AddButton onClick={handleAdd} className="w-full justify-center sm:w-auto">
              Add Target
            </AddButton>
          )}
        </div>
      </div>

      <CurrentMonthNote canManage={canManage} />


      {/* Filters */}
      <ModuleFilterBar
        years={YEARS}
        state={filterState}
        onChange={setFilterState}
        onReset={handleResetFilters}
      >
        <ScopedLocationMultiFilterPair
          hideLabels
          scope={scope}
          selection={locationSel}
          reportyear={Number(year)}
        />
      </ModuleFilterBar>

      {/* Card grid */}
      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading target references…
        </Card>
      ) : pageGroups.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No target references found.
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {pageGroups.map((g) => (
            <TargetCard
              key={g.key}
              group={g}
              period={period}
              month={Number(month)}
              months={selectedMonths}
              selectedDay={selectedDay}
              canManage={canManage}
              onView={() => handleView(g)}
              onEdit={() => handleEdit(g)}
              onDelete={() => askDelete(g)}
              onMatrix={() => openMatrixForCard(g)}
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

      <TargetReferenceEdit
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={
          editingGroup
            ? { year: editingGroup.year, month: Number(month), stationno: editingGroup.stationno }
            : null
        }
        initialYear={Number(year)}
        initialMonth={Number(month)}
        onSaved={refresh}
      />

      <TargetReferenceDetails
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        target={detailsTarget}
        period={period}
        month={Number(month)}
      />

      <TargetMatrixModal
        open={matrixOpen}
        onOpenChange={(o) => {
          setMatrixOpen(o);
          if (!o) setMatrixTarget(null);
        }}
        year={matrixTarget?.year ?? Number(year)}
        provinceno={
          matrixTarget?.provinceno ?? (scope.provinceLocked ? scope.provinceno : provinceFilter)
        }
        provinceName={
          matrixTarget?.provinceName ??
          (scope.provinceLocked ? scope.provincename : provinceFilterName)
        }
        stationno={
          matrixTarget?.stationno ?? (scope.stationLocked ? scope.stationno : stationFilter)
        }
        stationName={
          matrixTarget?.stationName ?? (scope.stationLocked ? scope.stationname : stationFilterName)
        }
        lockFilters={matrixTarget != null}
      />

      <SecureDeleteDialog
        open={deleteOpen}
        onOpenChange={(o) => !deleting && setDeleteOpen(o)}
        title="Delete Target Reference?"
        subject={
          deleteTarget ? (
            <>
              {deleteTarget.stationName ?? deleteTarget.stationCode ?? "Station"} —{" "}
              {deleteTarget.year}
            </>
          ) : null
        }
        description="This deletes every daily target record for the selected station and year. This action cannot be undone."
        confirmLabel="Delete"
        deleting={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

/* ------------------------------- Card ------------------------------- */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
        {title}
      </span>
    </div>
  );
}

function TableHead({ firstLabel }: { firstLabel: string }) {
  const cell =
    "sticky top-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-2 py-1.5 font-semibold shadow-[0_1px_0_0_hsl(var(--border))]";
  return (
    <thead className="sticky top-0 z-20">
      <tr className="text-left text-[10px] uppercase tracking-[0.15em] text-primary">
        <th className={cell}>{firstLabel}</th>
        <th className={`${cell} text-center`}>BPLO</th>
        <th className={`${cell} text-center`}>Gov</th>
        <th className={`${cell} text-center`}>PEZA</th>
        <th className={`${cell} text-center`}>TIEZA</th>
      </tr>
    </thead>
  );
}

function TargetCard({
  group,
  period,
  month,
  months,
  selectedDay,
  canManage,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  group: GroupItem;
  period: TargetPeriod;
  month: number;
  /** Months to render (already resolved from the active interval). */
  months: number[];
  /** DAILY: specific day to render, or null for the whole month. */
  selectedDay: number | null;
  canManage: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const derived = React.useMemo(
    () => computeDerivedFromList(group.row.targetreferencelist),
    [group.row.targetreferencelist],
  );
  const dailyDerived = React.useMemo(
    () =>
      computeDailyFromList(
        group.row.targetreferencelist,
        group.year,
        month,
        selectedDay ? [selectedDay] : null,
      ),
    [group.row.targetreferencelist, group.year, month, selectedDay],
  );
  const monthSet = React.useMemo(() => new Set(months), [months]);
  const monthlyTotal = React.useMemo(
    () =>
      months.reduce(
        (acc, m) => addBucket(acc, derived.monthly[m] ?? emptyBucket()),
        emptyBucket(),
      ),
    [months, derived],
  );
  const quarterlyTotal = React.useMemo(
    () =>
      QUARTERS.map((_, idx) => idx)
        .filter((idx) => monthSet.has(idx * 3 + 1))
        .reduce((acc, idx) => addBucket(acc, derived.quarters[idx]), emptyBucket()),
    [derived.quarters, monthSet],
  );
  const semesterTotal = React.useMemo(
    () =>
      HALVES.map((_, idx) => idx)
        .filter((idx) => monthSet.has(idx * 6 + 1))
        .reduce((acc, idx) => addBucket(acc, derived.halves[idx]), emptyBucket()),
    [derived.halves, monthSet],
  );
  const annualSum =
    derived.annual.bplo + derived.annual.gov + derived.annual.peza + derived.annual.tieza;

  return (
    <Card className="flex flex-col overflow-hidden border-border/60 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b bg-card p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-foreground">
              {group.stationCode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.year}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground">{group.stationName}</div>
          <div className="text-[11px] text-muted-foreground">{group.province}</div>
        </div>
        <div
          className="grid h-10 w-14 place-items-center rounded-lg border border-border/60 bg-muted/40 text-center text-foreground"
          title="Annual Total"
        >
          <div className="text-[8px] font-bold uppercase leading-none">Total</div>
          <div className="text-xs font-bold leading-none">{annualSum.toLocaleString()}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 p-3">
        <div className="rounded-lg border border-border/60">
          {period === "DAILY" && (
            <>
              <SectionHeader icon={<Calendar className="h-3.5 w-3.5" />} title="Daily Targets" />
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <TableHead firstLabel="Date" />
                  <tbody>
                    {dailyDerived.days.map((d, i) => {
                      const b = dailyDerived.daily[d];
                      return (
                        <tr key={d} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                            {formatDayLabel(group.year, month, d)}
                          </td>
                          <BucketCell b={b} k="bplo" />
                          <BucketCell b={b} k="gov" />
                          <BucketCell b={b} k="peza" />
                          <BucketCell b={b} k="tieza" />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20">
                    <tr className="font-semibold">
                      <td className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-2 py-1.5 shadow-[0_-1px_0_0_hsl(var(--border))]">
                        TOTAL
                      </td>
                      <BucketCell
                        b={dailyDerived.total}
                        k="bplo"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={dailyDerived.total}
                        k="gov"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={dailyDerived.total}
                        k="peza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={dailyDerived.total}
                        k="tieza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {period === "MONTHLY" && (
            <>
              <SectionHeader icon={<Calendar className="h-3.5 w-3.5" />} title="Monthly Targets" />
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <TableHead firstLabel="Month" />
                  <tbody>
                    {MONTHS.filter((m) => monthSet.has(m.value)).map((m, i) => {
                      const b = derived.monthly[m.value];
                      return (
                        <tr key={m.value} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="px-2 py-1.5 font-medium">{m.short}</td>
                          <BucketCell b={b} k="bplo" />
                          <BucketCell b={b} k="gov" />
                          <BucketCell b={b} k="peza" />
                          <BucketCell b={b} k="tieza" />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20">
                    <tr className="font-semibold">
                      <td className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-2 py-1.5 shadow-[0_-1px_0_0_hsl(var(--border))]">
                        TOTAL
                      </td>
                      <BucketCell
                        b={monthlyTotal}
                        k="bplo"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={monthlyTotal}
                        k="gov"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={monthlyTotal}
                        k="peza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={monthlyTotal}
                        k="tieza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {period === "QUARTERLY" && (
            <>
              <SectionHeader
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                title="Quarterly Targets"
              />
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <TableHead firstLabel="Period" />
                  <tbody>
                    {QUARTERS.map((q, idx) => ({ q, idx }))
                      .filter(({ idx }) => monthSet.has(idx * 3 + 1))
                      .map(({ q, idx }, i) => {
                      const b = derived.quarters[idx];
                      return (
                        <tr key={q} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="px-2 py-1.5 font-medium">{q}</td>
                          <BucketCell b={b} k="bplo" />
                          <BucketCell b={b} k="gov" />
                          <BucketCell b={b} k="peza" />
                          <BucketCell b={b} k="tieza" />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20">
                    <tr className="font-semibold">
                      <td className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-2 py-1.5 shadow-[0_-1px_0_0_hsl(var(--border))]">
                        TOTAL
                      </td>
                      <BucketCell
                        b={quarterlyTotal}
                        k="bplo"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={quarterlyTotal}
                        k="gov"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={quarterlyTotal}
                        k="peza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={quarterlyTotal}
                        k="tieza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {period === "SEMI-ANNUAL" && (
            <>
              <SectionHeader
                icon={<Layers className="h-3.5 w-3.5" />}
                title="Semi-Annual Targets"
              />
              <div className="max-h-56 overflow-auto">
                <table className="w-full text-xs">
                  <TableHead firstLabel="Period" />
                  <tbody>
                    {HALVES.map((h, idx) => ({ h, idx }))
                      .filter(({ idx }) => monthSet.has(idx * 6 + 1))
                      .map(({ h, idx }, i) => {
                      const b = derived.halves[idx];
                      return (
                        <tr key={h} className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                          <td className="px-2 py-1.5 font-medium">{h}</td>
                          <BucketCell b={b} k="bplo" />
                          <BucketCell b={b} k="gov" />
                          <BucketCell b={b} k="peza" />
                          <BucketCell b={b} k="tieza" />
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-20">
                    <tr className="font-semibold">
                      <td className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] px-2 py-1.5 shadow-[0_-1px_0_0_hsl(var(--border))]">
                        TOTAL
                      </td>
                      <BucketCell
                        b={semesterTotal}
                        k="bplo"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={semesterTotal}
                        k="gov"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={semesterTotal}
                        k="peza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={semesterTotal}
                        k="tieza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {period === "ANNUAL" && (
            <>
              <SectionHeader icon={<Trophy className="h-3.5 w-3.5" />} title="Annual Targets" />
              <table className="w-full text-xs">
                <TableHead firstLabel="Period" />
                <tbody>
                  <tr className="bg-primary/10 font-semibold">
                    <td className="px-2 py-1.5">Annual Total</td>
                    <BucketCell b={derived.annual} k="bplo" />
                    <BucketCell b={derived.annual} k="gov" />
                    <BucketCell b={derived.annual} k="peza" />
                    <BucketCell b={derived.annual} k="tieza" />
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t bg-muted/20 p-2">
        <button
          type="button"
          onClick={onView}
          aria-label="View details"
          title="View"
          className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer"
        >
          <Eye className="h-4 w-4" />
        </button>
        {canManage && <EditButton onClick={onEdit} tooltip="Edit" />}
        {canManage && <DeleteButton onClick={onDelete} tooltip="Delete" />}
        <button
          type="button"
          onClick={onMatrix}
          aria-label="Target Matrix"
          title="Target Matrix"
          className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
