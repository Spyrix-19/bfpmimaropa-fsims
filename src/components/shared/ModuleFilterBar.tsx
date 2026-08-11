import * as React from "react";
import { addDays, endOfWeek, startOfWeek } from "date-fns";
import { CalendarIcon, ChevronDown, Check } from "lucide-react";
import ResetFiltersButton from "@/components/reset-filters-button";
import FilterField from "@/components/filter-field";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatLongDate } from "@/lib/date-format";
import { MONTHS } from "@/lib/fsims-constants";
import { toISODate, fromISODate, type DashInterval } from "@/lib/filters";

/* ------------------------------------------------------------------ *
 * Shared module filter state — mirrors the Dashboard filter behavior.
 * Order: YEAR -> PERIOD -> SUB FILTER -> PROVINCE -> STATION
 * ------------------------------------------------------------------ */

export type ModuleInterval = DashInterval;

export interface ModuleFilterState {
  year: string;
  interval: ModuleInterval;
  /** DAILY: selected ISO `yyyy-mm-dd` date, or `all:yyyy-mm-dd` for all days of that month. */
  date: string;
  /** MONTHLY: one or more selected month numbers (1..12). */
  months: number[];
  /** WEEKLY: `all` or a comma-separated list of `w1`..`w53` for the selected year. */
  week: string;
  /** QUARTERLY: `q1`..`q4`. */
  quarter: string;
  /** SEMESTER: `s1` | `s2`. */
  semester: string;
}

export const MODULE_INTERVALS: { value: ModuleInterval; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMESTER", label: "Semester" },
  { value: "ANNUAL", label: "Annual" },
];

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** `all:yyyy-mm-dd` marks "all days" of the referenced month. */
const ALL_DAYS_PREFIX = "all:";

function parseSelectedWeeks(value: string): number[] {
  if (!value || value === "all") return [];
  return value
    .split(",")
    .map((part) => part.trim().replace(/^w/i, ""))
    .filter((part) => /^\d+$/.test(part))
    .map((part) => Number(part))
    .filter((part) => part >= 1 && part <= 53)
    .sort((a, b) => a - b);
}

function serializeSelectedWeeks(weeks: number[]): string {
  if (!weeks.length) return "all";
  return weeks.map((week) => `w${week}`).join(",");
}

/**
 * Sunday–Saturday weeks covering the given year.
 * Displayed ranges are clipped so they never spill into the adjacent years.
 */
function getYearWeekRanges(year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const dateFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const ranges: Array<{ weekNumber: number; start: Date; end: Date; label: string }> = [];

  let currentStart = startOfWeek(yearStart, { weekStartsOn: 0 });
  let weekNumber = 1;
  while (currentStart <= yearEnd) {
    const currentEnd = endOfWeek(currentStart, { weekStartsOn: 0 });
    const clippedStart = currentStart < yearStart ? yearStart : currentStart;
    const clippedEnd = currentEnd > yearEnd ? yearEnd : currentEnd;
    ranges.push({
      weekNumber,
      start: new Date(clippedStart),
      end: new Date(clippedEnd),
      label: `${dateFormatter.format(clippedStart)} - ${dateFormatter.format(clippedEnd)}`,
    });

    currentStart = addDays(currentStart, 7);
    weekNumber += 1;
    if (weekNumber > 60) break;
  }

  return ranges;
}

export function isAllDays(date: string): boolean {
  return typeof date === "string" && date.startsWith(ALL_DAYS_PREFIX);
}

export function toAllDays(date: string): string {
  return isAllDays(date) ? date : `${ALL_DAYS_PREFIX}${date}`;
}

/** Strips the "all days" marker, returning a plain ISO date string. */
export function baseDate(date: string): string {
  return isAllDays(date) ? date.slice(ALL_DAYS_PREFIX.length) : date;
}

export function defaultModuleFilterState(): ModuleFilterState {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    interval: "DAILY",
    date: toAllDays(toISODate(now)),
    months: [],
    week: "all",
    quarter: "all",
    semester: "all",
  };
}

/** Expands the current selection into the concrete list of months. */
export function resolveModuleMonths(state: ModuleFilterState): number[] {
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  switch (state.interval) {
    case "ALL":
    case "ANNUAL":
      return ALL;
    case "DAILY": {
      const d = fromISODate(baseDate(state.date));
      return d ? [d.getMonth() + 1] : ALL;
    }
    case "WEEKLY": {
      const d = fromISODate(baseDate(state.date));
      return d ? [d.getMonth() + 1] : ALL;
    }
    case "MONTHLY":
      return state.months.length ? [...state.months].sort((a, b) => a - b) : ALL;
    case "QUARTERLY":
      switch (state.quarter) {
        case "q1":
          return [1, 2, 3];
        case "q2":
          return [4, 5, 6];
        case "q3":
          return [7, 8, 9];
        case "q4":
          return [10, 11, 12];
        case "all":
          return ALL;
        default:
          return ALL;
      }
    case "SEMESTER":
      if (state.semester === "s2") return [7, 8, 9, 10, 11, 12];
      if (state.semester === "all") return ALL;
      return [1, 2, 3, 4, 5, 6];
    default:
      return ALL;
  }
}

/** Primary month used by endpoints that accept a single report month. */
export function resolvePrimaryMonth(state: ModuleFilterState): number {
  return resolveModuleMonths(state)[0] ?? 1;
}

/** Selected day (1..31) when the DAILY interval is active, else null. */
export function resolveSelectedDay(state: ModuleFilterState): number | null {
  if (state.interval !== "DAILY") return null;
  if (isAllDays(state.date)) return null;
  const d = fromISODate(state.date);
  return d ? d.getDate() : null;
}

/** Local state hook with a patch setter and reset. */
export function useModuleFilterState(initial?: Partial<ModuleFilterState>) {
  const [state, setState] = React.useState<ModuleFilterState>({
    ...defaultModuleFilterState(),
    ...initial,
  });
  const set = React.useCallback(
    (patch: Partial<ModuleFilterState>) => setState((prev) => ({ ...prev, ...patch })),
    [],
  );
  const resetState = React.useCallback(
    () => setState({ ...defaultModuleFilterState(), ...initial }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return { state, set, setState, resetState };
}

/* ------------------------------------------------------------------ *
 * Multi-select month control (MONTHLY sub filter)
 * ------------------------------------------------------------------ */
export function MonthMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const allSelected = value.length === 0 || value.length === ALL_MONTHS.length;
  const label = allSelected
    ? "All months"
    : value.length === 1
      ? MONTHS.find((m) => m.value === value[0])?.name
      : value.length > 1
        ? `${value.length} months selected`
        : "Select month";

  const toggle = (m: number) => {
    if (allSelected) {
      onChange([m]);
      return;
    }
    if (value.includes(m)) {
      const next = value.filter((v) => v !== m);
      onChange(next.length === 0 ? [] : next);
      return;
    }
    if (allSelected) {
      onChange([m]);
      return;
    }
    onChange([...value, m].sort((a, b) => a - b));
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : [...ALL_MONTHS]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm",
            value.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
            {label}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-max min-w-[220px] p-0 pointer-events-auto" align="start">
        <div className="max-h-64 overflow-auto">
          <button
            type="button"
            onClick={toggleAll}
            className={cn(
              "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted",
              allSelected && "bg-muted",
            )}
          >
            <div className="min-w-0 flex-1 truncate font-medium">All months</div>
            {allSelected ? <Check className="h-4 w-4 text-primary" /> : null}
          </button>
          {MONTHS.map((m) => {
            const sel = value.includes(m.value) && !allSelected;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => toggle(m.value)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  sel && "bg-muted",
                )}
              >
                <div className="min-w-0 flex-1 truncate font-medium">{m.name}</div>
                {sel ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function WeekMultiSelect({
  state,
  onChange,
}: {
  state: ModuleFilterState;
  onChange: (patch: Partial<ModuleFilterState>) => void;
}) {
  const [weekPopoverOpen, setWeekPopoverOpen] = React.useState(false);
  const selectedWeeks = React.useMemo(() => parseSelectedWeeks(state.week), [state.week]);
  const year = React.useMemo(() => {
    const parsed = Number(state.year);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : new Date().getFullYear();
  }, [state.year]);
  /** Fixed ranges — regenerated only when the selected year changes. */
  const weekRanges = React.useMemo(() => getYearWeekRanges(year), [year]);

  const handleWeekToggle = (weekNumber: number) => {
    const nextWeeks = selectedWeeks.includes(weekNumber)
      ? selectedWeeks.filter((week) => week !== weekNumber)
      : [...selectedWeeks, weekNumber].sort((a, b) => a - b);
    const anchorWeek = weekRanges.find(
      (range) => range.weekNumber === (nextWeeks[0] ?? weekNumber),
    );
    const anchorDate = anchorWeek?.start ?? new Date(year, 0, 1);
    onChange({
      week: serializeSelectedWeeks(nextWeeks),
      date: toAllDays(toISODate(anchorDate)),
    });
  };

  const handleSelectAllWeeks = () => {
    onChange({
      week: "all",
      date: toAllDays(toISODate(new Date(year, 0, 1))),
    });
  };

  const label = selectedWeeks.length
    ? selectedWeeks.length === 1
      ? `Week ${selectedWeeks[0]}`
      : `${selectedWeeks.length} weeks selected`
    : "All weeks";

  return (
    <Popover open={weekPopoverOpen} onOpenChange={setWeekPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start gap-2 px-3 text-left text-sm font-normal",
            selectedWeeks.length === 0 && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="text-sm font-medium">Weeks of {year}</div>
          <button
            type="button"
            onClick={handleSelectAllWeeks}
            className="text-xs font-medium text-primary hover:underline"
          >
            All weeks
          </button>
        </div>

        <TooltipProvider delayDuration={100}>
          <div className="grid max-h-64 grid-cols-7 gap-1.5 overflow-auto p-3">
            {weekRanges.map((weekRange) => {
              const isSelected = selectedWeeks.includes(weekRange.weekNumber);
              return (
                <Tooltip key={`week-${weekRange.weekNumber}`}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleWeekToggle(weekRange.weekNumber)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-muted",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "bg-background",
                      )}
                    >
                      {weekRange.weekNumber}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Week {weekRange.weekNumber}: {weekRange.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ *
 * PERIOD select + SUB FILTER control (shared by the filter bar and the
 * matrix dialogs so there is a single implementation).
 * ------------------------------------------------------------------ */
export function PeriodSelect({
  value,
  onChange,
  intervals,
}: {
  value: ModuleInterval;
  onChange: (patch: Partial<ModuleFilterState>) => void;
  /** Restricts the selectable periods (defaults to all). */
  intervals?: ModuleInterval[];
}) {
  const handleIntervalChange = (v: string) => {
    const next = v as ModuleInterval;
    const today = new Date();
    const month = today.getMonth() + 1;
    if (next === "ANNUAL") {
      onChange({ interval: next });
      return;
    }
    if (next === "DAILY") {
      onChange({
        interval: next,
        date: toAllDays(toISODate(today)),
        year: String(today.getFullYear()),
      });
      return;
    }
    if (next === "WEEKLY") {
      onChange({
        interval: next,
        date: toAllDays(toISODate(today)),
        week: "all",
        year: String(today.getFullYear()),
      });
      return;
    }
    if (next === "MONTHLY") {
      onChange({ interval: next, months: [] });
      return;
    }
    if (next === "QUARTERLY") {
      onChange({ interval: next, quarter: "all" });
      return;
    }
    if (next === "SEMESTER") {
      onChange({ interval: next, semester: "all" });
      return;
    }
    onChange({ interval: next });
  };

  const options = intervals?.length
    ? MODULE_INTERVALS.filter((it) => intervals.includes(it.value))
    : MODULE_INTERVALS.filter((it) => it.value !== "WEEKLY");

  return (
    <Select value={value} onValueChange={handleIntervalChange}>
      <SelectTrigger>
        <SelectValue placeholder="Period" />
      </SelectTrigger>
      <SelectContent>
        {options.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Sub filter for the active period. Renders nothing for ANNUAL. */
export function SubFilterControl({
  state,
  onChange,
  allowAllDays = true,
}: {
  state: ModuleFilterState;
  onChange: (patch: Partial<ModuleFilterState>) => void;
  /** DAILY only: when false, the "All (whole month)" shortcut is hidden. */
  allowAllDays?: boolean;
}) {
  const [dateOpen, setDateOpen] = React.useState(false);
  const allDays = isAllDays(state.date);
  const refDate = React.useMemo(
    () => (state.interval === "DAILY" ? fromISODate(baseDate(state.date)) : null),
    [state.interval, state.date],
  );
  const selectedDate = allDays ? null : refDate;
  const [viewMonth, setViewMonth] = React.useState<Date>(refDate ?? new Date());

  React.useEffect(() => {
    if (refDate) setViewMonth(refDate);
  }, [refDate?.getFullYear(), refDate?.getMonth()]);

  const handleDateChange = (d?: Date) => {
    if (!d) return;
    onChange({ date: toISODate(d), year: String(d.getFullYear()) });
    setDateOpen(false);
  };

  /** Arrow navigation: focus the whole month being browsed. */
  const handleMonthChange = (m: Date) => {
    setViewMonth(m);
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    onChange({ date: toAllDays(toISODate(first)), year: String(first.getFullYear()) });
  };

  const handleAllDays = () => {
    const ref = viewMonth ?? refDate ?? new Date();
    const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
    onChange({ date: toAllDays(toISODate(first)), year: String(first.getFullYear()) });
    setDateOpen(false);
  };

  if (state.interval === "DAILY") {
    return (
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 w-full justify-start gap-2 px-3 text-left text-sm font-normal",
              !selectedDate && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">
              {allDays
                ? `All days${refDate ? ` — ${MONTHS.find((m) => m.value === refDate.getMonth() + 1)?.name} ${refDate.getFullYear()}` : ""}`
                : selectedDate
                  ? formatLongDate(selectedDate)
                  : "Pick a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {allowAllDays && (
            <button
              type="button"
              onClick={handleAllDays}
              className={cn(
                "flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted",
                allDays && "bg-muted",
              )}
            >
              <span className="font-medium">All (whole month)</span>
              {allDays ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          )}
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={handleDateChange}
            month={viewMonth}
            onMonthChange={handleMonthChange}
            labels={{
              labelPrevious: () => "Previous month",
              labelNext: () => "Next month",
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
  }
  if (state.interval === "WEEKLY") {
    return <WeekMultiSelect state={state} onChange={onChange} />;
  }
  if (state.interval === "MONTHLY") {
    return <MonthMultiSelect value={state.months} onChange={(months) => onChange({ months })} />;
  }
  if (state.interval === "QUARTERLY") {
    return (
      <Select value={state.quarter} onValueChange={(v) => onChange({ quarter: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Quarter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quarters</SelectItem>
          <SelectItem value="q1">1st Quarter</SelectItem>
          <SelectItem value="q2">2nd Quarter</SelectItem>
          <SelectItem value="q3">3rd Quarter</SelectItem>
          <SelectItem value="q4">4th Quarter</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (state.interval === "SEMESTER") {
    return (
      <Select value={state.semester} onValueChange={(v) => onChange({ semester: v })}>
        <SelectTrigger>
          <SelectValue placeholder="Semester" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Semesters</SelectItem>
          <SelectItem value="s1">1st Semester</SelectItem>
          <SelectItem value="s2">2nd Semester</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  // ANNUAL: no sub-filter control.
  return null;
}

/* ------------------------------------------------------------------ *
 * Filter bar
 * ------------------------------------------------------------------ */
export function ModuleFilterBar({
  title = "Filters",
  years,
  state,
  onChange,
  onReset,
  leading,
  children,
  intervals,
  allowAllDays = true,
}: {
  title?: string;
  years: number[];
  state: ModuleFilterState;
  onChange: (patch: Partial<ModuleFilterState>) => void;
  onReset: () => void;
  /** Optional control rendered before the Year select (e.g. search). */
  leading?: React.ReactNode;
  /** Province + Station controls. */
  children?: React.ReactNode;
  /** Restricts the selectable periods (defaults to all). */
  intervals?: ModuleInterval[];
  /** DAILY only: when false, the "All (whole month)" shortcut is hidden. */
  allowAllDays?: boolean;
}) {
  const subFilterLabel: Record<string, string> = {
    DAILY: "Date",
    WEEKLY: "Week",
    MONTHLY: "Month",
    QUARTERLY: "Quarter",
    SEMESTER: "Semester",
  };
  const subLabel = subFilterLabel[state.interval];

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-5">
          {leading}

          <FilterField label="Year">
            <Select value={state.year} onValueChange={(v) => onChange({ year: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Period">
            <PeriodSelect value={state.interval} onChange={onChange} intervals={intervals} />
          </FilterField>

          {subLabel ? (
            <FilterField label={subLabel}>
              <SubFilterControl state={state} onChange={onChange} allowAllDays={allowAllDays} />
            </FilterField>
          ) : null}

          {children}
        </div>

        <ResetFiltersButton onReset={onReset} className="shrink-0" />
      </div>
    </div>
  );
}

export default ModuleFilterBar;
