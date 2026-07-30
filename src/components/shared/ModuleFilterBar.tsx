import * as React from "react";
import { CalendarIcon, RotateCcw, SlidersHorizontal } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMESTER", label: "Semester" },
  { value: "ANNUAL", label: "Annual" },
];

export function defaultModuleFilterState(): ModuleFilterState {
  const now = new Date();
  return {
    year: String(now.getFullYear()),
    interval: "MONTHLY",
    date: toISODate(now),
    months: [now.getMonth() + 1],
    quarter: "q1",
    semester: "s1",
  };
}

/** Expands the current selection into the concrete list of months. */
export function resolveModuleMonths(state: ModuleFilterState): number[] {
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  switch (state.interval) {
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
function MonthMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const label =
    value.length === 0
      ? "All months"
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
        <Button
          variant="outline"
          className={cn(
            "h-10 w-full justify-start px-3 text-left text-sm font-normal",
            value.length === 0 && "text-muted-foreground",
          )}
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
              <Checkbox checked={value.includes(m.value)} onCheckedChange={() => toggle(m.value)} />
              {m.name}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
  const [dateOpen, setDateOpen] = React.useState(false);
  const selectedDate = React.useMemo(
    () => (state.interval === "DAILY" ? fromISODate(state.date) : null),
    [state.interval, state.date],
  );

  const handleIntervalChange = (v: string) => {
    const next = v as ModuleInterval;
    if (next === "DAILY") {
      const today = new Date();
      onChange({ interval: next, date: toISODate(today), year: String(today.getFullYear()) });
      return;
    }
    onChange({ interval: next });
  };

  const handleDateChange = (d?: Date) => {
    if (!d) return;
    onChange({ date: toISODate(d), year: String(d.getFullYear()) });
    setDateOpen(false);
  };

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

        <Select value={state.interval} onValueChange={handleIntervalChange}>
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

        {state.interval === "DAILY" ? (
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
        ) : state.interval === "MONTHLY" ? (
          <MonthMultiSelect value={state.months} onChange={(months) => onChange({ months })} />
        ) : state.interval === "QUARTERLY" ? (
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
        ) : state.interval === "SEMESTER" ? (
          <Select value={state.semester} onValueChange={(v) => onChange({ semester: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="s1">1st Semester</SelectItem>
              <SelectItem value="s2">2nd Semester</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        {children}

        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="col-span-2 justify-self-end self-center md:col-span-1"
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

export default ModuleFilterBar;
