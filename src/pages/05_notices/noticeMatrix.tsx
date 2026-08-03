import * as React from "react";
import { LayoutGrid } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MATRIX_TONE, TABLE } from "@/lib/theme";
import { MONTHS } from "@/lib/fsims-constants";
import { fromISODate, toISODate } from "@/lib/filters";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import {
  PeriodSelect,
  SubFilterControl,
  defaultModuleFilterState,
  isAllDays,
  baseDate,
  resolveModuleMonths,
  type ModuleFilterState,
} from "@/components/shared/ModuleFilterBar";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type { NoticeCategory } from "@/types/noticeType";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  group: MATRIX_TONE.quarter,
  month: MATRIX_TONE.month,
  cat: MATRIX_TONE.cat,
  total: MATRIX_TONE.annual,
};

interface NoticeMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
}

export function NoticeMatrixModal({ open, onOpenChange, record }: NoticeMatrixModalProps) {
  const [filters, setFilters] = React.useState<ModuleFilterState>(defaultModuleFilterState);
  const set = (patch: Partial<ModuleFilterState>) => setFilters((prev) => ({ ...prev, ...patch }));

  React.useEffect(() => {
    if (!open || !record) return;
    setFilters({
      ...defaultModuleFilterState(),
      year: String(record.reportYear),
      interval: "MONTHLY",
      months: [record.reportMonth],
      date: toISODate(new Date(record.reportYear, record.reportMonth - 1, 1)),
    });
  }, [open, record]);

  const selectedMonths = React.useMemo(() => resolveModuleMonths(filters), [filters]);
  const allDays = isAllDays(filters.date);
  const refDate = React.useMemo(() => fromISODate(baseDate(filters.date)), [filters.date]);
  const selectedDate = allDays ? null : refDate;

  const recordYear = record?.reportYear ?? 0;
  const isDayView = filters.interval === "DAILY" || selectedMonths.length === 1;
  const dayViewMonth = filters.interval === "DAILY" ? (refDate?.getMonth() ?? 0) + 1 : selectedMonths[0];
  const dayViewYear = Number(filters.year) || recordYear;

  const columns: { key: string; label: string }[] = React.useMemo(() => {
    if (filters.interval === "DAILY" && selectedDate) {
      return [{ key: `d-${selectedDate.getDate()}`, label: `Day ${selectedDate.getDate()}` }];
    }
    if (isDayView) {
      const days = new Date(dayViewYear, dayViewMonth, 0).getDate();
      return Array.from({ length: days }, (_, i) => ({ key: `d-${i + 1}`, label: `Day ${i + 1}` }));
    }
    return selectedMonths.map((month) => ({
      key: `m-${month}`,
      label: MONTHS.find((item) => item.value === month)?.short ?? String(month),
    }));
  }, [filters.interval, selectedDate, isDayView, dayViewMonth, dayViewYear, selectedMonths]);

  if (!record) return null;

  const cellCounts = (category: NoticeCategory, key: string) => {
    if (key.startsWith("d-")) {
      const day = Number(key.slice(2));
      const sameMonth = dayViewMonth === record.reportMonth && dayViewYear === record.reportYear;
      if (!sameMonth) return { pending: 0, accomplished: 0 };
      const entry = record.dailyEntries.find((item) => item.day === day);
      return entry?.breakdown[category] ?? { pending: 0, accomplished: 0 };
    }
    const month = Number(key.slice(2));
    if (month !== record.reportMonth || dayViewYear !== record.reportYear) {
      return { pending: 0, accomplished: 0 };
    }
    return record.breakdown[category];
  };

  const rowTotal = (category: NoticeCategory) => columns.reduce(
    (acc, column) => {
      const value = cellCounts(category, column.key);
      return {
        pending: acc.pending + value.pending,
        accomplished: acc.accomplished + value.accomplished,
      };
    },
    { pending: 0, accomplished: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton onPointerDownOutside={(event) => event.preventDefault()} onInteractOutside={(event) => event.preventDefault()} className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Notice Matrix</DialogTitle>
              <p className="text-xs text-muted-foreground">{record.stationname} — {filters.year}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-2">
            Close
          </Button>
        </DialogHeader>
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Year</div>
              <ReadOnlyField value={filters.year} placeholder="Year" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Period</div>
              <PeriodSelect value={filters.interval} onChange={set} />
            </div>
            {filters.interval !== "ANNUAL" && filters.interval !== "ALL" && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{filters.interval === "DAILY" ? "Date" : filters.interval === "MONTHLY" ? "Month" : filters.interval === "QUARTERLY" ? "Quarter" : "Semester"}</div>
                <SubFilterControl state={filters} onChange={set} />
              </div>
            )}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Province</div>
              <ReadOnlyField value={record.province} placeholder="All provinces" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Station</div>
              <ReadOnlyField value={record.stationname} placeholder="All stations" />
            </div>
          </div>
        </div>
        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th rowSpan={2} className={`sticky left-0 top-0 z-40 min-w-[180px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}>Category</th>
                <th colSpan={columns.length} className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.group}`}>{isDayView ? "Daily Notices" : "Monthly Notices"}</th>
                <th rowSpan={2} className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.total}`}>Total</th>
              </tr>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={`border-b border-r px-2 py-1.5 text-center font-semibold uppercase ${STYLE.month}`}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NOTICE_CATEGORIES.map((category, index) => {
                const total = rowTotal(category);
                return (
                  <tr key={category} className={index % 2 === 1 ? TABLE.rowOdd : TABLE.rowEven}>
                    <td className={`sticky left-0 z-10 border-b border-r px-3 py-2 font-semibold ${STYLE.cat}`}>{CATEGORY_LABEL[category]}</td>
                    {columns.map((column) => {
                      const counts = cellCounts(category, column.key);
                      return (
                        <td key={`${category}-${column.key}`} className="border-b border-r px-2 py-2 text-center tabular-nums">
                          <div className="text-[11px] text-muted-foreground">P {counts.pending}</div>
                          <div className="text-[11px] font-semibold">A {counts.accomplished}</div>
                        </td>
                      );
                    })}
                    <td className="border-b border-r px-2 py-2 text-center tabular-nums font-semibold">
                      <div className="text-[11px] text-muted-foreground">P {total.pending}</div>
                      <div className="text-[11px]">A {total.accomplished}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default NoticeMatrixModal;
