import * as React from "react";
import { BellRing, Eye, Grid3x3, LayoutGrid, Loader2, CalendarDays, Plus, Download } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

import { toast } from "@/lib/toast";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  ModuleFilterBar,
  useModuleFilterState,
  resolveModuleMonths,
} from "@/components/shared/ModuleFilterBar";
import SearchKey from "@/components/search-key";
import PaginationControls from "@/components/pagination";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import SecureDeleteDialog from "@/components/secure-delete-dialog";

import { usePagination } from "@/hooks/usePagination";
import { useAuth, resolveLocationScope } from "@/lib/auth";
import { canManageTargetAndCompliance } from "@/lib/permissions";
import { CurrentMonthNote } from "@/components/shared/CurrentMonthNote";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth } from "@/lib/complianceHelpers";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";

import { NoticeAddModal } from "./components/noticeNew";
import { NoticeEditModal } from "./components/noticeEdit";
import { NoticeViewModal } from "./components/noticeView";
import { NoticeMatrixModal } from "./components/noticeMatrix";

import {
  accomplishedNoticesData,
  computeCategoryRows,
  computeTotals,
  NOTICE_CATEGORIES,
  REPORT_YEARS,
  type AccomplishedNoticeRecord,
  type NoticeCategory,
} from "@/data/05_accomplished_notices";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

/** Notice equivalent of the compliance "days encoded" indicator. */
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

/* ------------------------------- Page ------------------------------- */

export default function AccomplishedNotice() {
  const { user, systemAccess } = useAuth();
  const canManage = React.useMemo(
    () => canManageTargetAndCompliance(user, systemAccess),
    [user, systemAccess],
  );
  // Uniform station-type / role-based scope, identical to Monitoring and Target Reference.
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [records, setRecords] = React.useState<AccomplishedNoticeRecord[]>(accomplishedNoticesData);
  const [searchkey, setSearchkey] = React.useState("");
  const {
    state: filterState,
    set: setFilterState,
    resetState: resetFilterState,
  } = useModuleFilterState();
  const year = filterState.year;
  const selectedMonths = React.useMemo(() => resolveModuleMonths(filterState), [filterState]);
  const monthKey = selectedMonths.join(",");

  const [province, setProvince] = React.useState<string>(
    scope.provinceLocked && scope.provincename ? scope.provincename : "ALL",
  );
  const [station, setStation] = React.useState<string>("ALL");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 12 });

  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AccomplishedNoticeRecord | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [viewTarget, setViewTarget] = React.useState<AccomplishedNoticeRecord | null>(null);
  const [editTarget, setEditTarget] = React.useState<AccomplishedNoticeRecord | null>(null);
  const [matrixTarget, setMatrixTarget] = React.useState<AccomplishedNoticeRecord | null>(null);

  const provinces = React.useMemo(
    () => Array.from(new Set(records.map((r) => r.province))).sort(),
    [records],
  );

  // Re-apply the scope whenever it resolves/changes so locked users can never widen it.
  React.useEffect(() => {
    if (scope.provinceLocked && scope.provincename) setProvince(scope.provincename);
    if (scope.stationLocked && scope.stationname) {
      const match = records.find(
        (r) => r.stationName.toLowerCase() === scope.stationname.toLowerCase(),
      );
      setStation(match ? match.stationCode : "ALL");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.provinceLocked, scope.stationLocked, scope.provincename, scope.stationname, records]);

  const stations = React.useMemo(() => {
    const scoped = records.filter((r) => province === "ALL" || r.province === province);
    const map = new Map<string, string>();
    scoped.forEach((r) => map.set(r.stationCode, r.stationName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [province, records]);

  const filtered = React.useMemo(() => {
    const needle = searchkey.trim().toLowerCase();
    const list = records.filter((r) => {
      if (String(r.reportYear) !== year) return false;
      if (!selectedMonths.includes(Number(r.reportMonth))) return false;
      if (
        scope.provinceLocked &&
        scope.provincename &&
        r.province.toLowerCase() !== scope.provincename.toLowerCase()
      )
        return false;
      if (
        scope.stationLocked &&
        scope.stationname &&
        r.stationName.toLowerCase() !== scope.stationname.toLowerCase()
      )
        return false;
      if (province !== "ALL" && r.province !== province) return false;
      if (station !== "ALL" && r.stationCode !== station) return false;
      if (
        needle &&
        !`${r.stationName} ${r.stationCode} ${r.municipality} ${r.province}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
    list.sort((a, b) => a.stationName.localeCompare(b.stationName));
    return list;
  }, [
    records,
    searchkey,
    year,
    monthKey,
    province,
    station,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provincename,
    scope.stationname,
  ]);

  const total = filtered.length;
  const paged = React.useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  // Mirror the ledger fetch feedback used by the compliance module.
  React.useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 120);
    return () => window.clearTimeout(t);
  }, [year, monthKey, province, station, searchkey, page, pageSize]);

  React.useEffect(() => {
    setPage(1);
  }, [year, monthKey, province, station, searchkey, pageSize, setPage]);

  const handleResetFilters = () => {
    setSearchkey("");
    resetFilterState();
    setProvince(scope.provinceLocked && scope.provincename ? scope.provincename : "ALL");
    if (scope.stationLocked && scope.stationname) {
      const match = records.find(
        (r) => r.stationName.toLowerCase() === scope.stationname.toLowerCase(),
      );
      setStation(match ? match.stationCode : "ALL");
    } else {
      setStation("ALL");
    }
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      setRecords((prev) => prev.filter((item) => item.stationNo !== deleteTarget.stationNo));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async () => {
    if (paged.length === 0) {
      toast.info("No accomplished notices to export.");
      return;
    }
    setExporting(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "FSIMS";
      wb.created = new Date();
      const ws = wb.addWorksheet(`Accomplished Notice ${year}`);

      const categories = ["NOD", "NTC", "NTCV", "Abatement", "Closure"] as const;
      ws.columns = [
        { header: "Station Code", key: "stationCode", width: 16 },
        { header: "Station Name", key: "stationName", width: 32 },
        { header: "Province", key: "province", width: 22 },
        { header: "Municipality", key: "municipality", width: 22 },
        { header: "Year", key: "year", width: 10 },
        { header: "Month", key: "month", width: 12 },
        ...categories.flatMap((cat) => [
          { header: `${cat} Pending`, key: `${cat}Pending`, width: 14 },
          { header: `${cat} Accomplished`, key: `${cat}Accomplished`, width: 16 },
        ]),
        { header: "Total Pending", key: "totalPending", width: 14 },
        { header: "Total Accomplished", key: "totalAccomplished", width: 18 },
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
        let totalPending = 0;
        let totalAccomplished = 0;
        const catRow: Record<string, number> = {};
        for (const cat of categories) {
          const counts = r.breakdown[cat];
          catRow[`${cat}Pending`] = counts.pending;
          catRow[`${cat}Accomplished`] = counts.accomplished;
          totalPending += counts.pending;
          totalAccomplished += counts.accomplished;
        }
        ws.addRow({
          stationCode: r.stationCode,
          stationName: r.stationName,
          province: r.province,
          municipality: r.municipality,
          year: r.reportYear,
          month: MONTHS.find((m) => m.value === r.reportMonth)?.name ?? r.reportMonth,
          ...catRow,
          totalPending,
          totalAccomplished,
        });
      }

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, colNumber) => {
          if (colNumber >= 7) {
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
        `AccomplishedNotice_${year}.xlsx`,
      );
      toast.success("Accomplished Notice exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Accomplished Notice.");
    } finally {
      setExporting(false);
    }
  };

  const handleSaved = (nextRecord: AccomplishedNoticeRecord) => {
    setRecords((prev) =>
      prev.map((item) => (item.stationNo === nextRecord.stationNo ? nextRecord : item)),
    );
  };

  const openMatrixGlobal = () => {
    setMatrixTarget(paged[0] ?? filtered[0] ?? null);
    setMatrixOpen(true);
  };

  const openMatrixForCard = (r: AccomplishedNoticeRecord) => {
    setMatrixTarget(r);
    setMatrixOpen(true);
  };

  const openAdd = () => {
    setAddOpen(true);
  };

  const addTarget = paged[0] ?? filtered[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Accomplished Notice
          </h1>
          <p className="text-xs text-muted-foreground">
            Notice accomplishments grouped by station, month, and year.
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
            <LayoutGrid className="h-4 w-4" /> Notice Matrix
          </Button>
          {canManage && (
            <Button onClick={openAdd} className="w-full justify-center gap-2 sm:w-auto">
              Add Notice
            </Button>
          )}
        </div>
      </div>

      <CurrentMonthNote canManage={canManage} />

      {/* Filters */}
      <ModuleFilterBar
        years={[...REPORT_YEARS]}
        state={filterState}
        onChange={setFilterState}
        onReset={handleResetFilters}
        leading={
          <SearchKey
            value={searchkey}
            onChange={setSearchkey}
            placeholder="Search station or municipality"
          />
        }
      >
        {scope.provinceLocked ? (
          <ReadOnlyField
            value={scope.provincename}
            placeholder="ALL"
            title="Restricted to your assigned province"
          />
        ) : (
          <Select
            value={province}
            onValueChange={(v) => {
              setProvince(v);
              setStation("ALL");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {scope.stationLocked ? (
          <ReadOnlyField
            value={scope.stationname}
            placeholder="ALL"
            title="Restricted to your assigned station"
          />
        ) : (
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {stations.map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ModuleFilterBar>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notice ledger…
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No notice records match the current filters.
        </Card>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {paged.map((r) => (
            <NoticeCard
              key={`${r.stationCode}-${r.reportYear}-${r.reportMonth}`}
              record={r}
              locked={!canManage}
              onView={() => setViewTarget(r)}
              onEdit={() => setEditTarget(r)}
              onDelete={() => setDeleteTarget(r)}
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
        title="Delete Notice Ledger?"
        subject={
          deleteTarget ? (
            <>
              {deleteTarget.stationName} —{" "}
              {MONTHS.find((m) => m.value === deleteTarget.reportMonth)?.name}{" "}
              {deleteTarget.reportYear}
            </>
          ) : null
        }
        description="This removes every daily notice entry for the month. Records can be restored by the administrator."
        confirmLabel="Delete"
        deleting={deleting}
        onConfirm={confirmDelete}
      />

      {addTarget && (
        <NoticeAddModal
          open={addOpen}
          onOpenChange={setAddOpen}
          record={addTarget}
          onSaved={handleSaved}
        />
      )}

      {matrixTarget && (
        <NoticeMatrixModal
          open={matrixOpen}
          onOpenChange={(o) => {
            setMatrixOpen(o);
            if (!o) setMatrixTarget(null);
          }}
          record={matrixTarget}
        />
      )}

      {viewTarget && (
        <NoticeViewModal
          open={!!viewTarget}
          onOpenChange={(o) => !o && setViewTarget(null)}
          record={viewTarget}
        />
      )}

      {editTarget && (
        <NoticeEditModal
          open={!!editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          record={editTarget}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ------------------------------- Card ------------------------------- */

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
}: {
  record: AccomplishedNoticeRecord;
  locked: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const monthName =
    MONTHS.find((m) => m.value === record.reportMonth)?.name ?? String(record.reportMonth);
  const rows = computeCategoryRows(record.breakdown);
  const totals = computeTotals(record.breakdown);
  const byCategory = React.useMemo(() => new Map(rows.map((r) => [r.category, r])), [rows]);

  const daysInMonth = calendarDaysInMonth(record.reportYear, record.reportMonth);
  const daysRecorded = record.dailyEntries.filter((entry) =>
    NOTICE_CATEGORIES.some(
      (c) => entry.breakdown[c].pending > 0 || entry.breakdown[c].accomplished > 0,
    ),
  ).length;

  const formatValue = (metric: NoticeMetric, value: number) =>
    metric === "completionPct" ? `${value.toFixed(0)}%` : value.toLocaleString();

  const sectionTotal = (metric: NoticeMetric) =>
    metric === "completionPct"
      ? `${totals.completionPct.toFixed(0)}%`
      : totals[metric].toLocaleString();

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 dark:border-border/40 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border/40 dark:border-border/50 bg-gradient-to-r from-blue-50 dark:from-slate-700/40 via-blue-50/50 dark:via-slate-700/20 to-transparent dark:to-transparent p-4">
        <AvatarWithFallback
          entity={{ name: record.stationName }}
          src={record.logoUrl || undefined}
          name={record.stationName}
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-blue-200 dark:ring-slate-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {record.stationCode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
              {monthName} {record.reportYear}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-foreground dark:text-slate-100">
            {record.stationName}
          </div>
          <div className="text-[11px] text-muted-foreground dark:text-slate-400">
            {record.municipality} · {record.province}
          </div>
        </div>
        <div
          className="grid h-10 w-14 place-items-center rounded-lg bg-blue-100 dark:bg-slate-600 text-center text-blue-700 dark:text-blue-300"
          title="Total Notices Issued"
        >
          <div className="text-[8px] font-bold uppercase leading-none">Total</div>
          <div className="text-xs font-bold leading-none">{totals.pending.toLocaleString()}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 p-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/60 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-foreground dark:text-slate-100">
              <BellRing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Notice Totals
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DaysRecordedBadge encoded={daysRecorded} total={daysInMonth} />
              <span className="rounded-full bg-blue-100 dark:bg-slate-600 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                {totals.accomplished.toLocaleString()} accomplished
              </span>
            </div>
          </div>
          <div className="border-b border-border/40 dark:border-border/50" />
          <div className="grid gap-3 md:grid-cols-2">
            {[DETAIL_SECTIONS.slice(0, 2), DETAIL_SECTIONS.slice(2, 4)].map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-3">
                {group.map((section) => (
                  <div
                    key={section.metric}
                    className="rounded-xl border border-border/40 dark:border-border/50 bg-card dark:bg-slate-800/50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border/40 dark:border-border/50 bg-blue-50 dark:bg-slate-700/60 px-3 py-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600 dark:text-blue-400">
                        {section.title}
                      </span>
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
                        {sectionTotal(section.metric)}
                      </span>
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {NOTICE_CATEGORIES.map((category, index) => {
                          const value = byCategory.get(category)?.[section.metric] ?? 0;
                          return (
                            <tr
                              key={category}
                              className={
                                index % 2 === 0
                                  ? "bg-card dark:bg-slate-800/30"
                                  : "bg-blue-50/40 dark:bg-slate-700/30"
                              }
                            >
                              <td className="px-3 py-2 text-sm font-medium text-foreground dark:text-slate-200">
                                {CATEGORY_LABEL[category]}
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums ${
                                  value === 0
                                    ? "text-muted-foreground dark:text-slate-500"
                                    : "text-foreground dark:text-slate-100 font-semibold"
                                }`}
                              >
                                {formatValue(section.metric, value)}
                              </td>
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

        <div className="text-[10px] text-muted-foreground dark:text-slate-400">
          Days with entries: {daysRecorded} of {daysInMonth}
        </div>
      </div>

      {/* Footer */}
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
          aria-label="Notice Matrix"
          title="Notice Matrix"
          className="rounded-md p-2 bg-card text-primary border border-border transition-colors hover:bg-primary hover:text-white cursor-pointer"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
