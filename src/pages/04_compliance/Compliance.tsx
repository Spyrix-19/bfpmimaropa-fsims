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
import {
  ClipboardList,
  Eye,
  LayoutGrid,
  Loader2,
  CalendarDays,
  Plus,
  Grid3x3,
  Download,
} from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import InventoryMatrix from "./complianceMatrix.tsx";
import { InventoryViewModal } from "./components/complianceView.tsx";
import { InventoryEditModal } from "./components/complianceEdit.tsx";
import { InspectionsNewModal } from "./components/complianceNew.tsx";
import TargetAccomplishmentPanel from "./components/TargetAccomplishmentPanel.tsx";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS, QUARTERS } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import PaginationControls from "@/components/pagination";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolvePrimaryMonth,
  resolveSelectedDay,
  type ModuleInterval,
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
import { complianceAPI } from "@/services/complianceAPI.ts";
import { toMonthlyLedgerModel } from "@/lib/complianceAdapters";
import { isReportMonthLocked } from "@/pages/06_target-reference/helpers";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CurrentMonthNote } from "@/components/shared/CurrentMonthNote";
import { CATEGORY_FIELDS, calendarDaysInMonth } from "@/lib/inventoryHelpers";
import type { MonthlyInventoryRow } from "@/types/inventoryType";
import type {
  FSISInventoryMonthlyLedgerModel,
  FSISInventoryMonthlyClass,
  FSISIssuanceClassModel,
  FSISComplianceModel,
} from "@/types/complianceType.ts";

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

export type LedgerRow = MonthlyInventoryRow & {
  daily?: FSISInventoryLedgerDailyItem[];
  monthlyTargets?: Record<string, number>;
};

function mapMonthlyItemToRow(
  item: FSISInventoryMonthlyItem,
  fallbackYear = 0,
  fallbackMonth = 0,
): LedgerRow {
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

  // Capture station-level monthly targets so the ledger can show target
  // values even when the daily records do not echo dailytarget* fields.
  const monthlyTargets = {
    inspectbplocount: Number((item as { totaltargetbplo?: number }).totaltargetbplo ?? 0) || 0,
    inspectgovcount: Number((item as { totaltargetgov?: number }).totaltargetgov ?? 0) || 0,
    inspectpezacount: Number((item as { totaltargetpeza?: number }).totaltargetpeza ?? 0) || 0,
    inspecttiezacount: Number((item as { totaltargettieza?: number }).totaltargettieza ?? 0) || 0,
  };

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
    daily,
    monthlyTargets,
  };
}

/**
 * /api/v1/FSISInventory/Ledger does NOT return the dailytarget* fields, so the
 * Target columns render blank. /api/v1/FSISCompliance/Ledger does return them,
 * keyed by `fsisno`. Fetch that once per listing and merge the targets into the
 * daily records already loaded from the inventory ledger.
 */
async function fetchDailyTargets(
  items: FSISInventoryMonthlyItem[],
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<Map<string, Record<string, number>>> {
  const out = new Map<string, Record<string, number>>();
  const byProvince = new Map<string, Set<string>>();
  for (const it of items) {
    if (!it.provinceno || !it.stationno) continue;
    if (!byProvince.has(it.provinceno)) byProvince.set(it.provinceno, new Set());
    byProvince.get(it.provinceno)!.add(it.stationno);
  }
  if (!byProvince.size || !year || !month) return out;

  try {
    const resp = await complianceAPI.getLedger(
      {
        parameters: {
          searchkey: "",
          reportyear: Number(year),
          interval: 1,
          targetdate: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
          dateinspected: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
          reportmonth: [Number(month)],
          provinces: Array.from(byProvince, ([provinceno, stations]) => ({
            provinceno,
            stationnos: Array.from(stations),
          })),
        },
        pagenumber: 1,
        pagesize: Math.max(items.length, 10),
      },
      { suppressGlobalLoading: true, signal },
    );
    const { ok, data } = unwrap<
      {
        stationno?: string;
        compliancelist?: Record<string, unknown>[];
      }[]
    >(resp);
    if (!ok) return out;
    for (const st of Array.isArray(data) ? data : []) {
      for (const rec of Array.isArray(st?.compliancelist) ? st.compliancelist : []) {
        const targets = {
          dailytargetbplo: Number(rec?.dailytargetbplo ?? 0) || 0,
          dailytargetgov: Number(rec?.dailytargetgov ?? 0) || 0,
          dailytargetpeza: Number(rec?.dailytargetpeza ?? 0) || 0,
          dailytargettieza: Number(rec?.dailytargettieza ?? 0) || 0,
        };
        const fsisno = String(rec?.fsisno ?? "");
        if (fsisno) out.set(`fsis:${fsisno}`, targets);
        const iso = String(rec?.dateinspected ?? "").slice(0, 10);
        const stationno = String(rec?.stationno ?? st?.stationno ?? "");
        if (iso && stationno) out.set(`date:${stationno}|${iso}`, targets);
      }
    }
  } catch {
    /* targets are best-effort — leave the ledger rendering without them */
  }
  return out;
}

/** Merges fetched dailytarget* values into a mapped row's daily records. */
function withDailyTargets(
  row: LedgerRow,
  targets: Map<string, Record<string, number>>,
): LedgerRow {
  if (!targets.size || !Array.isArray(row.daily)) return row;
  return {
    ...row,
    daily: row.daily.map((d) => {
      const iso = String(d?.dateinspected ?? "").slice(0, 10);
      const t =
        targets.get(`fsis:${String((d as { fsisno?: string }).fsisno ?? "")}`) ??
        targets.get(`date:${row.stationno}|${iso}`);
      return t ? { ...d, ...t } : d;
    }),
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
  /** Interval + specific day drive how TARGET values are aggregated (Target Reference parity). */
  const interval = filterState.interval;
  const selectedDay = React.useMemo(() => resolveSelectedDay(filterState), [filterState]);

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

  const [rows, setRows] = React.useState<LedgerRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
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
      const provinces =
        effectiveProvinceNo && effectiveProvinceNo !== EMPTY_GUID
          ? [
              {
                provinceno: effectiveProvinceNo,
                stationnos:
                  effectiveStationNo && effectiveStationNo !== EMPTY_GUID
                    ? [effectiveStationNo]
                    : [],
              },
            ]
          : [];
      const resp = await complianceAPI.getLedger(
        {
          parameters: {
            searchkey: "",
            reportyear: Number(year),
            interval: 1,
            targetdate: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
            dateinspected: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
            reportmonth: [Number(month)],
            provinces,
          },
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
      } = unwrap<FSISComplianceModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load monthly compliance ledger.");
        setRows([]);
        setTotal(0);
      } else {
        const items = (Array.isArray(data) ? data : []).map((st) =>
          toMonthlyLedgerModel(st, Number(year), Number(month)),
        );
        const mapped = items.map((it) => mapMonthlyItemToRow(it, Number(year), Number(month)));
        setRows(mapped);
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
      const resp = await complianceAPI.delete({
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

  const handleExport = async () => {
    if (paged.length === 0) {
      toast.info("No compliance records to export.");
      return;
    }
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "FSIMS";
      wb.created = new Date();
      const ws = wb.addWorksheet(`Fire Safety Compliance ${year}`);

      ws.columns = [
        { header: "Station Code", key: "stationCode", width: 16 },
        { header: "Station Name", key: "stationName", width: 32 },
        { header: "Province", key: "province", width: 22 },
        { header: "Year", key: "year", width: 10 },
        { header: "Month", key: "month", width: 12 },
        { header: "Inspection", key: "inspection", width: 14 },
        { header: "FSEC", key: "fsec", width: 12 },
        { header: "FSIC", key: "fsic", width: 12 },
        { header: "Notices", key: "notices", width: 12 },
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

      for (const r of paged) {
        ws.addRow({
          stationCode: r.stationcode,
          stationName: r.stationname,
          province: r.provincename,
          year: r.year,
          month: MONTHS.find((m) => m.value === r.month)?.name ?? r.month,
          inspection: r.totals.inspection,
          fsec: r.totals.fsec,
          fsic: r.totals.fsic,
          notices: r.totals.notices,
        });
      }

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, colNumber) => {
          if (colNumber >= 6) {
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
        `FireSafetyCompliance_${year}_${month}.xlsx`,
      );
      toast.success("Fire Safety Compliance exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Fire Safety Compliance.");
    } finally {
      setExporting(false);
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
        <div
          className={`grid w-full gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center ${canManage ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || paged.length === 0}
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

      <CurrentMonthNote canManage={canManage} />

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
        <div className="grid grid-cols-1 gap-4">
          {paged.map((r) => (
            <ComplianceLedgerCard
              key={r.key}
              row={r}
              interval={interval}
              selectedDay={selectedDay}
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

/* ------------------------------ Ledger ------------------------------ */

type LedgerCol = { key: string; label: string };

const INSPECTION_COLS: LedgerCol[] = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
  { key: "inspectbplocount", label: "1st BPLO" },
  { key: "inspectgovcount", label: "1st GOV" },
  { key: "inspectpezacount", label: "1st PEZA" },
  { key: "inspecttiezacount", label: "1st TIEZA" },
];

/** Inspection columns rendered as a single value (no TARGET sub-column). */
const INSPECTION_PLAIN_COLS: LedgerCol[] = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
];

/** Inspection columns rendered as a TARGET / ISSUANCE pair. */
const INSPECTION_TARGET_COLS: (LedgerCol & { targetKey: string })[] = [
  { key: "inspectbplocount", label: "1st BPLO", targetKey: "dailytargetbplo" },
  { key: "inspectgovcount", label: "1st GOV", targetKey: "dailytargetgov" },
  { key: "inspectpezacount", label: "1st PEZA", targetKey: "dailytargetpeza" },
  { key: "inspecttiezacount", label: "1st TIEZA", targetKey: "dailytargettieza" },
];


const ISSUANCE_GROUPS: { title: string; cols: LedgerCol[] }[] = [
  {
    title: "FSEC",
    cols: [
      { key: "fsecbuildingcount", label: "Building" },
      { key: "fsecgovcount", label: "GOV" },
      { key: "fsecpezacount", label: "PEZA" },
      { key: "fsectiezacount", label: "TIEZA" },
    ],
  },
  {
    title: "FSIC",
    cols: [
      { key: "fsicoccupancycount", label: "Occupancy" },
      { key: "fsicbplonewcount", label: "BPLO New" },
      { key: "fsicbplorenewcount", label: "BPLO Renew" },
      { key: "fsicgovcount", label: "GOV" },
      { key: "fsicpezacount", label: "PEZA" },
      { key: "fsictiezacount", label: "TIEZA" },
    ],
  },
  {
    title: "Notices",
    cols: [
      { key: "nodcount", label: "NOD" },
      { key: "ntccount", label: "NTC" },
      { key: "ntcvcount", label: "NTCV" },
      { key: "abatementcount", label: "Abatement" },
      { key: "closurecount", label: "Closure" },
    ],
  },
];

const ISSUANCE_COLS = ISSUANCE_GROUPS.flatMap((g) => g.cols);

/** Columns that end a category group — used to draw a visual divider line. */
const GROUP_END_KEYS = new Set([
  ...INSPECTION_PLAIN_COLS.slice(-1).map((c) => c.key),
  ...INSPECTION_TARGET_COLS.slice(-1).map((c) => c.key),
  ...ISSUANCE_GROUPS.flatMap((g) => g.cols.slice(-1).map((c) => c.key)),
]);

const num = (v: unknown) => Number(v ?? 0) || 0;

type ModeCounts = Record<string, number>;

interface DayLine {
  key: string;
  label: string;
  inspection: Record<string, number>;
  /** Daily target per inspection group (presentation only, sourced from the same payload). */
  target: Record<string, number>;
  manual: ModeCounts;
  fsis: ModeCounts;
}


const emptyMode = (): ModeCounts =>
  Object.fromEntries(ISSUANCE_COLS.map((c) => [c.key, 0])) as ModeCounts;

/**
 * Presentation-only: builds the complete, fixed interval list for the period
 * plus the bucket resolver, mirroring how Target Reference groups targets.
 *
 * DAILY (specific day) → that calendar day only.
 * DAILY (all days)     → EVERY calendar day of the month.
 * MONTHLY              → January … December.
 * QUARTERLY            → Q1 … Q4.
 * SEMESTER             → Semester 1 / Semester 2.
 * ANNUAL               → a single Annual line.
 * Intervals with no API record still render, showing 0.
 */
type IntervalSpec = {
  intervals: { key: string; label: string }[];
  /** Maps an ISO date (yyyy-mm-dd) to its interval key, or null when outside. */
  bucketOf: (iso: string) => string | null;
};

function buildIntervalSpec(
  year: number,
  month: number,
  interval: ModuleInterval,
  selectedDay: number | null,
): IntervalSpec {
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || 0;
  const monthOf = (iso: string) => Number(iso.slice(5, 7)) || 0;
  const yearOf = (iso: string) => Number(iso.slice(0, 4)) || 0;

  if (interval === "MONTHLY") {
    return {
      intervals: Array.from({ length: 12 }, (_, i) => ({
        key: `${y}-${String(i + 1).padStart(2, "0")}`,
        label: `${MONTHS.find((x) => x.value === i + 1)?.name ?? i + 1} ${y}`,
      })),
      bucketOf: (iso) => (yearOf(iso) === y ? iso.slice(0, 7) : null),
    };
  }

  if (interval === "QUARTERLY") {
    return {
      intervals: QUARTERS.map((q, i) => ({ key: `${y}-q${i + 1}`, label: `${q} ${y}` })),
      bucketOf: (iso) => {
        if (yearOf(iso) !== y) return null;
        const mm = monthOf(iso);
        if (mm < 1 || mm > 12) return null;
        return `${y}-q${Math.floor((mm - 1) / 3) + 1}`;
      },
    };
  }

  if (interval === "SEMESTER") {
    return {
      intervals: [1, 2].map((s) => ({ key: `${y}-s${s}`, label: `Semester ${s} ${y}` })),
      bucketOf: (iso) => {
        if (yearOf(iso) !== y) return null;
        const mm = monthOf(iso);
        if (mm < 1 || mm > 12) return null;
        return `${y}-s${mm <= 6 ? 1 : 2}`;
      },
    };
  }

  if (interval === "ANNUAL" || interval === "ALL") {
    return {
      intervals: [{ key: `${y}-annual`, label: `Annual ${y}` }],
      bucketOf: (iso) => (yearOf(iso) === y ? `${y}-annual` : null),
    };
  }

  // DAILY
  const dm = m >= 1 && m <= 12 ? m : new Date().getMonth() + 1;
  const dayLabel = (day: number) =>
    new Date(y, dm - 1, day).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const isoOf = (day: number) =>
    `${y}-${String(dm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const days =
    selectedDay && selectedDay >= 1
      ? [selectedDay]
      : Array.from({ length: calendarDaysInMonth(y, dm) }, (_, i) => i + 1);

  const keys = new Set(days.map(isoOf));
  return {
    intervals: days.map((d) => ({ key: isoOf(d), label: dayLabel(d) })),
    bucketOf: (iso) => (keys.has(iso) ? iso : null),
  };
}

/** Presentation-only: expands the daily payload into MANUAL/FSIS lines per interval. */
function buildDayLines(
  daily: FSISInventoryLedgerDailyItem[] | undefined,
  year: number,
  month: number,
  interval: ModuleInterval = "DAILY",
  selectedDay: number | null = null,
  monthlyTargets?: Record<string, number>,
): DayLine[] {
  const { intervals, bucketOf } = buildIntervalSpec(year, month, interval, selectedDay);

  const lineByKey = new Map<string, DayLine>();
  for (const it of intervals) {
    lineByKey.set(it.key, {
      key: it.key,
      label: it.label,
      inspection: Object.fromEntries(INSPECTION_COLS.map((c) => [c.key, 0])),
      target: Object.fromEntries(INSPECTION_TARGET_COLS.map((c) => [c.key, 0])),

      manual: emptyMode(),
      fsis: emptyMode(),
    });
  }

  // Pre-compute a fallback target per interval when the backend only returns
  // station-level monthly targets (totaltarget*) and not per-record dailytarget*.
  const intervalCount = intervals.length || 1;
  const fallbackTarget = (key: string, intervalKey: string): number => {
    const total = Number(monthlyTargets?.[key] ?? 0) || 0;
    if (!total) return 0;
    // For DAILY, spread the monthly target evenly across days.
    if (interval === "DAILY") return total / intervalCount;
    // For MONTHLY/QUARTERLY/SEMESTER/ANNUAL the whole monthly target applies
    // only to the interval that contains this station-month's data.
    const bucket = bucketOf(`${year}-${String(month).padStart(2, "0")}-01`);
    return bucket === intervalKey ? total : 0;
  };

  for (const rec of Array.isArray(daily) ? daily : []) {
    const iso = String(rec?.dateinspected ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;
    const bucketKey = bucketOf(iso);
    if (!bucketKey) continue;
    const line = lineByKey.get(bucketKey);
    if (!line) continue;

    const issuances = Array.isArray(rec?.issuancelist) ? rec.issuancelist : [];
    if (issuances.length) {
      for (const iss of issuances) {
        const target = num(iss?.fsicmode) === 97 ? line.fsis : line.manual;
        for (const c of ISSUANCE_COLS)
          target[c.key] += num((iss as unknown as Record<string, unknown>)?.[c.key]);
      }
    } else {
      // Flat ledger payloads carry no issuance modes — show them as MANUAL.
      for (const c of ISSUANCE_COLS)
        line.manual[c.key] += num((rec as unknown as Record<string, unknown>)?.[c.key]);
    }
    for (const c of INSPECTION_COLS)
      line.inspection[c.key] += num((rec as unknown as Record<string, unknown>)?.[c.key]);
    // Targets aggregate exactly like Target Reference: records inside the same
    // interval bucket are summed (daily, monthly, quarterly, semester, annual).
    for (const c of INSPECTION_TARGET_COLS)
      line.target[c.key] += num((rec as unknown as Record<string, unknown>)?.[c.targetKey]);
  }

  // Apply monthly-target fallback for intervals that received no dailytarget*
  // values from the backend (keeps the Target column from staying blank).
  for (const line of lineByKey.values()) {
    for (const c of INSPECTION_TARGET_COLS) {
      if (!line.target[c.key]) {
        line.target[c.key] = fallbackTarget(c.key, line.key);
      }
    }
  }

  return intervals.map((it) => lineByKey.get(it.key)!);
}


const headCell =
  "border border-border/50 bg-blue-50 dark:bg-slate-800 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 whitespace-nowrap text-center";
const bodyCell = "border border-border/40 px-2 py-1.5 text-xs tabular-nums text-center";
const footCell =
  "border border-border/50 bg-blue-100 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold tabular-nums text-center text-blue-800 dark:text-blue-200";


function ComplianceLedgerCard({
  row,
  locked,
  interval = "DAILY",
  selectedDay = null,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  row: LedgerRow;
  locked: boolean;
  interval?: ModuleInterval;
  selectedDay?: number | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const monthName = MONTHS.find((m) => m.value === row.month)?.name ?? String(row.month);
  const grandTotal = row.totals.inspection + row.totals.fsec + row.totals.fsic + row.totals.notices;
  const lines = React.useMemo(
    () => buildDayLines(row.daily, row.year, row.month, interval, selectedDay, row.monthlyTargets),
    [row.daily, row.year, row.month, interval, selectedDay, row.monthlyTargets],
  );


  const totals = React.useMemo(() => {
    const insp: Record<string, number> = Object.fromEntries(
      INSPECTION_COLS.map((c) => [c.key, 0]),
    );
    const tgt: Record<string, number> = Object.fromEntries(
      INSPECTION_TARGET_COLS.map((c) => [c.key, 0]),
    );
    const manual = emptyMode();
    const fsis = emptyMode();
    for (const l of lines) {
      for (const c of INSPECTION_COLS) insp[c.key] += l.inspection[c.key] ?? 0;
      for (const c of INSPECTION_TARGET_COLS) tgt[c.key] += l.target[c.key] ?? 0;
      for (const c of ISSUANCE_COLS) {
        manual[c.key] += l.manual[c.key] ?? 0;
        fsis[c.key] += l.fsis[c.key] ?? 0;
      }
    }
    return { insp, tgt, manual, fsis };
  }, [lines]);


  return (
    <Card className="flex flex-col overflow-hidden border-border/50 dark:border-border/40 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header — station details */}
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
            <DaysEncodedBadge encoded={row.daysEncoded} total={row.daysInMonth} />
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

      {/* Spreadsheet body — sticky header, sticky totals, scrollable rows */}
      <div className="p-3">
        {lines.length === 0 ? (
          <div className="rounded-xl border border-border/40 p-6 text-center text-xs text-muted-foreground">
            No daily entries for this period.
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-auto rounded-xl border border-border/40">
            <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={3}
                    className={`${headCell} sticky left-0 top-0 z-40 min-w-[9.5rem] border-r-2 border-r-border/60 text-left`}
                  >
                    Date
                  </th>
                  <th
                    colSpan={INSPECTION_PLAIN_COLS.length + INSPECTION_TARGET_COLS.length * 2}
                    className={`${headCell} sticky top-0 z-30 border-r-2 border-r-border/60`}
                  >
                    Inspection
                  </th>
                  <th rowSpan={3} className={`${headCell} sticky top-0 z-30 border-r-2 border-r-border/60`}>
                    Mode of Issuance
                  </th>
                  {ISSUANCE_GROUPS.map((g, idx) => (
                    <th
                      key={g.title}
                      colSpan={g.cols.length}
                      className={`${headCell} sticky top-0 z-30 ${idx < ISSUANCE_GROUPS.length - 1 ? "border-r-2 border-r-border/60" : ""}`}
                    >
                      {g.title}
                    </th>
                  ))}
                </tr>
                <tr>
                  {INSPECTION_PLAIN_COLS.map((c, idx) => (
                    <th
                      key={c.key}
                      rowSpan={2}
                      className={`${headCell} sticky top-[30px] z-30 min-w-[5rem] ${idx === INSPECTION_PLAIN_COLS.length - 1 ? "border-r-2 border-r-border/60" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {INSPECTION_TARGET_COLS.map((c, idx) => (
                    <th
                      key={c.key}
                      colSpan={2}
                      className={`${headCell} sticky top-[30px] z-30 min-w-[10rem] ${idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/60" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {ISSUANCE_COLS.map((c) => (
                    <th
                      key={c.key}
                      rowSpan={2}
                      className={`${headCell} sticky top-[30px] z-30 min-w-[5rem] ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {INSPECTION_TARGET_COLS.map((c, idx) => (
                    <React.Fragment key={c.key}>
                      <th className={`${headCell} sticky top-[60px] z-30 min-w-[5rem] ${idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/60" : ""}`}>Target</th>
                      <th className={`${headCell} sticky top-[60px] z-30 min-w-[5rem] ${idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/60" : ""}`}>
                        Issuance
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>


              <tbody>
                {lines.map((l) => (
                  <React.Fragment key={l.key}>
                    <tr className="bg-card dark:bg-slate-800">
                      <th
                        scope="row"
                        rowSpan={2}
                        className="sticky left-0 z-10 border border-border/40 border-r-2 border-r-border/60 bg-inherit px-2 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap"
                      >
                        {l.label}
                      </th>
                      {INSPECTION_PLAIN_COLS.map((c) => (
                        <td key={c.key} rowSpan={2} className={`${bodyCell} ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                          {(l.inspection[c.key] ?? 0).toLocaleString()}
                        </td>
                      ))}
                      {INSPECTION_TARGET_COLS.map((c) => (
                        <React.Fragment key={c.key}>
                          <td rowSpan={2} className={`${bodyCell} ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                            {(l.target[c.key] ?? 0).toLocaleString()}
                          </td>
                          <td rowSpan={2} className={`${bodyCell} ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                            {(l.inspection[c.key] ?? 0).toLocaleString()}
                          </td>
                        </React.Fragment>
                      ))}

                      <td className={`${bodyCell} border-r-2 border-r-border/60 font-semibold text-blue-700 dark:text-blue-300`}>
                        MANUAL
                      </td>
                      {ISSUANCE_COLS.map((c) => (
                        <td key={c.key} className={`${bodyCell} ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                          {(l.manual[c.key] ?? 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-blue-50 dark:bg-slate-700">
                      <td className={`${bodyCell} border-r-2 border-r-border/60 font-semibold text-blue-700 dark:text-blue-300`}>
                        FSIS
                      </td>
                      {ISSUANCE_COLS.map((c) => (
                        <td key={c.key} className={`${bodyCell} ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                          {(l.fsis[c.key] ?? 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    rowSpan={2}
                    className={`${footCell} sticky bottom-0 left-0 z-40 border-r-2 border-r-border/60 text-left uppercase`}
                  >
                    Total
                  </th>
                  {INSPECTION_PLAIN_COLS.map((c) => (
                    <td key={c.key} rowSpan={2} className={`${footCell} sticky bottom-0 z-30 ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                      {totals.insp[c.key].toLocaleString()}
                    </td>
                  ))}
                  {INSPECTION_TARGET_COLS.map((c) => (
                    <React.Fragment key={c.key}>
                      <td rowSpan={2} className={`${footCell} sticky bottom-0 z-30 ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                        {totals.tgt[c.key].toLocaleString()}
                      </td>
                      <td rowSpan={2} className={`${footCell} sticky bottom-0 z-30 ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                        {totals.insp[c.key].toLocaleString()}
                      </td>
                    </React.Fragment>
                  ))}

                  <td className={`${footCell} sticky bottom-[30px] z-30 border-r-2 border-r-border/60`}>MANUAL</td>
                  {ISSUANCE_COLS.map((c) => (
                    <td key={c.key} className={`${footCell} sticky bottom-[30px] z-30 ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                      {totals.manual[c.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={`${footCell} sticky bottom-0 z-30 border-r-2 border-r-border/60`}>FSIS</td>
                  {ISSUANCE_COLS.map((c) => (
                    <td key={c.key} className={`${footCell} sticky bottom-0 z-30 ${GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/60" : ""}`}>
                      {totals.fsis[c.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tfoot>

            </table>
          </div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground dark:text-slate-400">
          Last updated: {row.lastupdated ? new Date(row.lastupdated).toLocaleString() : "—"}
        </div>
      </div>

      {/* Footer — actions */}
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 dark:border-border/50 bg-muted/10 dark:bg-slate-800/30 p-2">
        <button
          type="button"
          onClick={onView}
          aria-label="View details"
          title="View"
          className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer"
        >
          <Eye className="h-4 w-4" />
        </button>
        {!locked && <EditButton onClick={onEdit} tooltip="Edit" />}
        {!locked && <DeleteButton onClick={onDelete} tooltip="Delete" />}
        <button
          type="button"
          onClick={onMatrix}
          aria-label="Compliance Matrix"
          title="Compliance Matrix"
          className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
