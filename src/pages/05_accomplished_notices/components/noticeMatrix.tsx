import * as React from "react";
import { LayoutGrid } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MATRIX_TONE, TABLE } from "@/lib/theme";
import { MONTHS } from "@/lib/fsims-constants";
import { formatLongDate } from "@/lib/date-format";
import { fromISODate, toISODate } from "@/lib/filters";
import {
  MODULE_INTERVALS,
  defaultModuleFilterState,
  resolveModuleMonths,
  type ModuleFilterState,
} from "@/components/shared/ModuleFilterBar";
import {
  type AccomplishedNoticeRecord,
  type NoticeCategory,
  NOTICE_CATEGORIES,
} from "@/data/05_accomplished_notices";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

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
  record: AccomplishedNoticeRecord | null;
}

/** Read-only field matching the other matrices' locked filter styling. */
function LockedField({ value }: { value: string }) {
  return (
    <div className="flex h-10 w-full min-w-0 items-center rounded-md border bg-background px-3 text-sm text-muted-foreground">
      {value || "—"}
    </div>
  );
}

function MonthMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const label =
    value.length === 0
      ? "All months"
      : value.length === 1
        ? MONTHS.find((m) => m.value === value[0])?.name
        : `${value.length} months selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-start px-3 text-left text-sm font-normal"
        >
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 pointer-events-auto" align="start">
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {MONTHS.map((m) => (
            <label
              key={m.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={value.includes(m.value)}
                onCheckedChange={() =>
                  onChange(
                    value.includes(m.value)
                      ? value.filter((v) => v !== m.value)
                      : [...value, m.value].sort((a, b) => a - b),
                  )
                }
              />
              {m.name}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NoticeMatrixModal({ open, onOpenChange, record }: NoticeMatrixModalProps) {
  const [filters, setFilters] = React.useState<ModuleFilterState>(defaultModuleFilterState);
  const set = (patch: Partial<ModuleFilterState>) => setFilters((prev) => ({ ...prev, ...patch }));

  // Seed the filter from the opened record each time the dialog opens.
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
  const selectedDate = React.useMemo(() => fromISODate(filters.date), [filters.date]);

  const recordYear = record?.reportYear ?? 0;
  const isDayView = filters.interval === "DAILY" || selectedMonths.length === 1;
  const dayViewMonth =
    filters.interval === "DAILY" ? (selectedDate?.getMonth() ?? 0) + 1 : selectedMonths[0];
  const dayViewYear = Number(filters.year) || recordYear;

  // Column set: day columns for a single month/day, month columns otherwise.
  const columns: { key: string; label: string }[] = React.useMemo(() => {
    if (filters.interval === "DAILY" && selectedDate) {
      return [{ key: `d-${selectedDate.getDate()}`, label: `Day ${selectedDate.getDate()}` }];
    }
    if (isDayView) {
      const days = new Date(dayViewYear, dayViewMonth, 0).getDate();
      return Array.from({ length: days }, (_, i) => ({ key: `d-${i + 1}`, label: `Day ${i + 1}` }));
    }
    return selectedMonths.map((m) => ({
      key: `m-${m}`,
      label: MONTHS.find((mo) => mo.value === m)?.short ?? String(m),
    }));
  }, [filters.interval, selectedDate, isDayView, dayViewMonth, dayViewYear, selectedMonths]);

  if (!record) return null;

  /** Counts for a column — daily entries exist only for the record's month. */
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

  const rowTotal = (category: NoticeCategory) =>
    columns.reduce(
      (acc, c) => {
        const v = cellCounts(category, c.key);
        return {
          pending: acc.pending + v.pending,
          accomplished: acc.accomplished + v.accomplished,
        };
      },
      { pending: 0, accomplished: 0 },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Notice Matrix</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {record.stationName} — {filters.year}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-2">
            Close
          </Button>
        </DialogHeader>

        {/* Filters — same order as the module filter bar */}
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              <LockedField value={filters.year} />
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Period
              </div>
              <Select
                value={filters.interval}
                onValueChange={(v) => set({ interval: v as ModuleFilterState["interval"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_INTERVALS.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {it.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filters.interval !== "ANNUAL" && (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {filters.interval === "DAILY"
                    ? "Date"
                    : filters.interval === "MONTHLY"
                      ? "Month"
                      : filters.interval === "QUARTERLY"
                        ? "Quarter"
                        : "Semester"}
                </div>
                {filters.interval === "DAILY" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 w-full justify-start px-3 text-left text-sm font-normal",
                          !selectedDate && "text-muted-foreground",
                        )}
                      >
                        <span className="truncate">
                          {selectedDate ? formatLongDate(selectedDate) : "Pick a date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={selectedDate ?? undefined}
                        onSelect={(d) =>
                          d && set({ date: toISODate(d), year: String(d.getFullYear()) })
                        }
                        defaultMonth={selectedDate ?? undefined}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                ) : filters.interval === "MONTHLY" ? (
                  <MonthMultiSelect value={filters.months} onChange={(months) => set({ months })} />
                ) : filters.interval === "QUARTERLY" ? (
                  <Select value={filters.quarter} onValueChange={(v) => set({ quarter: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="q1">1st Quarter</SelectItem>
                      <SelectItem value="q2">2nd Quarter</SelectItem>
                      <SelectItem value="q3">3rd Quarter</SelectItem>
                      <SelectItem value="q4">4th Quarter</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={filters.semester} onValueChange={(v) => set({ semester: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="s1">1st Semester</SelectItem>
                      <SelectItem value="s2">2nd Semester</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              <LockedField value={record.province} />
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Station
              </div>
              <LockedField value={record.stationName} />
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={2}
                  className={`sticky left-0 top-0 z-40 min-w-[180px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
                >
                  Category
                </th>
                <th
                  colSpan={columns.length}
                  className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.group}`}
                >
                  {isDayView ? "Daily Notices" : "Monthly Notices"}
                </th>
                <th
                  rowSpan={2}
                  className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.total}`}
                >
                  Total
                </th>
              </tr>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={`border-b border-r px-2 py-1.5 text-center font-semibold uppercase ${STYLE.month}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {NOTICE_CATEGORIES.map((category, idx) => {
                const total = rowTotal(category);
                return (
                  <tr key={category} className={idx % 2 === 1 ? TABLE.rowOdd : TABLE.rowEven}>
                    <td
                      className={`sticky left-0 z-10 border-b border-r px-3 py-2 font-semibold ${STYLE.cat}`}
                    >
                      {CATEGORY_LABEL[category]}
                    </td>
                    {columns.map((c) => {
                      const counts = cellCounts(category, c.key);
                      return (
                        <td
                          key={`${category}-${c.key}`}
                          className="border-b border-r px-2 py-2 text-center tabular-nums"
                        >
                          <div className="text-[11px] text-muted-foreground">
                            P {counts.pending}
                          </div>
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
