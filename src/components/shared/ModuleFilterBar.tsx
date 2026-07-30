import * as React from "react";
import { CalendarIcon, RotateCcw, SlidersHorizontal, ChevronDown, Check } from "lucide-react";
import ResetFiltersButton from "@/components/reset-filters-button";

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
  /** DAILY: selected ISO `yyyy-mm-dd` date. */
  date: string;
  /** MONTHLY: one or more selected month numbers (1..12). */
  months: number[];
  /** QUARTERLY: `q1`..`q4`. */
  quarter: string;
  /** SEMESTER: `s1` | `s2`. */
  semester: string;
}

export const MODULE_INTERVALS: { value: ModuleInterval; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMESTER", label: "Semester" },
  { value: "ANNUAL", label: "Annual" },
];

export function defaultModuleFilterState(): ModuleFilterState {
  const now = new Date();
  const month = now.getMonth() + 1;
  return {
    year: String(now.getFullYear()),
    interval: "ALL",
    date: toISODate(now),
    months: [month],
    quarter: `q${Math.ceil(month / 3)}`,
    semester: month <= 6 ? "s1" : "s2",
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
      const d = fromISODate(state.date);
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
        default:
          return ALL;
      }
    case "SEMESTER":
      return state.semester === "s2" ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];
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
  const label =
    value.length === 0
      ? "Select month"
      : value.length === 1
        ? MONTHS.find((m) => m.value === value[0])?.name
        : `${value.length} months selected`;

  const toggle = (m: number) => {
    onChange(
      value.includes(m) ? value.filter((v) => v !== m) : [...value, m].sort((a, b) => a - b),
    );
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
          {MONTHS.map((m) => {
            const sel = value.includes(m.value);
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

/* ------------------------------------------------------------------ *
 * PERIOD select + SUB FILTER control (shared by the filter bar and the
 * matrix dialogs so there is a single implementation).
 * ------------------------------------------------------------------ */
export function PeriodSelect({
  value,
  onChange,
}: {
  value: ModuleInterval;
  onChange: (patch: Partial<ModuleFilterState>) => void;
}) {
  const handleIntervalChange = (v: string) => {
    const next = v as ModuleInterval;
    const today = new Date();
    const month = today.getMonth() + 1;
    if (next === "ALL" || next === "ANNUAL") {
      onChange({ interval: next });
      return;
    }
    if (next === "DAILY") {
      onChange({ interval: next, date: toISODate(today), year: String(today.getFullYear()) });
      return;
    }
    if (next === "MONTHLY") {
      onChange({ interval: next, months: [month] });
      return;
    }
    if (next === "QUARTERLY") {
      onChange({ interval: next, quarter: `q${Math.ceil(month / 3)}` });
      return;
    }
    if (next === "SEMESTER") {
      onChange({ interval: next, semester: month <= 6 ? "s1" : "s2" });
      return;
    }
    onChange({ interval: next });
  };

  return (
    <Select value={value} onValueChange={handleIntervalChange}>
      <SelectTrigger>
        <SelectValue placeholder="Period" />
      </SelectTrigger>
      <SelectContent>
        {MODULE_INTERVALS.map((it) => (
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
}: {
  state: ModuleFilterState;
  onChange: (patch: Partial<ModuleFilterState>) => void;
}) {
  const [dateOpen, setDateOpen] = React.useState(false);
  const selectedDate = React.useMemo(
    () => (state.interval === "DAILY" ? fromISODate(state.date) : null),
    [state.interval, state.date],
  );

  const handleDateChange = (d?: Date) => {
    if (!d) return;
    onChange({ date: toISODate(d), year: String(d.getFullYear()) });
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
              {selectedDate ? formatLongDate(selectedDate) : "Pick a date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={handleDateChange}
            defaultMonth={selectedDate ?? undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    );
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
          <SelectItem value="s1">1st Semester</SelectItem>
          <SelectItem value="s2">2nd Semester</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  // ALL / ANNUAL: no sub-filter control.
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
}) {

  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" /> {title}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {leading}

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

        <PeriodSelect value={state.interval} onChange={onChange} />

        <SubFilterControl state={state} onChange={onChange} />

        {children}

        <ResetFiltersButton
          onReset={onReset}
          className="col-span-2 justify-self-end self-center md:col-span-1"
        />
      </div>
    </div>
  );
}

export default ModuleFilterBar;
