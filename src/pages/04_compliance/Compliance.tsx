import * as React from "react";
import { usePagination } from "@/hooks/usePagination";
import {
  ScopedLocationMultiFilterPair,
  useScopedLocationMulti,
} from "@/components/shared/ScopedLocationMultiFilterPair";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import ComplianceMatrixTable from "./complianceMatrix.tsx";
import { ComplianceViewModal } from "./components/complianceView.tsx";
import { ComplianceEditModal } from "./components/complianceEdit.tsx";
import { InspectionsNewModal } from "./components/complianceNew.tsx";
import TargetAccomplishmentPanel from "./components/TargetAccomplishmentPanel.tsx";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { toISODate } from "@/lib/filters";
import PaginationControls from "@/components/pagination";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  ModuleFilterBar,
  useModuleFilterState,
  baseDate,
  isAllDays,
  resolveModuleMonths,
  resolveSelectedDay,
} from "@/components/shared/ModuleFilterBar";
import { type CompliancePeriod, type ComplianceExportRecord } from "./components/complianceExport";
import { exportComplianceGridWorkbook } from "./components/complianceGridExport";

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
import { isReportMonthLocked } from "@/pages/06_target-reference/helpers";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CurrentMonthNote } from "@/components/shared/CurrentMonthNote";
import {
  CATEGORY_FIELDS,
  calendarDaysInMonth,
  countDaysWithData,
  isValidRecordId,
  normalizeDayKey,
} from "@/lib/complianceHelpers";
import type { ComplianceMonthlyRow, TargetAccomplishmentModel } from "@/types/complianceType";
import type {
  FSISComplianceMonthlyLedgerModel,
  FSISComplianceDailyClass,
  FSISComplianceParamClass,
  FSISIssuanceClassModel,
  FSISComplianceModel,
} from "@/types/complianceType.ts";

// Page-local aliases — the existing DTOs in `types/` are immutable; these
// names keep this file's original semantics without touching type files.
type FSISComplianceMonthlyItem = FSISComplianceMonthlyLedgerModel;
type FSISComplianceLedgerDailyItem = FSISComplianceDailyClass &
  Partial<FSISIssuanceClassModel> & { dateinspected?: string | Date };
import type { SearchStationModel } from "@/types/stationTypes";

function getComplianceList(station: unknown): FSISComplianceModel["compliancelist"] {
  if (!station || typeof station !== "object") return [];
  const value = station as {
    compliancelist?: FSISComplianceModel["compliancelist"];
    complianceList?: FSISComplianceModel["compliancelist"];
  };
  if (Array.isArray(value.compliancelist)) return value.compliancelist;
  return Array.isArray(value.complianceList) ? value.complianceList : [];
}

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
 * Converts a `FSISComplianceMonthlyItem` (station-month row from the
 * compliance monthly ledger response) into the `ComplianceMonthlyRow` shape
 * the existing ComplianceCard already consumes. Every count sums the daily
 * entries in `complianceLedgerList`.
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
  daily: FSISComplianceLedgerDailyItem[],
  map: Readonly<Record<string, string>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const uiKey of Object.keys(map)) {
    const apiKey = map[uiKey] as keyof FSISComplianceLedgerDailyItem;
    let total = 0;
    for (const d of daily) total += Number(d?.[apiKey] ?? 0) || 0;
    out[uiKey] = total;
  }
  return out;
}

export type LedgerRow = ComplianceMonthlyRow & {
  daily?: FSISComplianceLedgerDailyItem[];
};

function mapMonthlyItemToRow(
  item: FSISComplianceMonthlyItem,
  fallbackYear = 0,
  fallbackMonth = 0,
): LedgerRow {
  const daily = Array.isArray(item.complianceLedgerList) ? item.complianceLedgerList : [];
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

  // Count from the same actual values rendered by the ledger. API responses
  // can expose identifiers and nested issuance arrays with different casing,
  // so resolve those aliases without allowing daily targets to count a day.
  const hasNonZeroCounts = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    return Object.entries(value as Record<string, unknown>).some(([key, fieldValue]) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === "issuancelist" && Array.isArray(fieldValue)) {
        return fieldValue.some(hasNonZeroCounts);
      }
      return normalizedKey.endsWith("count") && (Number(fieldValue ?? 0) || 0) !== 0;
    });
  };
  const rowHasData = (d: FSISComplianceLedgerDailyItem) => {
    const record = d as unknown as Record<string, unknown>;
    const fsisno = record.fsisno ?? record.fsisNo ?? record.fsisNO;
    return isValidRecordId(fsisno) || hasNonZeroCounts(d);
  };

  const encodedDays = countDaysWithData(daily, (d) => d.dateinspected, rowHasData);
  let latestDate = "";
  for (const d of daily) {
    const iso = normalizeDayKey(d.dateinspected);
    if (!iso) continue;
    if (!rowHasData(d)) continue;
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
    daysEncoded: encodedDays,
    daysInMonth: year && month ? calendarDaysInMonth(year, month) : 0,
    totals,
    breakdown,
    lastupdated: latestDate,
    daily,
  };
}

/* The FSISCompliance Ledger returns the dailytarget* fields inline, so no
 * secondary target enrichment pass is needed. */

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
  /** Every period except DAILY renders aggregated lines for its own interval. */
  const isAggregated = filterState.interval !== "DAILY";
  /** DAILY: either one specific date, or ALL dates of the browsed month. */
  const allDates = isAggregated || isAllDays(filterState.date);
  const selectedDateISO = React.useMemo(
    () => baseDate(filterState.date) || toISODate(new Date()),
    [filterState.date],
  );
  /**
   * MONTHLY / QUARTERLY / SEMESTER / ANNUAL: every month the period covers.
   * DAILY: the month of the browsed date.
   */
  const selectedMonths = React.useMemo(
    () =>
      isAggregated ? resolveModuleMonths(filterState) : [Number(selectedDateISO.slice(5, 7)) || 1],
    [isAggregated, filterState, selectedDateISO],
  );
  const monthsKey = selectedMonths.join(",");
  const month = String(selectedMonths[0] ?? 1);

  /** Workbook period label — mirrors the Target Reference export contract. */
  const exportPeriod: CompliancePeriod =
    filterState.interval === "SEMESTER"
      ? "SEMI-ANNUAL"
      : (filterState.interval as CompliancePeriod);

  /** Backend interval code: 1 Daily, 2 Monthly, 3 Quarterly, 4 Semester, 5 Annual. */
  const intervalCode = React.useMemo(() => {
    switch (filterState.interval) {
      case "DAILY":
        return 1;
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

  /** Header caption for aggregated cards, e.g. "Q1 2026" or "Jan – Mar 2026". */
  const periodLabel = React.useMemo(() => {
    if (!isAggregated) return null;
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
  }, [
    isAggregated,
    filterState.interval,
    filterState.quarter,
    filterState.semester,
    selectedMonths,
    year,
  ]);

  const ledgerGranularity: LedgerGranularity = React.useMemo(() => {
    switch (filterState.interval) {
      case "QUARTERLY":
        return "quarter";
      case "SEMESTER":
        return "semester";
      case "ANNUAL":
        return "annual";
      case "MONTHLY":
        return "month";
      default:
        return "day";
    }
  }, [filterState.interval]);

  const locationSel = useScopedLocationMulti(scope);
  const {
    provinceno,
    provincename,
    stationno,
    stationname,
    paramsKey: locationParamsKey,
  } = locationSel;
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const [rows, setRows] = React.useState<LedgerRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = () => setRefreshTick((t) => t + 1);

  const [deleteTarget, setDeleteTarget] = React.useState<ComplianceMonthlyRow | null>(null);
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
  const [viewTarget, setViewTarget] = React.useState<ComplianceMonthlyRow | null>(null);
  const [editTarget, setEditTarget] = React.useState<ComplianceMonthlyRow | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const openMatrixGlobal = () => {
    setMatrixTarget(null);
    setMatrixOpen(true);
  };
  const openMatrixForCard = (r: ComplianceMonthlyRow) => {
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

  const handleResetFilters = () => {
    resetFilterState();
    locationSel.reset();
    setPage(1);
  };

  // Fetch ledger from server-side endpoint. Ensure empty/ALL filters
  // are sent as `EMPTY_GUID` so the backend receives explicit GUIDs.
  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const provinces = JSON.parse(locationParamsKey) as FSISComplianceParamClass[];
      // DAILY: interval 1. Specific date -> `dateinspected`; ALL dates -> empty.
      // MONTHLY: interval 2, no specific date, every selected month is plotted.
      const dateinspected = allDates ? "" : `${selectedDateISO}T00:00:00`;

      const reportmonth = [...selectedMonths];
      const resp = await complianceAPI.getLedger(
        {
          parameters: {
            searchkey: "",
            reportyear: Number(year),
            interval: intervalCode,
            targetdate: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
            dateinspected,
            reportmonth,
            provinces,
          },
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, signal: controller.signal },
      );

      const { ok, data, total: apiTotal, error, canceled } = unwrap<FSISComplianceModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load monthly compliance ledger.");
        setRows([]);
        setTotal(0);
      } else {
        const monthSet = new Set(selectedMonths);
        const normalizeRec = (rec: unknown) => {
          const r = rec as Record<string, unknown>;
          return {
            ...(rec as object),
            fsisno: String(r.fsisno ?? r.fsisNo ?? r.fsisNO ?? ""),
            dailytargetbplo: Number(r.dailytargetbplo ?? 0) || 0,
            dailytargetgov: Number(r.dailytargetgov ?? 0) || 0,
            dailytargetpeza: Number(r.dailytargetpeza ?? 0) || 0,
            dailytargettieza: Number(r.dailytargettieza ?? 0) || 0,
            inspectduringcount: Number(r.inspectduringcount ?? 0) || 0,
            inspectaftercount: Number(r.inspectaftercount ?? 0) || 0,
            inspectbplocount: Number(r.inspectbplocount ?? 0) || 0,
            inspectgovcount: Number(r.inspectgovcount ?? 0) || 0,
            inspectpezacount: Number(r.inspectpezacount ?? 0) || 0,
            inspecttiezacount: Number(r.inspecttiezacount ?? 0) || 0,
            remarks: String(r.remarks ?? ""),
            dateinspected: String(r.dateinspected ?? ""),
            issuancelist: Array.isArray(r.issuancelist)
              ? (r.issuancelist as unknown[])
              : Array.isArray(r.issuanceList)
                ? (r.issuanceList as unknown[])
                : [],
          };
        };

        const stations = Array.isArray(data) ? data : [];
        const baseItem = (st: FSISComplianceModel, itemMonth: number) => ({
          stationno: String(st.stationno ?? ""),
          stationcode: String(st.stationcode ?? ""),
          stationname: String(st.stationname ?? ""),
          regionno: "",
          regioncode: "",
          regionname: "",
          provinceno: String(st.provinceno ?? ""),
          provincename: String(st.provincename ?? ""),
          cityno: "",
          zipcode: "",
          cityname: String(st.cityname ?? ""),
          barangayno: "",
          barangayname: "",
          streetaddress: "",
          logourl: String(st.logourl ?? ""),
          month: itemMonth,
          year: Number(year),
          totaltargetbplo: 0,
          totaltargetgov: 0,
          totaltargetpeza: 0,
          totaltargettieza: 0,
          totalAccomplishmentbplo: 0,
          totalAccomplishmentgov: 0,
          totalAccomplishmentpeza: 0,
          totalAccomplishmenttieza: 0,
          updatedby: "",
          encodedby: "",
          complianceLedgerList: [] as FSISComplianceMonthlyLedgerModel["complianceLedgerList"],
        });

        type LedgerItem = ReturnType<typeof baseItem>;
        const items: LedgerItem[] = [];

        if (isAggregated) {
          // One card per station covering the whole period; the ledger below
          // renders one summed line per month.
          for (const st of stations) {
            const item = baseItem(st, Number(month));
            for (const rec of getComplianceList(st)) {
              const iso = String(rec?.dateinspected ?? "").slice(0, 10);
              if (!iso || iso.startsWith("1900")) continue;
              const m = Number(iso.slice(5, 7)) || 0;
              if (!m || !monthSet.has(m)) continue;
              item.complianceLedgerList.push(
                normalizeRec(
                  rec,
                ) as FSISComplianceMonthlyLedgerModel["complianceLedgerList"][number],
              );
            }
            items.push(item);
          }
        } else {
          // Specific date: bind only that date. ALL dates: keep every record
          // returned for the browsed month.
          for (const st of stations) {
            const item = baseItem(st, Number(month));
            item.complianceLedgerList = getComplianceList(st)
              .filter(
                (rec) =>
                  allDates || String(rec?.dateinspected ?? "").slice(0, 10) === selectedDateISO,
              )
              .map(normalizeRec) as FSISComplianceMonthlyLedgerModel["complianceLedgerList"];
            items.push(item);
          }
        }

        const mapped = items.map((it) => {
          const mappedRow = mapMonthlyItemToRow(it, Number(year), it.month);
          if (!isAggregated) return mappedRow;
          return {
            ...mappedRow,
            key: `${it.stationno}|${year}|${monthsKey}`,
            // Encoding coverage spans every month in the selected period.
            daysInMonth: selectedMonths.reduce(
              (acc, m) => acc + calendarDaysInMonth(Number(year), m),
              0,
            ),
          };
        });
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
    monthsKey,
    isAggregated,
    intervalCode,
    selectedDateISO,
    allDates,

    locationParamsKey,
    refreshTick,
    page,
    pageSize,
  ]);

  React.useEffect(() => {
    setPage(1);
  }, [
    year,
    monthsKey,
    isAggregated,
    selectedDateISO,
    allDates,
    locationParamsKey,
    pageSize,
    setPage,
  ]);

  // Server-side ledger returns a single page — use `rows` directly and
  // rely on `total` for pagination controls.
  const paged = React.useMemo(() => rows, [rows]);

  const monthLocked = isReportMonthLocked(Number(year), Number(month));

  // Effective GUIDs for the Target vs. Accomplishment panel.
  const effectiveStationNo = scope.stationLocked ? scope.stationno : stationno;
  const panelStationNo =
    effectiveStationNo && effectiveStationNo !== EMPTY_GUID ? effectiveStationNo : undefined;

  /* ---------------- Target vs. Accomplishment (specific day only) ----------------
   * Rendered only when: DAILY with a specific date, exactly one station selected,
   * and the user is Personnel (roleno 3) at a station type of 28/29/30/31.
   * Its data comes from the dedicated TargetAccomplishment endpoint. */
  const showTargetPanel = Boolean(!allDates && selectedDateISO && panelStationNo && canManage);
  const [panelData, setPanelData] = React.useState<TargetAccomplishmentModel | null>(null);
  const [panelLoading, setPanelLoading] = React.useState(false);

  React.useEffect(() => {
    if (!showTargetPanel || !panelStationNo || !selectedDateISO) {
      setPanelData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setPanelLoading(true);
      const resp = await complianceAPI.getTargetAccomplishment(
        { stationno: panelStationNo, dateinspected: `${selectedDateISO}T00:00:00` },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<TargetAccomplishmentModel | TargetAccomplishmentModel[]>(resp);
      if (cancelled) return;
      const model = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
      setPanelData(ok ? model : null);
      setPanelLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [showTargetPanel, panelStationNo, selectedDateISO, refreshTick]);

  const askDelete = (r: ComplianceMonthlyRow) => setDeleteTarget(r);
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
        toast.error(error || "Unable to delete monthly compliance.");
        return;
      }
      toast.success("Monthly compliance deleted.");
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const provinces = locationSel.provinceParams;

      const resp = await complianceAPI.getLedger(
        {
          parameters: {
            searchkey: "",
            reportyear: Number(year),
            interval: intervalCode,
            targetdate: `${year}-${String(month).padStart(2, "0")}-01T00:00:00`,
            dateinspected: allDates ? "" : `${selectedDateISO}T00:00:00`,
            reportmonth: [...selectedMonths],
            provinces,
          },
          pagenumber: 0,
          pagesize: 0,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );

      const { ok, data, error } = unwrap<FSISComplianceModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export compliance records.");
        return;
      }

      const exportRows = Array.isArray(data) ? data : [];
      if (exportRows.length === 0) {
        toast.info("No compliance records to export.");
        return;
      }

      await exportComplianceGridWorkbook({
        year: Number(year),
        interval: exportPeriod,
        selectedMonths: [...selectedMonths],
        quarter: filterState.quarter,
        semester: filterState.semester,
        selectedDay: allDates ? null : Number(selectedDateISO.slice(8, 10)) || null,
        groups: exportRows.map((row) => ({
          province: row.provincename ?? "",
          stationCode: row.stationcode ?? "",
          stationName: row.stationname ?? "",
          compliancelist: (Array.isArray(row.compliancelist)
            ? row.compliancelist
            : []) as ComplianceExportRecord[],
        })),
        signatory: {
          rank: user?.rankcode ?? user?.rankname ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: user?.designation ?? "",
        },
      });

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
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
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
        intervals={["DAILY", "MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
        allowAllDays
      >
        <ScopedLocationMultiFilterPair
          scope={scope}
          selection={locationSel}
          reportyear={Number(year)}
        />
      </ModuleFilterBar>

      {/* Target vs. Accomplishment — specific day + single station + Personnel only */}
      {showTargetPanel && (
        <TargetAccomplishmentPanel
          stationno={panelStationNo}
          year={Number(year)}
          month={Number(month)}
          variant="daily"
          data={panelLoading ? null : panelData}
          periodLabel={selectedDateISO ?? undefined}
        />
      )}

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />{" "}
          {isAggregated ? "Loading compliance…" : "Loading daily compliance…"}
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          {isAggregated
            ? "No compliance records for the selected period."
            : allDates
              ? "No compliance records for the selected month."
              : "No compliance records for the selected date."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {paged.map((r) => (
            <ComplianceLedgerCard
              key={r.key}
              row={r}
              dateISO={allDates ? null : selectedDateISO}
              groupBy={ledgerGranularity}
              periodLabel={periodLabel}
              locked={!canManage}

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
        title="Delete Monthly Compliance?"
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

      <ComplianceMatrixTable
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
        <ComplianceViewModal
          open={!!viewTarget}
          onOpenChange={(o) => !o && setViewTarget(null)}
          stationno={viewTarget.stationno}
          year={viewTarget.year}
          month={viewTarget.month}
          stationName={viewTarget.stationname}
          onEdit={
            canManage
              ? (y, m) => {
                  const t = viewTarget;
                  setViewTarget(null);
                  setEditTarget({ ...t, year: y, month: m });
                }
              : undefined
          }
        />
      )}

      {editTarget && (
        <ComplianceEditModal
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
  { key: "inspectbplocount", label: "BPLO" },
  { key: "inspectgovcount", label: "GOV" },
  { key: "inspectpezacount", label: "PEZA" },
  { key: "inspecttiezacount", label: "TIEZA" },
];

/** Inspection columns rendered as a single value (no TARGET sub-column). */
const INSPECTION_PLAIN_COLS: LedgerCol[] = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
];

/** Inspection columns rendered as a TARGET / 1ST / RE group. */
const INSPECTION_TARGET_COLS: (LedgerCol & { targetKey: string; reKey: string })[] = [
  { key: "inspectbplocount", label: "BPLO", targetKey: "dailytargetbplo", reKey: "reinspectbplocount" },
  { key: "inspectgovcount", label: "GOV", targetKey: "dailytargetgov", reKey: "reinspectgovcount" },
  { key: "inspectpezacount", label: "PEZA", targetKey: "dailytargetpeza", reKey: "reinspectpezacount" },
  { key: "inspecttiezacount", label: "TIEZA", targetKey: "dailytargettieza", reKey: "reinspecttiezacount" },
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
    title: "Issued Notices",
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
  "fsectiezacount",
  "fsicoccupancycount",
]);

const STRONG_RIGHT_BORDER_KEYS = new Set([
  ...GROUP_END_KEYS,
  "fsicbplonewcount",
  "fsicbplorenewcount",
  "fsicgovcount",
  "fsicpezacount",
]);

const num = (v: unknown) => Number(v ?? 0) || 0;

type ModeCounts = Record<string, number>;

interface DayLine {
  key: string;
  label: string;
  inspection: Record<string, number>;
  reinspection: Record<string, number>;
  /** Daily target per inspection group (presentation only, sourced from the same payload). */
  target: Record<string, number>;
  manual: ModeCounts;
  fsis: ModeCounts;
}

type LedgerGranularity = "day" | "month" | "quarter" | "semester" | "annual";

const emptyMode = (): ModeCounts =>
  Object.fromEntries(ISSUANCE_COLS.map((c) => [c.key, 0])) as ModeCounts;

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

/** `yyyy-mm` -> "January 2026". */
const monthLabel = (ym: string) => {
  const m = Number(ym.slice(5, 7)) || 0;
  const name = MONTHS.find((x) => x.value === m)?.name ?? ym.slice(5, 7);
  return `${name} ${ym.slice(0, 4)}`;
};

const emptyLine = (key: string, label: string): DayLine => ({
  key,
  label,
  inspection: Object.fromEntries(INSPECTION_COLS.map((c) => [c.key, 0])),
  reinspection: Object.fromEntries(INSPECTION_TARGET_COLS.map((c) => [c.key, 0])),
  target: Object.fromEntries(INSPECTION_TARGET_COLS.map((c) => [c.key, 0])),
  manual: emptyMode(),
  fsis: emptyMode(),
});


/**
 * Presentation-only: binds the API records into MANUAL / FSIS lines.
 * `groupBy: "day"` — one line per date (or just `dateISO` when provided).
 * Aggregated intervals use one summed line per month, quarter, semester, or year.
 */
function buildDayLines(
  daily: FSISComplianceLedgerDailyItem[] | undefined,
  dateISO: string | null,
  groupBy: LedgerGranularity = "day",
): DayLine[] {
  const byKey = new Map<string, DayLine>();

  for (const rec of Array.isArray(daily) ? daily : []) {
    const iso = String(rec?.dateinspected ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;
    if (groupBy === "day" && dateISO && iso !== dateISO) continue;

    const recordMonth = Number(iso.slice(5, 7)) || 1;
    const recordYear = iso.slice(0, 4);
    const key =
      groupBy === "month"
        ? iso.slice(0, 7)
        : groupBy === "quarter"
          ? `${recordYear}-q${Math.ceil(recordMonth / 3)}`
          : groupBy === "semester"
            ? `${recordYear}-s${recordMonth <= 6 ? 1 : 2}`
            : groupBy === "annual"
              ? recordYear
              : iso;
    let line = byKey.get(key);
    if (!line) {
      const label =
        groupBy === "month"
          ? monthLabel(iso)
          : groupBy === "quarter"
            ? `Q${Math.ceil(recordMonth / 3)} ${recordYear}`
            : groupBy === "semester"
              ? `${recordMonth <= 6 ? "1st" : "2nd"} Semester ${recordYear}`
              : groupBy === "annual"
                ? `Annual ${recordYear}`
                : dayLabel(iso);
      line = emptyLine(key, label);
      byKey.set(key, line);
    }

    const issuances = Array.isArray(rec?.issuancelist) ? rec.issuancelist : [];
    if (issuances.length) {
      for (const iss of issuances) {
        const isFsis = num(iss?.fsicmode) === 97;
        const target = isFsis ? line.fsis : line.manual;
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
    for (const c of INSPECTION_TARGET_COLS) {
      line.target[c.key] += num((rec as unknown as Record<string, unknown>)?.[c.targetKey]);
      line.reinspection[c.key] += num((rec as unknown as Record<string, unknown>)?.[c.reKey]);
    }
  }

  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, l]) => l);
}

const headCell =
  "border-b border-border/40 bg-blue-50/90 dark:bg-slate-800/95 backdrop-blur-sm px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-blue-700/90 dark:text-blue-300/90 whitespace-nowrap text-center";
const bodyCell =
  "border-b border-border/25 px-2.5 py-1.5 text-xs tabular-nums text-center text-foreground/90";
const footCell =
  "border-t border-border/50 bg-blue-100/90 dark:bg-slate-800/95 backdrop-blur-sm px-2.5 py-2 text-xs font-bold tabular-nums text-center text-blue-800 dark:text-blue-200";

/** Numeric cell content — zeros are muted so real activity stands out while still readable. */
function N({ v }: { v: number }) {
  return v ? (
    <span className="font-medium">{v.toLocaleString()}</span>
  ) : (
    <span className="text-muted-foreground">0</span>
  );
}


function ComplianceLedgerCard({
  row,
  locked,
  dateISO,
  groupBy = "day",
  periodLabel = null,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  row: LedgerRow;
  locked: boolean;
  /** A specific calendar date (yyyy-mm-dd), or null to render all dates. */
  dateISO: string | null;
  /** Ledger row granularity follows the selected reporting interval. */
  groupBy?: LedgerGranularity;
  /** Caption for aggregated periods; falls back to the row's month + year. */
  periodLabel?: string | null;

  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const monthName = MONTHS.find((m) => m.value === row.month)?.name ?? String(row.month);
  const grandTotal = row.totals.inspection + row.totals.fsec + row.totals.fsic + row.totals.notices;
  const lines = React.useMemo(
    () => buildDayLines(row.daily, dateISO, groupBy),
    [row.daily, dateISO, groupBy],
  );

  const twoRows = true;

  const totals = React.useMemo(() => {
    const insp: Record<string, number> = Object.fromEntries(INSPECTION_COLS.map((c) => [c.key, 0]));
    const tgt: Record<string, number> = Object.fromEntries(
      INSPECTION_TARGET_COLS.map((c) => [c.key, 0]),
    );
    const re: Record<string, number> = Object.fromEntries(
      INSPECTION_TARGET_COLS.map((c) => [c.key, 0]),
    );
    const manual = emptyMode();
    const fsis = emptyMode();
    for (const l of lines) {
      for (const c of INSPECTION_COLS) insp[c.key] += l.inspection[c.key] ?? 0;
      for (const c of INSPECTION_TARGET_COLS) {
        tgt[c.key] += l.target[c.key] ?? 0;
        re[c.key] += l.reinspection[c.key] ?? 0;
      }
      for (const c of ISSUANCE_COLS) {
        manual[c.key] += l.manual[c.key] ?? 0;
        fsis[c.key] += l.fsis[c.key] ?? 0;
      }
    }
    return { insp, tgt, re, manual, fsis };
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
              {periodLabel ?? `${monthName} ${row.year}`}
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
            {groupBy === "day"
              ? "No daily entries for this period."
              : "No entries for this period."}
          </div>
        ) : (
          <div className="max-h-[26rem] overflow-auto rounded-xl border border-border/40 bg-card shadow-inner">
            <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={3}
                    className={`${headCell} sticky left-0 top-0 z-40 min-w-[9.5rem] h-[34px] border-r border-r-border/50 text-left shadow-[2px_0_6px_-4px_hsl(var(--foreground)/0.35)]`}
                  >
                    {groupBy === "day" ? "Date" : groupBy === "month" ? "Month" : "Period"}
                  </th>
                  <th
                    colSpan={INSPECTION_PLAIN_COLS.length + INSPECTION_TARGET_COLS.length * 3}
                    className={`${headCell} sticky top-0 z-30 h-[34px] border-r-2 border-r-border/80`}
                  >
                    Inspection
                  </th>
                  <th
                    rowSpan={3}
                    className={`${headCell} sticky top-0 z-30 h-[34px] border-r-2 border-r-border/80`}
                  >
                    Mode of Issuance
                  </th>
                  {ISSUANCE_GROUPS.map((g, idx) => (
                    <th
                      key={g.title}
                      colSpan={g.cols.length}
                      className={`${headCell} sticky top-0 z-30 ${idx < ISSUANCE_GROUPS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
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
                      className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] ${idx === 0 || idx === INSPECTION_PLAIN_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {INSPECTION_TARGET_COLS.map((c, idx) => (
                    <th
                      key={c.key}
                      colSpan={3}
                      className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[10rem] ${idx < INSPECTION_TARGET_COLS.length - 1 || idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  {ISSUANCE_COLS.map((c) => (
                    <th
                      key={c.key}
                      rowSpan={2}
                      className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] ${c.key === "closurecount" ? "border-r-2 border-r-border" : STRONG_RIGHT_BORDER_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {INSPECTION_TARGET_COLS.map((c, idx) => (
                    <React.Fragment key={c.key}>
                      <th
                        title="Target"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                      >
                        <span className="block leading-[1.1]">TARGET</span>
                      </th>
                      <th
                        title="1st Inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                      >
                        <span className="block leading-[1.1]">1ST</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>
                      <th
                        title="Re-inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center border-r-2 border-r-border/80`}
                      >
                        <span className="block leading-[1.1]">RE-</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>


              <tbody>
                {lines.map((l) => (
                  <React.Fragment key={l.key}>
                    <tr className="group bg-card even:bg-muted/20 dark:bg-slate-800 dark:even:bg-slate-800/70 transition-colors hover:bg-blue-50/70 dark:hover:bg-slate-700/60">
                      <th
                        scope="row"
                        rowSpan={twoRows ? 2 : 1}
                        className="sticky left-0 z-10 border-b border-border/25 border-r border-r-border/50 bg-inherit px-2.5 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap shadow-[2px_0_6px_-4px_hsl(var(--foreground)/0.35)]"
                      >
                        {l.label}
                      </th>
                      {INSPECTION_PLAIN_COLS.map((c, idx) => (
                        <td
                          key={c.key}
                          rowSpan={twoRows ? 2 : 1}
                          className={`${bodyCell} ${idx === 0 || idx === INSPECTION_PLAIN_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                        >
                          <N v={l.inspection[c.key] ?? 0} />
                        </td>
                      ))}
                      {INSPECTION_TARGET_COLS.map((c, idx) => (
                        <React.Fragment key={c.key}>
                          <td
                            rowSpan={twoRows ? 2 : 1}
                            className={`${bodyCell}`}
                          >
                            <N v={l.target[c.key] ?? 0} />
                          </td>
                          <td
                            rowSpan={twoRows ? 2 : 1}
                            className={`${bodyCell}`}
                          >
                            <N v={l.inspection[c.key] ?? 0} />
                          </td>
                          <td
                            rowSpan={twoRows ? 2 : 1}
                            className={`${bodyCell} ${idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : idx < INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                          >
                            <N v={l.reinspection[c.key] ?? 0} />
                          </td>
                        </React.Fragment>
                      ))}

                      <td
                        className={`${bodyCell} border-r-2 border-r-border/80 font-semibold text-blue-700 dark:text-blue-300`}
                      >
                        <span className="rounded bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[9px] tracking-wider">MANUAL</span>
                      </td>
                      {ISSUANCE_COLS.map((c) => (
                        <td
                          key={c.key}
                          className={`${bodyCell} ${c.key === "closurecount" ? "border-r-2 border-r-border/80" : STRONG_RIGHT_BORDER_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                        >
                          <N v={l.manual[c.key] ?? 0} />
                        </td>
                      ))}
                    </tr>
                    {twoRows && (
                      <tr className="group bg-blue-50/60 dark:bg-slate-700/70 transition-colors hover:bg-blue-50 dark:hover:bg-slate-700">
                        <td
                          className={`${bodyCell} border-r-2 border-r-border/80 font-semibold text-blue-700 dark:text-blue-300`}
                        >
                          <span className="rounded bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[9px] tracking-wider">FSIS</span>
                        </td>
                        {ISSUANCE_COLS.map((c) => (
                          <td
                            key={c.key}
                            className={`${bodyCell} ${c.key === "closurecount" ? "border-r-2 border-r-border/80" : STRONG_RIGHT_BORDER_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                          >
                            <N v={l.fsis[c.key] ?? 0} />
                          </td>
                        ))}
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th
                    scope="row"
                    rowSpan={twoRows ? 2 : 1}
                    className={`${footCell} sticky bottom-0 left-0 z-40 border-r border-r-border/50 text-left uppercase`}
                  >
                    Total
                  </th>
                  {INSPECTION_PLAIN_COLS.map((c, idx) => (
                    <td
                      key={c.key}
                      rowSpan={twoRows ? 2 : 1}
                      className={`${footCell} sticky bottom-0 z-30 ${idx === 0 || idx === INSPECTION_PLAIN_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      <N v={totals.insp[c.key]} />
                    </td>
                  ))}
                  {INSPECTION_TARGET_COLS.map((c, idx) => (
                    <React.Fragment key={c.key}>
                      <td
                        rowSpan={twoRows ? 2 : 1}
                        className={`${footCell} sticky bottom-0 z-30`}
                      >
                        <N v={totals.tgt[c.key]} />
                      </td>
                      <td
                        rowSpan={twoRows ? 2 : 1}
                        className={`${footCell} sticky bottom-0 z-30`}
                      >
                        <N v={totals.insp[c.key]} />
                      </td>
                      <td
                        rowSpan={twoRows ? 2 : 1}
                        className={`${footCell} sticky bottom-0 z-30 ${idx < INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                      >
                        <N v={totals.re[c.key]} />
                      </td>
                    </React.Fragment>
                  ))}

                  <td
                    className={`${footCell} sticky bottom-[30px] z-30 border-r-2 border-r-border/80`}
                  >
                    MANUAL
                  </td>
                  {ISSUANCE_COLS.map((c) => (
                    <td
                      key={c.key}
                      className={`${footCell} sticky bottom-[30px] z-30 ${c.key === "closurecount" ? "border-r-2 border-r-border/80" : STRONG_RIGHT_BORDER_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      <N v={totals.manual[c.key]} />
                    </td>
                  ))}
                </tr>
                {twoRows && (
                  <tr>
                    <td
                      className={`${footCell} sticky bottom-0 z-30 border-r-2 border-r-border/80`}
                    >
                      FSIS
                    </td>
                    {ISSUANCE_COLS.map((c) => (
                      <td
                        key={c.key}
                        className={`${footCell} sticky bottom-0 z-30 ${c.key === "closurecount" ? "border-r-2 border-r-border/80" : GROUP_END_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                      >
                        <N v={totals.fsis[c.key]} />
                      </td>
                    ))}
                  </tr>
                )}
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
