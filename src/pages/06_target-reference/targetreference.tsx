import * as React from "react";
import { usePagination } from "@/hooks/usePagination";
import { ScopedLocationFilterPair } from "@/components/shared/ScopedLocationFilterPair";
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
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

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

import { useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS, QUARTERS, HALVES } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import type { SearchStationModel } from "@/types/stationTypes";
import type { TargetReferenceModel } from "@/types/targetreferenceType";

import TargetReferenceForm from "./components/TargetReferenceNew";
import TargetReferenceDetails from "./components/TargetReferenceDetails";
import TargetMatrixModal from "./components/TargetMatrix";
import {
  PERIOD_OPTIONS,
  computeDerivedFromList,
  computeDailyFromList,
  formatDayLabel,
  resolveTargetScope,
  type TargetPeriod,
  type TargetBucket,
} from "./helpers";
import ReadOnlyField from "./components/ReadOnlyField";
import { canManageTargetAndCompliance } from "@/lib/permissions";

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
      className={`px-2 py-1.5 text-right tabular-nums ${v === 0 ? "text-muted-foreground/60" : ""} ${className ?? ""}`}
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
    filterState.interval === "SEMESTER" ? "SEMI-ANNUAL" : filterState.interval;
  // Unlocked fields default to EMPTY_GUID ("ALL"); locked fields carry the login scope GUID.
  const [provinceFilter, setProvinceFilter] = React.useState<string>(
    scope.provinceLocked ? scope.provinceno : EMPTY_GUID,
  );
  const [provinceFilterName, setProvinceFilterName] = React.useState<string>(
    scope.provinceLocked ? scope.provincename : "ALL",
  );
  const [stationFilter, setStationFilter] = React.useState<string>(
    scope.stationLocked ? scope.stationno : EMPTY_GUID,
  );
  const [stationFilterName, setStationFilterName] = React.useState<string>(
    scope.stationLocked ? scope.stationname : "ALL",
  );
  const YEARS = React.useMemo(buildYears, []);
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 12 });

  // Re-apply scope defaults whenever the authenticated scope resolves/changes.
  React.useEffect(() => {
    if (scope.provinceLocked) {
      setProvinceFilter(scope.provinceno);
      setProvinceFilterName(scope.provincename);
    } else {
      setProvinceFilter(EMPTY_GUID);
      setProvinceFilterName("ALL");
    }
    if (scope.stationLocked) {
      setStationFilter(scope.stationno);
      setStationFilterName(scope.stationname);
    } else {
      setStationFilter(EMPTY_GUID);
      setStationFilterName("ALL");
    }
  }, [
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
    scope.provincename,
    scope.stationname,
  ]);

  const [rows, setRows] = React.useState<TargetReferenceModel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

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
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Always send GUIDs. EMPTY_GUID = "ALL" for editable fields. Role 2
      // type 27 (province locked, station editable + ALL) keeps the login
      // province so the server never returns cross-province stations.
      const effectiveProvinceNo = scope.provinceLocked ? scope.provinceno : provinceFilter;
      const effectiveStationNo = scope.stationLocked ? scope.stationno : stationFilter;
      const resp = await targetreferenceAPI.getLedger(
        {
          searchkey: "",
          stationno: effectiveStationNo || EMPTY_GUID,
          provinceno: effectiveProvinceNo || EMPTY_GUID,
          reportyear: Number(year),
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
    year,
    refreshTick,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
    provinceFilter,
    stationFilter,
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
  }, [year, month, provinceFilter, stationFilter, pageSize]);

  const handleProvinceSelect = (locationno: string, locationname: string) => {
    setProvinceFilter(locationno);
    setProvinceFilterName(locationname);
    // Reset station to ALL whenever province changes (editable case).
    setStationFilter(EMPTY_GUID);
    setStationFilterName("ALL");
  };

  const handleStationSelect = (
    stationno: string,
    stationname: string,
    province?: string,
    station?: SearchStationModel,
  ) => {
    setStationFilter(stationno);
    setStationFilterName(stationname);
    // Only propagate the station's province when the picker returned a real
    // station AND province is editable. ALL (EMPTY_GUID) must not mutate it.
    if (stationno !== EMPTY_GUID && station?.provinceno && !scope.provinceLocked) {
      setProvinceFilter(station.provinceno);
      setProvinceFilterName(station.provincename || province || provinceFilterName);
    }
  };

  const handleAdd = () => {
    setEditingGroup(null);
    setFormOpen(true);
  };

  const handleResetFilters = () => {
    resetFilterState();
    setProvinceFilter(scope.provinceLocked ? scope.provinceno : EMPTY_GUID);
    setProvinceFilterName(scope.provinceLocked ? scope.provincename : "ALL");
    setStationFilter(scope.stationLocked ? scope.stationno : EMPTY_GUID);
    setStationFilterName(scope.stationLocked ? scope.stationname : "ALL");
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
    if (pageGroups.length === 0) {
      toast.info("No target references to export.");
      return;
    }
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "FSIMS";
      wb.created = new Date();
      const ws = wb.addWorksheet(`Target Reference ${year}`);

      ws.columns = [
        { header: "Station Code", key: "stationCode", width: 16 },
        { header: "Station Name", key: "stationName", width: 32 },
        { header: "Province", key: "province", width: 22 },
        { header: "Year", key: "year", width: 10 },
        { header: "BPLO", key: "bplo", width: 12 },
        { header: "Gov", key: "gov", width: 12 },
        { header: "PEZA", key: "peza", width: 12 },
        { header: "TIEZA", key: "tieza", width: 12 },
      ];

      ws.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      for (const g of pageGroups) {
        const derived = computeDerivedFromList(g.row.targetreferencelist);
        const totals = derived.annual;
        ws.addRow({
          stationCode: g.stationCode,
          stationName: g.stationName,
          province: g.province,
          year: g.year,
          bplo: totals.bplo,
          gov: totals.gov,
          peza: totals.peza,
          tieza: totals.tieza,
        });
      }

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, colNumber) => {
          if (colNumber >= 5) {
            cell.numFmt = "#,##0;(#,##0);-";
            cell.alignment = { horizontal: "right" };
          }
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `TargetReference_${year}.xlsx`,
      );
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
              <Target className="h-4 w-4" /> Add Target
            </AddButton>
          )}
        </div>
      </div>

      {/* Filters */}
      <ModuleFilterBar
        years={YEARS}
        state={filterState}
        onChange={setFilterState}
        onReset={handleResetFilters}
      >
        <ScopedLocationFilterPair
          hideLabels
          scope={scope}
          provinceValue={provinceFilter}
          provinceLabel={provinceFilterName}
          stationValue={stationFilter}
          stationLabel={stationFilterName}
          onProvinceChange={handleProvinceSelect}
          onStationChange={handleStationSelect}
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

      <TargetReferenceForm
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
        <th className={`${cell} text-right`}>BPLO</th>
        <th className={`${cell} text-right`}>Gov</th>
        <th className={`${cell} text-right`}>PEZA</th>
        <th className={`${cell} text-right`}>TIEZA</th>
      </tr>
    </thead>
  );
}

function TargetCard({
  group,
  period,
  month,
  canManage,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  group: GroupItem;
  period: TargetPeriod;
  month: number;
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
    () => computeDailyFromList(group.row.targetreferencelist, group.year, month),
    [group.row.targetreferencelist, group.year, month],
  );
  const annualSum =
    derived.annual.bplo + derived.annual.gov + derived.annual.peza + derived.annual.tieza;

  return (
    <Card className="flex flex-col overflow-hidden border-border/60 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header */}
      <div className="flex items-start gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
        <AvatarWithFallback
          entity={{ name: group.stationName }}
          src={group.logoUrl || undefined}
          name={group.stationName}
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-primary/20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {group.stationCode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.year}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold">{group.stationName}</div>
          <div className="text-[11px] text-muted-foreground">{group.province}</div>
        </div>
        <div
          className="grid h-10 w-14 place-items-center rounded-lg bg-primary/10 text-center text-primary"
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
                    {MONTHS.map((m, i) => {
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
                        b={derived.annual}
                        k="bplo"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={derived.annual}
                        k="gov"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={derived.annual}
                        k="peza"
                        className="sticky bottom-0 z-20 bg-card [background-image:linear-gradient(hsl(var(--primary)/0.1),hsl(var(--primary)/0.1))] shadow-[0_-1px_0_0_hsl(var(--border))]"
                      />
                      <BucketCell
                        b={derived.annual}
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
              <table className="w-full text-xs">
                <TableHead firstLabel="Period" />
                <tbody>
                  {QUARTERS.map((q, i) => {
                    const b = derived.quarters[i];
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
              </table>
            </>
          )}

          {period === "SEMI-ANNUAL" && (
            <>
              <SectionHeader
                icon={<Layers className="h-3.5 w-3.5" />}
                title="Semi-Annual Targets"
              />
              <table className="w-full text-xs">
                <TableHead firstLabel="Period" />
                <tbody>
                  {HALVES.map((h, i) => {
                    const b = derived.halves[i];
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
              </table>
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
