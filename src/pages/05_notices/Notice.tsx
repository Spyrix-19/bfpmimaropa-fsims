import * as React from "react";
import { BellRing, Eye, LayoutGrid, Loader2, CalendarDays, Plus, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { toast } from "@/lib/toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePagination } from "@/hooks/usePagination";
import { useAuth, resolveLocationScope } from "@/lib/auth";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CurrentMonthNote } from "@/components/shared/CurrentMonthNote";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth } from "@/lib/complianceHelpers";
import { ScopedLocationFilterPair } from "@/components/shared/ScopedLocationFilterPair";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolveModuleMonths,
  baseDate,
  isAllDays,
} from "@/components/shared/ModuleFilterBar";
import SearchKey from "@/components/search-key";
import PaginationControls from "@/components/pagination";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import SecureDeleteDialog from "@/components/secure-delete-dialog";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { noticeAPI } from "@/services/noticeAPI";
import { toISODate } from "@/lib/filters";
import type {
  NoticeDetailModel,
  NoticeAccomDetailClass,
  NoticeModel,
  NoticeParamClass,
  NoticeCategory,
  NoticeCategoryCounts,
  NoticeCategoryRow,
} from "@/types/noticeType";
import { NoticeAddModal } from "./components/noticeNew";
import { NoticeEditModal } from "./components/noticeEdit";
import { NoticeViewModal } from "./components/noticeView";
import { NoticeMatrixModal } from "./noticeMatrix";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

function emptyBreakdown(): Record<NoticeCategory, NoticeCategoryCounts> {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: { pending: 0, accomplished: 0 } }),
    {} as Record<NoticeCategory, NoticeCategoryCounts>,
  );
}

function buildBreakdown(source: NoticeAccomDetailClass[] | undefined): Record<NoticeCategory, NoticeCategoryCounts> {
  const totals = emptyBreakdown();
  if (!Array.isArray(source)) return totals;
  source.forEach((entry) => {
    NOTICE_CATEGORIES.forEach((category) => {
      const key = category === "NOD" ? "nodcount" : category === "NTC" ? "ntccount" : category === "NTCV" ? "ntcvcount" : category === "Abatement" ? "abatementcount" : "closurecount";
      const count = Number((entry as Record<string, number | undefined>)[key] ?? 0) || 0;
      totals[category].pending += count;
      totals[category].accomplished += count;
    });
  });
  return totals;
}

function computeCategoryRows(breakdown: Record<NoticeCategory, NoticeCategoryCounts>): NoticeCategoryRow[] {
  return NOTICE_CATEGORIES.map((category) => {
    const { pending, accomplished } = breakdown[category];
    const remaining = Math.max(0, pending - accomplished);
    const completionPct = pending === 0 ? 0 : (accomplished / pending) * 100;
    return { category, pending, accomplished, remaining, completionPct };
  });
}

function computeTotals(breakdown: Record<NoticeCategory, NoticeCategoryCounts>) {
  const rows = computeCategoryRows(breakdown);
  return {
    pending: rows.reduce((sum, row) => sum + row.pending, 0),
    accomplished: rows.reduce((sum, row) => sum + row.accomplished, 0),
    remaining: rows.reduce((sum, row) => sum + row.remaining, 0),
    completionPct: rows.length ? rows.reduce((sum, row) => sum + row.completionPct, 0) / rows.length : 0,
  };
}

interface NoticeDayEntry {
  day: number;
  date: string;
  remarks: string;
  breakdown: Record<NoticeCategory, NoticeCategoryCounts>;
}

export interface NoticeRecord {
  key: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logourl: string;
  province: string;
  municipality: string;
  reportYear: number;
  reportMonth: number;
  breakdown: Record<NoticeCategory, NoticeCategoryCounts>;
  dailyEntries: NoticeDayEntry[];
}

function mapDetailToRecord(detail: NoticeDetailModel, year: number, month: number): NoticeRecord {
  const dailyEntries = (Array.isArray(detail.noticedetallist) ? detail.noticedetallist : []).map((entry, index) => {
    const date = String(entry.dateaccomplish ?? "").slice(0, 10);
    return {
      day: index + 1,
      date,
      remarks: "",
      breakdown: buildBreakdown(entry.noticeaccomlist),
    } satisfies NoticeDayEntry;
  });

  const breakdown = dailyEntries.reduce(
    (acc, entry) => {
      NOTICE_CATEGORIES.forEach((category) => {
        acc[category].pending += entry.breakdown[category].pending;
        acc[category].accomplished += entry.breakdown[category].accomplished;
      });
      return acc;
    },
    emptyBreakdown(),
  );

  return {
    key: `${detail.stationno}|${year}|${month}`,
    stationno: detail.stationno,
    stationcode: detail.stationcode,
    stationname: detail.stationname,
    provinceno: detail.provinceno,
    provincename: detail.provincename,
    cityname: detail.cityname ?? "",
    logourl: detail.logourl ?? "",
    province: detail.provincename,
    municipality: detail.cityname ?? "",
    reportYear: year,
    reportMonth: month,
    breakdown,
    dailyEntries,
  };
}

function DaysRecordedBadge({ encoded, total }: { encoded: number; total: number }) {
  const ratio = total ? encoded / total : 0;
  const tone =
    ratio >= 1 ? "tone-success-soft" : ratio >= 0.25 ? "tone-warning-soft" : "tone-danger-soft";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}
      title="Days with notice entries / calendar days"
    >
      <CalendarDays className="h-3 w-3" />
      {encoded} / {total}
    </span>
  );
}

export default function AccomplishedNotice() {
  const { user, systemAccess } = useAuth();
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess),
    [user, systemAccess],
  );
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const currentYear = new Date().getFullYear();
  const YEARS = React.useMemo(() => Array.from({ length: 5 }, (_, index) => currentYear - index), [currentYear]);

  const { state: filterState, set: setFilterState, resetState: resetFilterState } = useModuleFilterState();
  const year = filterState.year;
  const isAggregated = filterState.interval !== "DAILY";
  const allDates = isAggregated || isAllDays(filterState.date);
  const selectedDateISO = React.useMemo(() => baseDate(filterState.date) || toISODate(new Date()), [filterState.date]);
  const selectedMonths = React.useMemo(
    () => (isAggregated ? resolveModuleMonths(filterState) : [Number(selectedDateISO.slice(5, 7)) || 1]),
    [filterState, isAggregated, selectedDateISO],
  );
  const monthKey = selectedMonths.join(",");
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

  const [provinceno, setProvinceno] = React.useState<string>(scope.provinceLocked ? scope.provinceno : EMPTY_GUID);
  const [provincename, setProvincename] = React.useState<string>(scope.provinceLocked ? scope.provincename : "ALL");
  const [stationno, setStationno] = React.useState<string>(scope.stationLocked ? scope.stationno : EMPTY_GUID);
  const [stationname, setStationname] = React.useState<string>(scope.stationLocked ? scope.stationname : "ALL");

  const [records, setRecords] = React.useState<NoticeRecord[]>([]);
  const [searchkey, setSearchkey] = React.useState("");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 12 });

  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<NoticeRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [viewTarget, setViewTarget] = React.useState<NoticeRecord | null>(null);
  const [editTarget, setEditTarget] = React.useState<NoticeRecord | null>(null);
  const [matrixTarget, setMatrixTarget] = React.useState<NoticeRecord | null>(null);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = () => setRefreshTick((value) => value + 1);

  React.useEffect(() => {
    if (!user) return;
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
  }, [scope.provinceLocked, scope.stationLocked, scope.provinceno, scope.stationno, scope.provincename, scope.stationname, user]);

  const handleProvinceSelect = (locationno: string, locationname: string) => {
    setProvinceno(locationno);
    setProvincename(locationname);
    setStationno(EMPTY_GUID);
    setStationname("ALL");
  };

  const handleStationSelect = (no: string, name: string) => {
    setStationno(no);
    setStationname(name);
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
    setSearchkey("");
    setPage(1);
  };

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const effectiveProvinceNo = scope.provinceLocked ? scope.provinceno : provinceno;
      const effectiveStationNo = scope.stationLocked ? scope.stationno : stationno;
      const provinces: NoticeParamClass[] =
        effectiveProvinceNo && effectiveProvinceNo !== EMPTY_GUID
          ? [{ provinceno: effectiveProvinceNo, stationnos: effectiveStationNo && effectiveStationNo !== EMPTY_GUID ? [effectiveStationNo] : [] }]
          : [];
      const reportmonth = [...selectedMonths];
      const response = await noticeAPI.getLedger(
        {
          parameters: {
            searchkey: searchkey.trim(),
            reportyear: Number(year),
            interval: intervalCode,
            dateaccomplish: allDates ? "" : `${selectedDateISO}T00:00:00`,
            reportmonth,
            provinces,
          } as NoticeModel,
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, signal: controller.signal },
      );
      const { ok, data, error, canceled } = unwrap<NoticeDetailModel[]>(response);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load notice ledger.");
        setRecords([]);
      } else {
        const list = (Array.isArray(data) ? data : []).map((item) => mapDetailToRecord(item, Number(year), Number(selectedMonths[0] ?? 1)));
        setRecords(list);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [year, monthKey, intervalCode, selectedDateISO, allDates, scope.provinceLocked, scope.stationLocked, scope.provinceno, scope.stationno, provinceno, stationno, searchkey, page, pageSize, refreshTick]);

  const filtered = React.useMemo(() => {
    const needle = searchkey.trim().toLowerCase();
    const list = records.filter((record) => {
      if (String(record.reportYear) !== year) return false;
      if (!selectedMonths.includes(record.reportMonth)) return false;
      if (scope.provinceLocked && scope.provincename && record.province.toLowerCase() !== scope.provincename.toLowerCase()) return false;
      if (scope.stationLocked && scope.stationname && record.stationname.toLowerCase() !== scope.stationname.toLowerCase()) return false;
      if (provincename !== "ALL" && record.province !== provincename) return false;
      if (stationname !== "ALL" && record.stationname !== stationname) return false;
      if (needle && !`${record.stationname} ${record.stationcode} ${record.cityname} ${record.province}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    list.sort((a, b) => a.stationname.localeCompare(b.stationname));
    return list;
  }, [records, year, selectedMonths, scope.provinceLocked, scope.provincename, scope.stationLocked, scope.stationname, provincename, stationname, searchkey]);

  const total = filtered.length;
  const paged = React.useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [year, monthKey, provincename, stationname, searchkey, pageSize, setPage]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await noticeAPI.delete(
        {
          stationno: deleteTarget.stationno,
          reportyear: Number(deleteTarget.reportYear),
          reportmonth: Number(deleteTarget.reportMonth),
          deletedby: user?.memberno ?? "anon",
          roleno: Number(systemAccess?.roleno ?? 0) || 0,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, error } = unwrap(response);
      if (!ok) {
        toast.error(error || "Unable to delete notice ledger.");
        return;
      }
      toast.success("Notice ledger deleted.");
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    if (paged.length === 0) {
      toast.info("No notice records to export.");
      return;
    }
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FSIMS";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet(`Notice ${year}`);
      const categories = ["NOD", "NTC", "NTCV", "Abatement", "Closure"] as const;
      worksheet.columns = [
        { header: "Station Code", key: "stationCode", width: 16 },
        { header: "Station Name", key: "stationName", width: 32 },
        { header: "Province", key: "province", width: 22 },
        { header: "Municipality", key: "municipality", width: 22 },
        { header: "Year", key: "year", width: 10 },
        { header: "Month", key: "month", width: 12 },
        ...categories.flatMap((category) => [
          { header: `${category} Pending`, key: `${category}Pending`, width: 14 },
          { header: `${category} Accomplished`, key: `${category}Accomplished`, width: 16 },
        ]),
        { header: "Total Pending", key: "totalPending", width: 14 },
        { header: "Total Accomplished", key: "totalAccomplished", width: 18 },
      ];

      for (const row of paged) {
        let totalPending = 0;
        let totalAccomplished = 0;
        const categoryRow: Record<string, number> = {};
        for (const category of categories) {
          const counts = row.breakdown[category];
          categoryRow[`${category}Pending`] = counts.pending;
          categoryRow[`${category}Accomplished`] = counts.accomplished;
          totalPending += counts.pending;
          totalAccomplished += counts.accomplished;
        }
        worksheet.addRow({
          stationCode: row.stationcode,
          stationName: row.stationname,
          province: row.province,
          municipality: row.municipality,
          year: row.reportYear,
          month: MONTHS.find((month) => month.value === row.reportMonth)?.name ?? row.reportMonth,
          ...categoryRow,
          totalPending,
          totalAccomplished,
        });
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, columnNumber) => {
          if (columnNumber >= 7) {
            cell.numFmt = "#,##0;(#,##0);-";
            cell.alignment = { horizontal: "right" };
          }
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Notice_${year}.xlsx`);
      toast.success("Notice exported.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export Notice.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportRecord = async (record: NoticeRecord) => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "FSIMS";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet(`${record.stationname} ${record.reportYear}`);
      worksheet.columns = [
        { header: "Category", key: "category", width: 18 },
        { header: "Pending", key: "pending", width: 14 },
        { header: "Accomplished", key: "accomplished", width: 16 },
      ];
      NOTICE_CATEGORIES.forEach((category) => {
        const counts = record.breakdown[category];
        worksheet.addRow({ category: CATEGORY_LABEL[category], pending: counts.pending, accomplished: counts.accomplished });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${record.stationcode}_${record.reportYear}_${record.reportMonth}.xlsx`);
      toast.success("Notice item exported.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export Notice item.");
    } finally {
      setExporting(false);
    }
  };

  const addTarget = paged[0] ?? filtered[0] ?? null;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Accomplished Notice
          </h1>
          <p className="text-xs text-muted-foreground">Notice accomplishments grouped by station, month, and year.</p>
        </div>
        <div className={`grid w-full gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center ${canManage ? "grid-cols-3" : "grid-cols-2"}`}>
          <Button variant="outline" onClick={handleExport} disabled={exporting || paged.length === 0} className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          <Button variant="outline" onClick={() => { setMatrixTarget(paged[0] ?? filtered[0] ?? null); setMatrixOpen(true); }} className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto">
            <LayoutGrid className="h-4 w-4" /> Notice Matrix
          </Button>
          {canManage && (
            <Button onClick={() => setAddOpen(true)} className="w-full justify-center gap-2 sm:w-auto">
              <Plus className="h-4 w-4" /> Add Notice
            </Button>
          )}
        </div>
      </div>

      <CurrentMonthNote canManage={canManage} />

      <ModuleFilterBar years={YEARS} state={filterState} onChange={setFilterState} onReset={handleResetFilters} intervals={["DAILY", "MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]} allowAllDays>
        <ScopedLocationFilterPair hideLabels scope={scope} provinceValue={provinceno} provinceLabel={provincename} stationValue={stationno} stationLabel={stationname} onProvinceChange={handleProvinceSelect} onStationChange={handleStationSelect} />
      </ModuleFilterBar>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notice ledger…
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">No notice records match the current filters.</Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {paged.map((record) => (
            <NoticeCard key={record.key} record={record} locked={!canManage} onView={() => setViewTarget(record)} onEdit={() => setEditTarget(record)} onDelete={() => setDeleteTarget(record)} onMatrix={() => { setMatrixTarget(record); setMatrixOpen(true); }} onExport={() => handleExportRecord(record)} />
          ))}
        </div>
      )}

      <div className="border-t border-border/60 pt-3">
        <PaginationControls page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      <SecureDeleteDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)} title="Delete Notice Ledger?" subject={deleteTarget ? <>{deleteTarget.stationname} — {MONTHS.find((month) => month.value === deleteTarget.reportMonth)?.name} {deleteTarget.reportYear}</> : null} description="This removes the notice ledger for the selected station and period." confirmLabel="Delete" deleting={deleting} onConfirm={confirmDelete} />

      {addTarget && <NoticeAddModal open={addOpen} onOpenChange={setAddOpen} record={addTarget} onSaved={refresh} />}
      {matrixTarget && <NoticeMatrixModal open={matrixOpen} onOpenChange={(open) => { setMatrixOpen(open); if (!open) setMatrixTarget(null); }} record={matrixTarget} />}
      {viewTarget && <NoticeViewModal open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)} record={viewTarget} />}
      {editTarget && <NoticeEditModal open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)} record={editTarget} onSaved={refresh} />}
    </div>
  );
}

type NoticeMetric = "pending" | "accomplished" | "remaining" | "completionPct";

const DETAIL_SECTIONS: { title: string; metric: NoticeMetric }[] = [
  { title: "Pending", metric: "pending" },
  { title: "Accomplished", metric: "accomplished" },
  { title: "Remaining", metric: "remaining" },
  { title: "Completion", metric: "completionPct" },
];

function NoticeCard({
  record,
  locked,
  onView,
  onEdit,
  onDelete,
  onMatrix,
  onExport,
}: {
  record: NoticeRecord;
  locked: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
  onExport: () => void;
}) {
  const monthName = MONTHS.find((month) => month.value === record.reportMonth)?.name ?? String(record.reportMonth);
  const rows = computeCategoryRows(record.breakdown);
  const totals = computeTotals(record.breakdown);
  const byCategory = React.useMemo(() => new Map(rows.map((item) => [item.category, item])), [rows]);
  const daysInMonth = calendarDaysInMonth(record.reportYear, record.reportMonth);
  const daysRecorded = record.dailyEntries.filter((entry) => NOTICE_CATEGORIES.some((category) => entry.breakdown[category].pending > 0 || entry.breakdown[category].accomplished > 0)).length;
  const formatValue = (metric: NoticeMetric, value: number) => (metric === "completionPct" ? `${value.toFixed(0)}%` : value.toLocaleString());
  const sectionTotal = (metric: NoticeMetric) => (metric === "completionPct" ? `${totals.completionPct.toFixed(0)}%` : totals[metric].toLocaleString());

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 dark:border-border/40 shadow-soft transition-shadow hover:shadow-elegant">
      <div className="flex items-start gap-3 border-b border-border/40 dark:border-border/50 bg-gradient-to-r from-blue-50 dark:from-slate-700/40 via-blue-50/50 dark:via-slate-700/20 to-transparent dark:to-transparent p-4">
        <AvatarWithFallback entity={{ name: record.stationname }} src={record.logourl || undefined} name={record.stationname} className="h-14 w-14 shrink-0 rounded-full ring-2 ring-blue-200 dark:ring-slate-600" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">{record.stationcode}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">{monthName} {record.reportYear}</span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground dark:text-slate-100">{record.stationname}</div>
          <div className="text-[11px] text-muted-foreground dark:text-slate-400">{record.municipality} · {record.province}</div>
        </div>
        <div className="grid h-10 w-14 place-items-center rounded-lg bg-blue-100 dark:bg-slate-600 text-center text-blue-700 dark:text-blue-300" title="Total Notices Issued">
          <div className="text-[8px] font-bold uppercase leading-none">Total</div>
          <div className="text-xs font-bold leading-none">{totals.pending.toLocaleString()}</div>
        </div>
      </div>
      <div className="flex-1 space-y-3 p-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/60 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-foreground dark:text-slate-100">
              <BellRing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Notice Totals
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DaysRecordedBadge encoded={daysRecorded} total={daysInMonth} />
              <span className="rounded-full bg-blue-100 dark:bg-slate-600 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">{totals.accomplished.toLocaleString()} accomplished</span>
            </div>
          </div>
          <div className="border-b border-border/40 dark:border-border/50" />
          <div className="grid gap-3 md:grid-cols-2">
            {[DETAIL_SECTIONS.slice(0, 2), DETAIL_SECTIONS.slice(2, 4)].map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-3">
                {group.map((section) => (
                  <div key={section.metric} className="rounded-xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/50 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 dark:border-border/50 bg-blue-50 dark:bg-slate-700/60 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">{section.title}</span>
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">{sectionTotal(section.metric)}</span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {NOTICE_CATEGORIES.map((category, index) => {
                          const value = byCategory.get(category)?.[section.metric] ?? 0;
                          return (
                            <tr key={category} className={index % 2 === 0 ? "bg-card dark:bg-slate-800/30" : "bg-blue-50/40 dark:bg-slate-700/30"}>
                              <td className="px-3 py-2 text-sm font-medium text-foreground dark:text-slate-200">{CATEGORY_LABEL[category]}</td>
                              <td className={`px-3 py-2 text-center tabular-nums ${value === 0 ? "text-muted-foreground dark:text-slate-500" : "text-foreground dark:text-slate-100 font-semibold"}`}>{formatValue(section.metric, value)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground dark:text-slate-400">Days with entries: {daysRecorded} of {daysInMonth}</div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 dark:border-border/50 bg-muted/10 dark:bg-slate-800/30 p-2">
        <button type="button" onClick={onView} aria-label="View details" title="View" className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer">
          <Eye className="h-4 w-4" />
        </button>
        {!locked && <EditButton onClick={onEdit} tooltip="Edit" />}
        {!locked && <DeleteButton onClick={onDelete} tooltip="Delete" />}
        <button type="button" onClick={onMatrix} aria-label="Notice Matrix" title="Notice Matrix" className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer">
          <LayoutGrid className="h-4 w-4" />
        </button>
        {!locked && (
          <button type="button" onClick={onExport} aria-label="Export Notice Item" title="Export Item" className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer">
            <Download className="h-4 w-4" />
          </button>
        )}
      </div>
    </Card>
  );
}
