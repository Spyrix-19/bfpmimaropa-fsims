import * as React from "react";
import { usePagination } from "@/hooks/usePagination";
import { ScopedLocationFilterPair } from "@/components/shared/ScopedLocationFilterPair";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { ClipboardList, Eye, LayoutGrid, Loader2, CalendarDays, Plus, Grid3x3 } from "lucide-react";
import InventoryMatrix from "./monitoringMatrix.tsx";
import { InventoryViewModal } from "./components/monitoringView.tsx";
import { InventoryEditModal } from "./components/monitoringEdit.tsx";
import { InspectionsNewModal } from "./components/monitoringNew.tsx";
import TargetAccomplishmentPanel from "./components/TargetAccomplishmentPanel.tsx";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import PaginationControls from "@/components/pagination";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolvePrimaryMonth,
} from "@/components/shared/ModuleFilterBar";

import FilterField from "@/components/filter-field";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";

import SecureDeleteDialog from "@/components/secure-delete-dialog";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";

// Monthly ledger queries are moved to the editor modal to avoid
// calling the heavy Monthly endpoint on the main listing view.
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { isReportMonthLocked } from "@/pages/06_target-reference/helpers";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CATEGORY_FIELDS, calendarDaysInMonth } from "@/lib/inventoryHelpers";
import type { MonthlyInventoryRow } from "@/types/inventoryType";
import type {
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryMonthlyClass,
  FSISIssuanceClassModel,
} from "@/types/targetinventoryType";

// Page-local aliases — the existing DTOs in `types/` are immutable; these
// names keep this file's original semantics without touching type files.
type FSISInventoryMonthlyItem = FSISInventoryMonthlyLedgerModel;
type FSISInventoryLedgerDailyItem = FSISInventoryMonthlyClass &
  Partial<FSISIssuanceClassModel> & { dateinspected?: string | Date };
import type { SearchStationModel } from "@/types/stationTypes";

function DaysEncodedBadge({ encoded, total }: { encoded: number; total: number }) {
  const ratio = total ? encoded / total : 0;
  const tone =
    ratio >= 1 ? "tone-success-soft" : ratio >= 0.25 ? "tone-warning-soft" : "tone-danger-soft";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
      title="Days encoded / calendar days"
    >
      <CalendarDays className="h-3 w-3" />
      {encoded} / {total}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Monthly response mapper
 *
 * Converts a `FSISInventoryMonthlyItem` (station-month row from
 * /api/v1/FSISInventory/Monthly) into the `MonthlyInventoryRow` shape the
 * existing ComplianceCard already consumes.  Every count sums the daily
 * entries in `fsisInventoryLedgerList`.
 * ---------------------------------------------------------------------- */

const LEDGER_FIELD_MAP = {
  inspection: {
    insp_during: "inspectduringcount",
    insp_after: "inspectaftercount",
    insp_bplo: "inspectbplocount",
    insp_gov: "inspectgovcount",
    insp_peza: "inspectpezacount",
    insp_tieza: "inspecttiezacount",
  },
  fsec: {
    fsec_building: "fsecbuildingcount",
    fsec_gov: "fsecgovcount",
    fsec_peza: "fsecpezacount",
    fsec_tieza: "fsectiezacount",
  },
  fsic: {
    fsic_occupancy: "fsicoccupancycount",
    fsic_bplo_new: "fsicbplonewcount",
    fsic_bplo_renewal: "fsicbplorenewcount",
    fsic_gov: "fsicgovcount",
    fsic_peza: "fsicpezacount",
    fsic_tieza: "fsictiezacount",
  },
  notices: {
    not_nod: "nodcount",
    not_ntc: "ntccount",
    not_ntcv: "ntcvcount",
    not_abatement: "abatementcount",
    not_closure: "closurecount",
  },
} as const;

function sumBucket(
  daily: FSISInventoryLedgerDailyItem[],
  map: Readonly<Record<string, string>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const uiKey of Object.keys(map)) {
    const apiKey = map[uiKey] as keyof FSISInventoryLedgerDailyItem;
    let total = 0;
    for (const d of daily) total += Number(d?.[apiKey] ?? 0) || 0;
    out[uiKey] = total;
  }
  return out;
}

function mapMonthlyItemToRow(
  item: FSISInventoryMonthlyItem,
  fallbackYear = 0,
  fallbackMonth = 0,
): MonthlyInventoryRow {
  const daily = Array.isArray(item.fsisInventoryLedgerList) ? item.fsisInventoryLedgerList : [];
  const breakdown = {
    inspection: sumBucket(daily, LEDGER_FIELD_MAP.inspection),
    fsec: sumBucket(daily, LEDGER_FIELD_MAP.fsec),
    fsic: sumBucket(daily, LEDGER_FIELD_MAP.fsic),
    notices: sumBucket(daily, LEDGER_FIELD_MAP.notices),
  };
  const sumOf = (rec: Record<string, number>) => Object.values(rec).reduce((a, b) => a + b, 0);
  const totals = {
    inspection: sumOf(breakdown.inspection),
    fsec: sumOf(breakdown.fsec),
    fsic: sumOf(breakdown.fsic),
    notices: sumOf(breakdown.notices),
  };

  // COUNT(DISTINCT dateinspected) — skip the 1900 sentinel used by empty rows.
  const dateSet = new Set<string>();
  let latestDate = "";
  for (const d of daily) {
    const iso = String(d?.dateinspected ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;
    dateSet.add(iso);
    if (iso > latestDate) latestDate = iso;
  }
  if (!latestDate) {
    const iso = String((item as { dateinspected?: string | Date }).dateinspected ?? "").slice(
      0,
      10,
    );
    if (iso && !iso.startsWith("1900")) latestDate = iso;
  }

  // The Monthly endpoint doesn't always echo reportyear/reportmonth at the
  // top level, so fall back to the filter values that produced the request.
  // Without this, cards render "0 / 0" days and blank month labels.
  const anyItem = item as { reportyear?: number; reportmonth?: number };
  const year = Number(anyItem.reportyear) || fallbackYear || 0;
  const month = Number(anyItem.reportmonth) || fallbackMonth || 0;

  return {
    key: `${item.stationno}|${year}|${month}`,
    stationno: item.stationno,
    stationcode: item.stationcode ?? "",
    stationname: item.stationname ?? "",
    provinceno: item.provinceno ?? "",
    provincename: item.provincename ?? "",
    cityname: item.cityname ?? "",
    logoUrl: item.logourl ?? "",
    year,
    month,
    daysEncoded: dateSet.size,
    daysInMonth: year && month ? calendarDaysInMonth(year, month) : 0,
    totals,
    breakdown,
    lastupdated: latestDate,
  };
}

export default function FireSafetyCompliancePage() {
  const { user, systemAccess } = useAuth();
  const navigate = useNavigate();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  // Only Personnel (roleno 3) at station types 28/29/30/31 may Add/Edit/Delete
  // Fire Safety Compliance records. All other users see View-only.
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess),
    [user, systemAccess],
  );

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const YEARS = React.useMemo(buildYears, []);

  const {
    state: filterState,
    set: setFilterState,
    resetState: resetFilterState,
  } = useModuleFilterState();
  const year = filterState.year;
  const month = String(resolvePrimaryMonth(filterState));

  const [provinceno, setProvinceno] = React.useState<string>(
    scope.provinceLocked ? scope.provinceno : EMPTY_GUID,
  );
  const [provincename, setProvincename] = React.useState<string>(
    scope.provinceLocked ? scope.provincename : "ALL",
  );
  const [stationno, setStationno] = React.useState<string>(
    scope.stationLocked ? scope.stationno : EMPTY_GUID,
  );
  const [stationname, setStationname] = React.useState<string>(
    scope.stationLocked ? scope.stationname : "ALL",
  );
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 12 });

  const [rows, setRows] = React.useState<MonthlyInventoryRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = () => setRefreshTick((t) => t + 1);

  const [deleteTarget, setDeleteTarget] = React.useState<MonthlyInventoryRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [matrixTarget, setMatrixTarget] = React.useState<{
    year: number;
    month?: number;
    stationno?: string;
    stationName?: string;
    provinceno?: string;
    provinceName?: string;
  } | null>(null);
  const [viewTarget, setViewTarget] = React.useState<MonthlyInventoryRow | null>(null);
  const [editTarget, setEditTarget] = React.useState<MonthlyInventoryRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const openMatrixGlobal = () => {
    setMatrixTarget(null);
    setMatrixOpen(true);
  };
  const openMatrixForCard = (r: MonthlyInventoryRow) => {
    setMatrixTarget({
      year: r.year,
      stationno: r.stationno,
      stationName: r.stationname,
      provinceno: r.provinceno,
      provinceName: r.provincename,
    });
    setMatrixOpen(true);
  };

  React.useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // Re-apply scope defaults whenever the authenticated scope resolves/changes.
  React.useEffect(() => {
    if (scope.provinceLocked) {
      setProvinceno(scope.provinceno);
      setProvincename(scope.provincename);
    } else {
      setProvinceno(EMPTY_GUID);
      setProvincename("ALL");
    }
    if (scope.stationLocked) {
      setStationno(scope.stationno);
      setStationname(scope.stationname);
    } else {
      setStationno(EMPTY_GUID);
      setStationname("ALL");
    }
  }, [
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
    scope.provincename,
    scope.stationname,
  ]);

  const handleProvinceSelect = (locationno: string, locationname: string) => {
    setProvinceno(locationno);
    setProvincename(locationname);
    // Reset station to ALL whenever province changes (editable case).
    setStationno(EMPTY_GUID);
    setStationname("ALL");
  };

  const handleStationSelect = (
    no: string,
    name: string,
    _province?: string,
    station?: SearchStationModel,
  ) => {
    setStationno(no);
    setStationname(name);
    // Sync province when a real station is picked and province is editable.
    if (no !== EMPTY_GUID && station?.provinceno && !scope.provinceLocked) {
      setProvinceno(station.provinceno);
      setProvincename(station.provincename || provincename);
    }
  };

  const handleResetFilters = () => {
    resetFilterState();

    if (!scope.provinceLocked) {
      setProvinceno(EMPTY_GUID);
      setProvincename("ALL");
    }
    if (!scope.stationLocked) {
      setStationno(EMPTY_GUID);
      setStationname("ALL");
    }
    setPage(1);
  };

  // Fetch ledger from server-side endpoint. Ensure empty/ALL filters
  // are sent as `EMPTY_GUID` so the backend receives explicit GUIDs.
  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const effectiveProvinceNo = scope.provinceLocked ? scope.provinceno : provinceno;
      const effectiveStationNo = scope.stationLocked ? scope.stationno : stationno;
      const resp = await targetinventoryAPI.getInventoryLedger(
        {
          searchkey: "",
          stationno: effectiveStationNo || EMPTY_GUID,
          provinceno: effectiveProvinceNo || EMPTY_GUID,
          reportyear: Number(year),
          reportmonth: Number(month),
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, signal: controller.signal },
      );
      const {
        ok,
        data,
        total: apiTotal,
        error,
        canceled,
      } = unwrap<FSISInventoryMonthlyItem[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load monthly inventory ledger.");
        setRows([]);
        setTotal(0);
      } else {
        const items = Array.isArray(data) ? data : [];
        setRows(items.map((it) => mapMonthlyItemToRow(it, Number(year), Number(month))));
        setTotal(Number(apiTotal || items.length || 0));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    year,
    month,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
    provinceno,
    stationno,
    refreshTick,
    page,
    pageSize,
  ]);

  React.useEffect(() => {
    setPage(1);
  }, [year, month, provinceno, stationno, pageSize]);

  // Server-side ledger returns a single page — use `rows` directly and
  // rely on `total` for pagination controls.
  const paged = React.useMemo(() => rows, [rows]);

  const monthLocked = isReportMonthLocked(Number(year), Number(month));

  // Effective GUIDs for the Target vs. Accomplishment panel.
  const effectiveStationNo = scope.stationLocked ? scope.stationno : stationno;
  const panelStationNo =
    effectiveStationNo && effectiveStationNo !== EMPTY_GUID ? effectiveStationNo : undefined;

  const askDelete = (r: MonthlyInventoryRow) => setDeleteTarget(r);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const resp = await targetinventoryAPI.delete({
        stationno: deleteTarget.stationno,
        reportyear: Number(deleteTarget.year),
        reportmonth: Number(deleteTarget.month),
        deletedby: user?.memberno ?? "anon",
        roleno: Number(systemAccess?.roleno ?? 0) || 0,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to delete monthly inventory.");
        return;
      }
      toast.success("Monthly inventory deleted.");
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Fire Safety Compliance
          </h1>
          <p className="text-xs text-muted-foreground">
            Fire safety compliance accomplishments grouped by station, month, and year.
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={openMatrixGlobal}
            className="w-full justify-center gap-2 sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> Compliance Matrix
          </Button>
          {canManage && (
            <Button
              onClick={() => setAddOpen(true)}
              className="w-full justify-center gap-2 sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Add Record
            </Button>
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
          provinceValue={provinceno}
          provinceLabel={provincename}
          stationValue={stationno}
          stationLabel={stationname}
          onProvinceChange={handleProvinceSelect}
          onStationChange={handleStationSelect}
        />
      </ModuleFilterBar>

      {/* Target vs. Accomplishment graph — shown above the monthly ledger */}
      <TargetAccomplishmentPanel
        stationno={panelStationNo}
        year={Number(year)}
        month={Number(month)}
      />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading monthly inventory…
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No monthly inventory records match the current filters.
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {paged.map((r) => (
            <ComplianceCard
              key={r.key}
              row={r}
              locked={monthLocked || !canManage}
              onView={() => setViewTarget(r)}
              onEdit={() => setEditTarget(r)}
              onDelete={() => askDelete(r)}
              onMatrix={() => openMatrixForCard(r)}
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

      <SecureDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
        title="Delete Monthly Inventory?"
        subject={
          deleteTarget ? (
            <>
              {deleteTarget.stationname} —{" "}
              {MONTHS.find((m) => m.value === deleteTarget.month)?.name} {deleteTarget.year}
            </>
          ) : null
        }
        description="This soft-deletes every daily record for the month. Records can be restored by the administrator."
        confirmLabel="Delete"
        deleting={deleting}
        onConfirm={confirmDelete}
      />

      <InventoryMatrix
        open={matrixOpen}
        onOpenChange={(o) => {
          setMatrixOpen(o);
          if (!o) setMatrixTarget(null);
        }}
        initialFilters={
          matrixTarget
            ? {
                year: matrixTarget.year,
                stationno: matrixTarget.stationno,
                stationName: matrixTarget.stationName,
                provinceno: matrixTarget.provinceno,
                provinceName: matrixTarget.provinceName,
              }
            : { year: Number(year) }
        }
        readOnly={!!matrixTarget}
      />

      <InspectionsNewModal
        open={addOpen}
        onOpenChange={setAddOpen}
        initialYear={Number(year) || undefined}
        initialMonth={Number(month) || undefined}
        onSaved={refresh}
        onEditExisting={(stationno, year, month, stationName) => {
          setEditTarget({
            stationno,
            stationname: stationName ?? "",
            provinceno: "",
            provincename: "",
            cityname: "",
            logoUrl: "",
            year,
            month,
            stationcode: "",
            key: `${stationno}|${year}|${month}`,
            daysEncoded: 0,
            daysInMonth: 0,
            lastupdated: "",
            totals: {
              inspection: 0,
              fsec: 0,
              fsic: 0,
              notices: 0,
            },
            breakdown: {
              inspection: {
                inspectduring: 0,
                insp_after: 0,
                insp_bplo: 0,
                insp_gov: 0,
                insp_peza: 0,
                insp_tieza: 0,
              },
              fsec: { fsec_building: 0, fsec_gov: 0, fsec_peza: 0, fsec_tieza: 0 },
              fsic: {
                fsic_occupancy: 0,
                fsic_bplo_new: 0,
                fsic_bplo_renewal: 0,
                fsic_gov: 0,
                fsic_peza: 0,
                fsic_tieza: 0,
              },
              notices: { not_nod: 0, not_ntc: 0, not_ntcv: 0, not_abatement: 0, not_closure: 0 },
            },
          });
        }}
      />

      {viewTarget && (
        <InventoryViewModal
          open={!!viewTarget}
          onOpenChange={(o) => !o && setViewTarget(null)}
          stationno={viewTarget.stationno}
          year={viewTarget.year}
          month={viewTarget.month}
          stationName={viewTarget.stationname}
        />
      )}

      {editTarget && (
        <InventoryEditModal
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          stationno={editTarget.stationno}
          year={editTarget.year}
          month={editTarget.month}
          stationName={editTarget.stationname}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/* ------------------------------- Card ------------------------------- */

const DETAIL_SECTIONS: {
  title: string;
  key: keyof MonthlyInventoryRow["breakdown"];
  fields: { key: string; label: string }[];
}[] = [
  { title: "Inspection", key: "inspection", fields: CATEGORY_FIELDS.INSPECTION },
  { title: "FSEC", key: "fsec", fields: CATEGORY_FIELDS.FSEC },
  { title: "FSIC", key: "fsic", fields: CATEGORY_FIELDS.FSIC },
  { title: "Others", key: "notices", fields: CATEGORY_FIELDS.NOTICES },
];

function ComplianceCard({
  row,
  locked,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  row: MonthlyInventoryRow;
  locked: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const monthName = MONTHS.find((m) => m.value === row.month)?.name ?? String(row.month);
  const grandTotal = row.totals.inspection + row.totals.fsec + row.totals.fsic + row.totals.notices;

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 dark:border-border/40 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header — mirrors TargetReference card */}
      <div className="flex items-start gap-3 border-b border-border/40 dark:border-border/50 bg-gradient-to-r from-blue-50 dark:from-slate-700/40 via-blue-50/50 dark:via-slate-700/20 to-transparent dark:to-transparent p-4">
        <AvatarWithFallback
          entity={{ name: row.stationname }}
          src={row.logoUrl || undefined}
          name={row.stationname}
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-blue-200 dark:ring-slate-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {row.stationcode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
              {monthName} {row.year}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground dark:text-slate-100">
            {row.stationname}
          </div>
          <div className="text-[11px] text-muted-foreground dark:text-slate-400">
            {row.cityname} · {row.provincename}
          </div>
        </div>
        <div
          className="grid h-10 w-14 place-items-center rounded-lg bg-blue-100 dark:bg-slate-600 text-center text-blue-700 dark:text-blue-300"
          title="Grand Total"
        >
          <div className="text-[8px] font-bold uppercase leading-none">Total</div>
          <div className="text-xs font-bold leading-none">{grandTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 p-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/60 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-foreground dark:text-slate-100">
              <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Monthly Totals
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DaysEncodedBadge encoded={row.daysEncoded} total={row.daysInMonth} />
              <span className="rounded-full bg-blue-100 dark:bg-slate-600 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {grandTotal.toLocaleString()} total
              </span>
            </div>
          </div>
          <div className="border-b border-border/40 dark:border-border/50" />
          <div className="grid gap-3 md:grid-cols-2">
            {[DETAIL_SECTIONS.slice(0, 2), DETAIL_SECTIONS.slice(2, 4)].map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-3">
                {group.map((section) => (
                  <div
                    key={section.key}
                    className="rounded-xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 dark:border-border/50 bg-blue-50 dark:bg-slate-700/60 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                        {section.title}
                      </span>
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
                        {row.totals[section.key].toLocaleString()}
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {section.fields.map((field, index) => {
                          const value = row.breakdown[section.key][field.key] ?? 0;
                          return (
                            <tr
                              key={field.key}
                              className={
                                index % 2 === 0
                                  ? "bg-card dark:bg-slate-800/30"
                                  : "bg-blue-50/40 dark:bg-slate-700/30"
                              }
                            >
                              <td className="px-3 py-2 text-sm font-medium text-foreground dark:text-slate-200">
                                {field.label}
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums ${
                                  value === 0
                                    ? "text-muted-foreground dark:text-slate-500"
                                    : "text-foreground dark:text-slate-100 font-semibold"
                                }`}
                              >
                                {value.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                        {section.key === "fsec" && (
                          <tr className="h-8 bg-card dark:bg-slate-800/30">
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2" />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground dark:text-slate-400">
          Last updated: {row.lastupdated ? new Date(row.lastupdated).toLocaleString() : "—"}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 dark:border-border/50 bg-muted/10 dark:bg-slate-800/30 p-2">
        <button
          type="button"
          onClick={onView}
          aria-label="View details"
          title="View"
          className="rounded-md p-2 bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-slate-600 transition-colors hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Eye className="h-4 w-4" />
        </button>
        {!locked && <EditButton onClick={onEdit} tooltip="Edit" />}
        {!locked && <DeleteButton onClick={onDelete} tooltip="Delete" />}
        <button
          type="button"
          onClick={onMatrix}
          aria-label="View Matrix"
          title="View Matrix"
          className="rounded-md p-2 bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-slate-600 transition-colors hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Grid3x3 className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
