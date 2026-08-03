import * as React from "react";
import { BellRing, Eye, LayoutGrid, Loader2, CalendarDays, Plus, Download, ClipboardCheck } from "lucide-react";
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
  NoticeDetailClassModel,
  NoticeAccomDetailClass,
  NoticeLedgerResultModel,
  NoticeModel,
  NoticeParamClass,
  NoticeCategory,
  NoticeCategoryCounts,
  NoticeCategoryRow,
} from "@/types/noticeType";
import type { SearchStationModel } from "@/types/stationTypes";
import { NoticeAddModal } from "./components/noticeNew";
import { NoticeEditModal } from "./components/noticeEdit";
import { NoticeViewModal } from "./components/noticeView";
import { NoticeMatrixModal } from "./noticeMatrix";

/* -------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------- */

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

/** `noticeaccomlist` count field backing each notice category. */
const CATEGORY_COUNT_KEY: Record<NoticeCategory, keyof NoticeAccomDetailClass> = {
  NOD: "nodcount",
  NTC: "ntccount",
  NTCV: "ntcvcount",
  Abatement: "abatementcount",
  Closure: "closurecount",
};

/** Station-level issued totals returned alongside each ledger item. */
const CATEGORY_ISSUED_KEY: Record<NoticeCategory, keyof NoticeDetailModel> = {
  NOD: "totalissuednodcount",
  NTC: "totalissuedntccount",
  NTCV: "totalissuedntcvcount",
  Abatement: "totalissuedabatementcount",
  Closure: "totalissuedclosurecount",
};

/** Mode of issuance codes — mirrors `FSIC_MODE` used by Fire Safety Compliance. */
const MODE_MANUAL = 96;
const MODE_FSIS = 97;

const num = (value: unknown) => Number(value ?? 0) || 0;

/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

type ModeCounts = Record<NoticeCategory, number>;

/** One rendered ledger line (a day, month, quarter, semester, or year). */
export interface NoticeLedgerLine {
  key: string;
  label: string;
  manual: ModeCounts;
  fsis: ModeCounts;
}

type NoticeGranularity = "day" | "month" | "quarter" | "semester" | "annual";

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
  /** MANUAL / FSIS ledger lines rendered by the spreadsheet card. */
  lines: NoticeLedgerLine[];
  daysRecorded: number;
  daysInPeriod: number;
  lastupdated: string;
}

/* -------------------------------------------------------------------------
 * Mapping helpers
 * ---------------------------------------------------------------------- */

function emptyBreakdown(): Record<NoticeCategory, NoticeCategoryCounts> {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: { pending: 0, accomplished: 0 } }),
    {} as Record<NoticeCategory, NoticeCategoryCounts>,
  );
}

function emptyMode(): ModeCounts {
  return NOTICE_CATEGORIES.reduce(
    (acc, category) => ({ ...acc, [category]: 0 }),
    {} as ModeCounts,
  );
}

function emptyLine(key: string, label: string): NoticeLedgerLine {
  return { key, label, manual: emptyMode(), fsis: emptyMode() };
}

const dayLabel = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

/** `yyyy-mm` -> "August 2026". */
const monthLabel = (iso: string) => {
  const month = Number(iso.slice(5, 7)) || 0;
  const name = MONTHS.find((item) => item.value === month)?.name ?? iso.slice(5, 7);
  return `${name} ${iso.slice(0, 4)}`;
};

/**
 * Binds `noticedetallist` into MANUAL / FSIS ledger lines.
 * `groupBy: "day"` renders one line per accomplished date; aggregated
 * intervals sum every record into one line per month, quarter, semester,
 * or year — mirroring the Fire Safety Compliance ledger.
 *
 * On the daily interval with no single date picked ("all days"), every
 * calendar day of the selected month(s) is seeded first so the ledger shows
 * day 1 through the last day, and the API rows are matched onto their date.
 */
function buildLedgerLines(
  entries: NoticeDetailClassModel[] | undefined,
  groupBy: NoticeGranularity,
  months: number[],
  year: number,
  dateISO: string | null,
): NoticeLedgerLine[] {
  const byKey = new Map<string, NoticeLedgerLine>();
  const monthSet = new Set(months);

  if (groupBy === "day" && !dateISO) {
    for (const month of months) {
      const totalDays = calendarDaysInMonth(year, month);
      for (let day = 1; day <= totalDays; day += 1) {
        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        byKey.set(iso, emptyLine(iso, dayLabel(iso)));
      }
    }
  }


  for (const entry of Array.isArray(entries) ? entries : []) {
    const iso = String(entry?.dateaccomplish ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) continue;
    const recordMonth = Number(iso.slice(5, 7)) || 0;
    if (!recordMonth || (monthSet.size > 0 && !monthSet.has(recordMonth))) continue;
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

    for (const accom of Array.isArray(entry.noticeaccomlist) ? entry.noticeaccomlist : []) {
      // FSIS is 97; everything else (including the 96 MANUAL code and flat
      // payloads with no mode) is reported on the MANUAL line.
      const bucket = num(accom?.fsicmode) === MODE_FSIS ? line.fsis : line.manual;
      for (const category of NOTICE_CATEGORIES) {
        bucket[category] += num(
          (accom as unknown as Record<string, unknown>)?.[CATEGORY_COUNT_KEY[category]],
        );
      }
    }
  }

  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, line]) => line);
}

/**
 * Converts a ledger item into the card/modal record shape.
 *
 * `breakdown[category].pending` carries the issued count (from the
 * station-level `totalissued*` fields, falling back to the accomplished sum
 * when the API omits them) and `.accomplished` carries MANUAL + FSIS.
 */
function mapDetailToRecord(
  detail: NoticeDetailModel,
  year: number,
  months: number[],
  groupBy: NoticeGranularity,
  dateISO: string | null,
): NoticeRecord {
  const rawEntries = Array.isArray(detail.noticedetallist) ? detail.noticedetallist : [];
  const monthSet = new Set(months);

  const scoped = rawEntries.filter((entry) => {
    const iso = String(entry?.dateaccomplish ?? "").slice(0, 10);
    if (!iso || iso.startsWith("1900")) return false;
    const month = Number(iso.slice(5, 7)) || 0;
    if (monthSet.size > 0 && !monthSet.has(month)) return false;
    if (groupBy === "day" && dateISO && iso !== dateISO) return false;
    return true;
  });

  const lines = buildLedgerLines(scoped, groupBy, months, year, dateISO);

  // Day-level entries keep the real calendar day so the matrix and the view
  // dialog line up with the encoded dates instead of the array index.
  const dailyEntries: NoticeDayEntry[] = scoped
    .map((entry) => {
      const iso = String(entry.dateaccomplish ?? "").slice(0, 10);
      const breakdown = emptyBreakdown();
      for (const accom of Array.isArray(entry.noticeaccomlist) ? entry.noticeaccomlist : []) {
        for (const category of NOTICE_CATEGORIES) {
          const count = num(
            (accom as unknown as Record<string, unknown>)?.[CATEGORY_COUNT_KEY[category]],
          );
          breakdown[category].pending += count;
          breakdown[category].accomplished += count;
        }
      }
      return {
        day: Number(iso.slice(8, 10)) || 0,
        date: iso,
        remarks: "",
        breakdown,
      } satisfies NoticeDayEntry;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const accomplishedTotals = lines.reduce((acc, line) => {
    for (const category of NOTICE_CATEGORIES) {
      acc[category] += line.manual[category] + line.fsis[category];
    }
    return acc;
  }, emptyMode());

  const breakdown = emptyBreakdown();
  for (const category of NOTICE_CATEGORIES) {
    const issued = num(detail[CATEGORY_ISSUED_KEY[category]]);
    breakdown[category].accomplished = accomplishedTotals[category];
    breakdown[category].pending = issued || accomplishedTotals[category];
  }

  const dates = new Set(dailyEntries.map((entry) => entry.date).filter(Boolean));
  const lastupdated = dailyEntries.length ? dailyEntries[dailyEntries.length - 1].date : "";
  const primaryMonth = months[0] ?? 1;
  const daysInPeriod = months.reduce((acc, month) => acc + calendarDaysInMonth(year, month), 0);

  return {
    key: `${detail.stationno}|${year}|${months.join("-")}`,
    stationno: detail.stationno,
    stationcode: detail.stationcode ?? "",
    stationname: detail.stationname ?? "",
    provinceno: detail.provinceno ?? "",
    provincename: detail.provincename ?? "",
    cityname: detail.cityname ?? "",
    logourl: detail.logourl ?? "",
    province: detail.provincename ?? "",
    municipality: detail.cityname ?? "",
    reportYear: year,
    reportMonth: primaryMonth,
    breakdown,
    dailyEntries,
    lines,
    daysRecorded: dates.size,
    daysInPeriod,
    lastupdated,
  };
}

function createDraftNoticeRecord(params: {
  stationno: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logourl: string;
  reportYear: number;
  reportMonth: number;
}): NoticeRecord {
  return {
    key: `draft|${params.reportYear}|${params.reportMonth}`,
    stationno: params.stationno,
    stationcode: params.stationname,
    stationname: params.stationname,
    provinceno: params.provinceno,
    provincename: params.provincename,
    cityname: params.cityname,
    logourl: params.logourl,
    province: params.provincename,
    municipality: params.cityname,
    reportYear: params.reportYear,
    reportMonth: params.reportMonth,
    breakdown: emptyBreakdown(),
    dailyEntries: [],
    lines: [],
    daysRecorded: 0,
    daysInPeriod: calendarDaysInMonth(params.reportYear, params.reportMonth),
    lastupdated: "",
  };
}

export function computeCategoryRows(
  breakdown: Record<NoticeCategory, NoticeCategoryCounts>,
): NoticeCategoryRow[] {
  return NOTICE_CATEGORIES.map((category) => {
    const { pending, accomplished } = breakdown[category];
    const remaining = Math.max(0, pending - accomplished);
    const completionPct = pending === 0 ? 0 : (accomplished / pending) * 100;
    return { category, pending, accomplished, remaining, completionPct };
  });
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

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

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
  const YEARS = React.useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear],
  );

  const { state: filterState, set: setFilterState, resetState: resetFilterState } =
    useModuleFilterState();
  const year = filterState.year;
  const isAggregated = filterState.interval !== "DAILY";
  const allDates = isAggregated || isAllDays(filterState.date);
  const selectedDateISO = React.useMemo(
    () => baseDate(filterState.date) || toISODate(new Date()),
    [filterState.date],
  );
  const selectedMonths = React.useMemo(
    () => (isAggregated ? resolveModuleMonths(filterState) : [Number(selectedDateISO.slice(5, 7)) || 1]),
    [filterState, isAggregated, selectedDateISO],
  );
  const monthKey = selectedMonths.join(",");

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

  const ledgerGranularity: NoticeGranularity = React.useMemo(() => {
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

  /** Header caption for aggregated cards, e.g. "Q1 2026". */
  const periodLabel = React.useMemo(() => {
    if (!isAggregated) return null;
    const name = (month: number) => MONTHS.find((item) => item.value === month)?.name ?? String(month);
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
  }, [isAggregated, filterState.interval, filterState.quarter, filterState.semester, selectedMonths, year]);

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

  const [records, setRecords] = React.useState<NoticeRecord[]>([]);
  const [total, setTotal] = React.useState(0);
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
  const [addTarget, setAddTarget] = React.useState<NoticeRecord | null>(null);
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
  }, [
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
    scope.provincename,
    scope.stationname,
    user,
  ]);

  const handleProvinceSelect = (locationno: string, locationname: string) => {
    setProvinceno(locationno);
    setProvincename(locationname);
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

  const buildProvinceParams = React.useCallback((): NoticeParamClass[] => {
    const effectiveProvinceNo = scope.provinceLocked ? scope.provinceno : provinceno;
    const effectiveStationNo = scope.stationLocked ? scope.stationno : stationno;
    if (!effectiveProvinceNo || effectiveProvinceNo === EMPTY_GUID) return [];
    return [
      {
        provinceno: effectiveProvinceNo,
        stationnos:
          effectiveStationNo && effectiveStationNo !== EMPTY_GUID ? [effectiveStationNo] : [],
      },
    ];
  }, [scope.provinceLocked, scope.stationLocked, scope.provinceno, scope.stationno, provinceno, stationno]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const response = await noticeAPI.getLedger(
        {
          parameters: {
            searchkey: "",
            reportyear: Number(year),
            interval: intervalCode,
            dateaccomplish: allDates ? "" : `${selectedDateISO}T00:00:00`,
            reportmonth: [...selectedMonths],
            provinces: buildProvinceParams(),
          } as NoticeModel,
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, signal: controller.signal },
      );

      // The Ledger endpoint wraps its rows in `{ total, items }`; older
      // deployments returned a bare array, so both shapes are accepted.
      const { ok, data, total: apiTotal, error, canceled } = unwrap<
        NoticeLedgerResultModel | NoticeDetailModel[]
      >(response);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load notice ledger.");
        setRecords([]);
        setTotal(0);
      } else {
        const items = Array.isArray(data)
          ? data
          : Array.isArray((data as NoticeLedgerResultModel | null)?.items)
            ? (data as NoticeLedgerResultModel).items
            : [];
        const serverTotal =
          (!Array.isArray(data) ? Number((data as NoticeLedgerResultModel | null)?.total) : 0) ||
          Number(apiTotal) ||
          items.length;

        const mapped = items
          .map((item) =>
            mapDetailToRecord(
              item,
              Number(year),
              selectedMonths,
              ledgerGranularity,
              allDates ? null : selectedDateISO,
            ),
          )
          .sort((a, b) => a.stationname.localeCompare(b.stationname));
        setRecords(mapped);
        setTotal(serverTotal);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    year,
    monthKey,
    intervalCode,
    ledgerGranularity,
    selectedDateISO,
    allDates,
    buildProvinceParams,
    page,
    pageSize,
    refreshTick,
  ]);

  React.useEffect(() => {
    setPage(1);
  }, [year, monthKey, intervalCode, selectedDateISO, allDates, provincename, stationname, pageSize, setPage]);

  // The ledger is paginated server-side — render the returned page as-is.
  const paged = records;

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
      worksheet.columns = [
        { header: "Station Code", key: "stationCode", width: 16 },
        { header: "Station Name", key: "stationName", width: 32 },
        { header: "Province", key: "province", width: 22 },
        { header: "Municipality", key: "municipality", width: 22 },
        { header: "Year", key: "year", width: 10 },
        { header: "Period", key: "period", width: 22 },
        { header: "Mode", key: "mode", width: 12 },
        ...NOTICE_CATEGORIES.map((category) => ({
          header: CATEGORY_LABEL[category],
          key: category,
          width: 14,
        })),
        { header: "Total", key: "total", width: 12 },
      ];

      for (const record of paged) {
        for (const line of record.lines) {
          for (const mode of ["MANUAL", "FSIS"] as const) {
            const counts = mode === "MANUAL" ? line.manual : line.fsis;
            const categoryRow: Record<string, number> = {};
            let lineTotal = 0;
            for (const category of NOTICE_CATEGORIES) {
              categoryRow[category] = counts[category];
              lineTotal += counts[category];
            }
            worksheet.addRow({
              stationCode: record.stationcode,
              stationName: record.stationname,
              province: record.province,
              municipality: record.municipality,
              year: record.reportYear,
              period: line.label,
              mode,
              ...categoryRow,
              total: lineTotal,
            });
          }
        }
      }

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.eachCell((cell, columnNumber) => {
          if (columnNumber >= 8) {
            cell.numFmt = "#,##0;(#,##0);-";
            cell.alignment = { horizontal: "right" };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `Notice_${year}.xlsx`,
      );
      toast.success("Notice exported.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export Notice.");
    } finally {
      setExporting(false);
    }
  };

  const openAdd = () => {
    const anchor = paged[0] ?? null;
    if (anchor) {
      setAddTarget(anchor);
    } else {
      setAddTarget(
        createDraftNoticeRecord({
          stationno: stationno === EMPTY_GUID ? "" : stationno,
          stationname: stationname === "ALL" ? "Selected Station" : stationname,
          provinceno: provinceno === EMPTY_GUID ? "" : provinceno,
          provincename: provincename === "ALL" ? "Selected Province" : provincename,
          cityname: "",
          logourl: "",
          reportYear: Number(year),
          reportMonth: Number(selectedMonths[0] ?? new Date().getMonth() + 1),
        }),
      );
    }
    setAddOpen(true);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
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
            onClick={() => {
              setMatrixTarget(paged[0] ?? null);
              setMatrixOpen(true);
            }}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> Notice Matrix
          </Button>
          {canManage && (
            <Button onClick={openAdd} className="w-full justify-center gap-2 sm:w-auto">
              <Plus className="h-4 w-4" /> Add Notice
            </Button>
          )}
        </div>
      </div>

      <CurrentMonthNote canManage={canManage} />

      <ModuleFilterBar
        years={YEARS}
        state={filterState}
        onChange={setFilterState}
        onReset={handleResetFilters}
        intervals={["DAILY", "MONTHLY", "QUARTERLY", "SEMESTER", "ANNUAL"]}
        allowAllDays
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

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notice ledger…
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          {isAggregated
            ? "No notice records for the selected period."
            : allDates
              ? "No notice records for the selected month."
              : "No notice records for the selected date."}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {paged.map((record) => (
            <NoticeLedgerCard
              key={record.key}
              record={record}
              groupBy={ledgerGranularity}
              periodLabel={periodLabel}
              locked={!canManage}
              onView={() => setViewTarget(record)}
              onEdit={() => setEditTarget(record)}
              onDelete={() => setDeleteTarget(record)}
              onMatrix={() => {
                setMatrixTarget(record);
                setMatrixOpen(true);
              }}
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
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
        title="Delete Notice Ledger?"
        subject={
          deleteTarget ? (
            <>
              {deleteTarget.stationname} —{" "}
              {MONTHS.find((month) => month.value === deleteTarget.reportMonth)?.name}{" "}
              {deleteTarget.reportYear}
            </>
          ) : null
        }
        description="This removes the notice ledger for the selected station and period."
        confirmLabel="Delete"
        deleting={deleting}
        onConfirm={confirmDelete}
      />

      {addTarget && (
        <NoticeAddModal
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) setAddTarget(null);
          }}
          record={addTarget}
          onSaved={refresh}
        />
      )}
      {matrixTarget && (
        <NoticeMatrixModal
          open={matrixOpen}
          onOpenChange={(open) => {
            setMatrixOpen(open);
            if (!open) setMatrixTarget(null);
          }}
          record={matrixTarget}
        />
      )}
      {viewTarget && (
        <NoticeViewModal
          open={!!viewTarget}
          onOpenChange={(open) => !open && setViewTarget(null)}
          record={viewTarget}
        />
      )}
      {editTarget && (
        <NoticeEditModal
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          record={editTarget}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Ledger card — mirrors the Fire Safety Compliance spreadsheet card
 * ---------------------------------------------------------------------- */

const headCell =
  "border border-border/50 bg-blue-50 dark:bg-slate-800 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 whitespace-nowrap text-center";
const bodyCell = "border border-border/40 px-2 py-1.5 text-xs tabular-nums text-center";
const footCell =
  "border border-border/50 bg-blue-100 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold tabular-nums text-center text-blue-800 dark:text-blue-200";

function NoticeLedgerCard({
  record,
  locked,
  groupBy = "day",
  periodLabel = null,
  onView,
  onEdit,
  onDelete,
  onMatrix,
}: {
  record: NoticeRecord;
  locked: boolean;
  groupBy?: NoticeGranularity;
  periodLabel?: string | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMatrix: () => void;
}) {
  const monthName =
    MONTHS.find((month) => month.value === record.reportMonth)?.name ?? String(record.reportMonth);
  const lines = record.lines;

  const totals = React.useMemo(() => {
    const manual = emptyMode();
    const fsis = emptyMode();
    for (const line of lines) {
      for (const category of NOTICE_CATEGORIES) {
        manual[category] += line.manual[category] ?? 0;
        fsis[category] += line.fsis[category] ?? 0;
      }
    }
    return { manual, fsis };
  }, [lines]);

  const grandTotal = NOTICE_CATEGORIES.reduce(
    (sum, category) => sum + totals.manual[category] + totals.fsis[category],
    0,
  );

  return (
    <Card className="flex flex-col overflow-hidden border-border/50 dark:border-border/40 shadow-soft transition-shadow hover:shadow-elegant">
      {/* Header — station details */}
      <div className="flex items-start gap-3 border-b border-border/40 dark:border-border/50 bg-gradient-to-r from-blue-50 dark:from-slate-700/40 via-blue-50/50 dark:via-slate-700/20 to-transparent dark:to-transparent p-4">
        <AvatarWithFallback
          entity={{ name: record.stationname }}
          src={record.logourl || undefined}
          name={record.stationname}
          className="h-14 w-14 shrink-0 rounded-full ring-2 ring-blue-200 dark:ring-slate-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-100 dark:bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
              {record.stationcode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400">
              {periodLabel ?? `${monthName} ${record.reportYear}`}
            </span>
            <DaysRecordedBadge encoded={record.daysRecorded} total={record.daysInPeriod} />
          </div>
          <div className="mt-1 text-sm font-bold text-foreground dark:text-slate-100">
            {record.stationname}
          </div>
          <div className="text-[11px] text-muted-foreground dark:text-slate-400">
            {record.municipality} · {record.province}
          </div>
        </div>
        <div
          className="grid h-10 w-14 place-items-center rounded-lg bg-blue-100 dark:bg-slate-600 text-center text-blue-700 dark:text-blue-300"
          title="Total accomplished notices"
        >
          <div className="text-[8px] font-bold uppercase leading-none">Total</div>
          <div className="text-xs font-bold leading-none">{grandTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Spreadsheet body — sticky header, sticky totals, scrollable rows */}
      <div className="p-3">
        {lines.length === 0 ? (
          <div className="rounded-xl border border-border/40 p-6 text-center text-xs text-muted-foreground">
            {groupBy === "day" ? "No daily entries for this period." : "No entries for this period."}
          </div>
        ) : (
          <div className="max-h-[24rem] overflow-auto rounded-xl border border-border/40">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={`${headCell} sticky left-0 top-0 z-40 min-w-[11rem] border-r-2 border-r-border/60 text-left`}
                  >
                    {groupBy === "day" ? "Date" : groupBy === "month" ? "Month" : "Period"}
                  </th>
                  <th
                    rowSpan={2}
                    className={`${headCell} sticky left-[11rem] top-0 z-40 min-w-[9rem] border-r-2 border-r-border/60`}
                  >
                    Mode of Issuance
                  </th>

                  <th colSpan={NOTICE_CATEGORIES.length} className={`${headCell} sticky top-0 z-30`}>
                    Notices
                  </th>
                </tr>
                <tr>
                  {NOTICE_CATEGORIES.map((category) => (
                    <th
                      key={category}
                      className={`${headCell} sticky top-[30px] z-30 min-w-[6rem]`}
                    >
                      {CATEGORY_LABEL[category]}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {lines.map((line) => (
                  <React.Fragment key={line.key}>
                    <tr className="bg-card dark:bg-slate-800">
                      <th
                        scope="row"
                        rowSpan={2}
                        className="sticky left-0 z-10 border border-border/40 border-r-2 border-r-border/60 bg-inherit px-2 py-1.5 text-left text-xs font-semibold text-foreground whitespace-nowrap"
                      >
                        {line.label}
                      </th>
                      <td
                        className={`${bodyCell} sticky left-[11rem] z-10 bg-inherit border-r-2 border-r-border/60 font-semibold text-blue-700 dark:text-blue-300`}
                      >

                        MANUAL
                      </td>
                      {NOTICE_CATEGORIES.map((category) => (
                        <td key={category} className={bodyCell}>
                          {(line.manual[category] ?? 0).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-blue-50 dark:bg-slate-700">
                      <td
                        className={`${bodyCell} sticky left-[11rem] z-10 bg-inherit border-r-2 border-r-border/60 font-semibold text-blue-700 dark:text-blue-300`}
                      >

                        FSIS
                      </td>
                      {NOTICE_CATEGORIES.map((category) => (
                        <td key={category} className={bodyCell}>
                          {(line.fsis[category] ?? 0).toLocaleString()}
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
                    className={`${footCell} sticky left-0 z-20 border-r-2 border-r-border/60 text-left uppercase`}
                  >
                    Total
                  </th>
                  <td className={`${footCell} sticky left-[11rem] z-20 border-r-2 border-r-border/60`}>
                    MANUAL
                  </td>
                  {NOTICE_CATEGORIES.map((category) => (
                    <td key={category} className={footCell}>
                      {totals.manual[category].toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={`${footCell} sticky left-[11rem] z-20 border-r-2 border-r-border/60`}>
                    FSIS
                  </td>
                  {NOTICE_CATEGORIES.map((category) => (
                    <td key={category} className={footCell}>
                      {totals.fsis[category].toLocaleString()}
                    </td>
                  ))}

                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="mt-2 text-[10px] text-muted-foreground dark:text-slate-400">
          Last updated:{" "}
          {record.lastupdated ? new Date(`${record.lastupdated}T00:00:00`).toLocaleDateString() : "—"}
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
