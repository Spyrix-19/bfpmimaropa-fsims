import * as React from "react";
import { AlertTriangle, ChevronDown, Coins } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { buildYears, cn } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";

import { peso } from "./fees/feeColumns";
import { groupByParent, useFeeCategories } from "./fees/feeCategories";

/* -------------------------------------------------------------------------- */
/*  Period filters                                                             */
/* -------------------------------------------------------------------------- */

type Interval = "MONTHLY" | "QUARTERLY" | "SEMESTER" | "ANNUAL";

const INTERVALS: { value: Interval; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "SEMESTER", label: "Semester" },
  { value: "ANNUAL", label: "Annual" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SUB_OPTIONS: Record<Interval, { value: string; label: string }[]> = {
  MONTHLY: [
    { value: "all", label: "All Month" },
    ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
  ],
  QUARTERLY: [
    { value: "all", label: "All Quarter" },
    { value: "1", label: "1st Quarter" },
    { value: "2", label: "2nd Quarter" },
    { value: "3", label: "3rd Quarter" },
    { value: "4", label: "4th Quarter" },
  ],
  SEMESTER: [
    { value: "all", label: "All Semester" },
    { value: "1", label: "1st Semester" },
    { value: "2", label: "2nd Semester" },
  ],
  ANNUAL: [],
};

/** Column caption, e.g. "1st Semester 2026". */
function periodLabel(interval: Interval, sub: string, year: number) {
  if (interval === "ANNUAL") return `Annual ${year}`;
  const option = SUB_OPTIONS[interval].find((o) => o.value === sub);
  return `${option?.label ?? ""} ${year}`.trim();
}

/* -------------------------------------------------------------------------- */
/*  Year selector — exactly two years                                          */
/* -------------------------------------------------------------------------- */

const REQUIRED_YEARS = 2;

function defaultYears(): number[] {
  const now = new Date().getFullYear();
  return [now - 1, now];
}

function TwoYearSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const options = React.useMemo(() => buildYears(), []);
  const label = value.length > 0 ? value.join(" vs ") : "Select 2 years";

  const toggleYear = (year: number) => {
    if (value.includes(year)) return; // always keep exactly two
    // Replace the oldest year so the picked one becomes part of the pair.
    const next = [...value.slice(1), year].sort((a, b) => a - b);
    onChange(next.slice(-REQUIRED_YEARS));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full shrink-0 justify-between sm:w-[176px]"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Choose years
          </div>
          <div className="space-y-1">
            {options.map((year) => (
              <label
                key={year}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
              >
                <Checkbox
                  checked={value.includes(year)}
                  onCheckedChange={(checkedState: boolean | "indeterminate") => {
                    if (checkedState === "indeterminate") return;
                    toggleYear(year);
                  }}
                  aria-label={`Toggle ${year}`}
                />
                <span className="text-sm">{year}</span>
              </label>
            ))}
          </div>
          <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Only {REQUIRED_YEARS} years can be compared. Picking another year replaces the earlier
            one.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesVarianceSection() {
  const { categories } = useFeeCategories();
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const [years, setYears] = React.useState<number[]>(defaultYears);
  const [interval, setInterval] = React.useState<Interval>("SEMESTER");
  const [subPeriod, setSubPeriod] = React.useState<string>("1");
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>([]);
  const [stations, setStations] = React.useState<SelectedStation[]>([]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (scope.provinceLocked && scope.provinceno) {
      setProvinces((prev) =>
        prev.length === 1 && prev[0].locationno === scope.provinceno
          ? prev
          : [{ locationno: scope.provinceno, locationname: scope.provincename }],
      );
    }
    if (scope.stationLocked && scope.stationno) {
      setStations((prev) =>
        prev.length === 1 && prev[0].stationno === scope.stationno
          ? prev
          : [
              {
                stationno: scope.stationno,
                stationname: scope.stationname,
                provinceno: scope.provinceno,
                provincename: scope.provincename,
              },
            ],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    scope.provinceLocked,
    scope.stationLocked,
    scope.provinceno,
    scope.stationno,
  ]);

  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinces(next);
    if (next.length === 0) {
      setStations([]);
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    setStations((prev) => prev.filter((s) => allowed.has(s.provinceno)));
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStations(next);
    setProvinces((prev) => {
      const merged = [...prev];
      const known = new Set(merged.map((p) => p.locationno));
      next.forEach((s) => {
        if (!s.provinceno || known.has(s.provinceno)) return;
        known.add(s.provinceno);
        merged.push({ locationno: s.provinceno, locationname: s.provincename });
      });
      return merged;
    });
  };

  const handleIntervalChange = (next: Interval) => {
    setInterval(next);
    setSubPeriod(SUB_OPTIONS[next][0]?.value ?? "all");
  };

  const sortedYears = React.useMemo(() => [...years].sort((a, b) => a - b), [years]);
  const [baseYear, compareYear] = sortedYears;

  const groups = React.useMemo(() => groupByParent(categories), [categories]);

  /** Feature is under development: figures stay empty on purpose. */
  const amount = 0;

  /**
   * Comparison rules (base = first year, compare = second year):
   * - Variance: shortfall vs. base — max(0, base - compare). Zero when the
   *   compare year meets or exceeds the base.
   * - Positive listing: gain vs. base — max(0, compare - base).
   * - Percentage: compare / base * 100 ("—" when the base is zero).
   */
  const varianceOf = (base: number, compare: number) => Math.max(0, base - compare);
  const positiveOf = (base: number, compare: number) => Math.max(0, compare - base);
  const percentOf = (base: number, compare: number): number | null =>
    base === 0 ? null : (compare / base) * 100;
  const percentText = (pct: number | null): string =>
    pct === null ? "—" : `${Math.round(pct * 100) / 100}%`;
  /** Green when performance reaches or exceeds 100% of the base year. */
  const percentClass = (pct: number | null) =>
    pct !== null && pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground";

  const valueCellClass = "w-40 min-w-40 px-3 py-1.5 text-right tabular-nums text-muted-foreground";

  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Fire Code Fees Variance Comparison</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Combination of Manual Collection and Online Collection
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <TwoYearSelect value={years} onChange={setYears} />

          <Select value={interval} onValueChange={(v) => handleIntervalChange(v as Interval)}>
            <SelectTrigger className="h-9 w-full shrink-0 text-sm sm:w-[150px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {interval !== "ANNUAL" && (
            <Select value={subPeriod} onValueChange={setSubPeriod}>
              <SelectTrigger className="h-9 w-full shrink-0 text-sm sm:w-[160px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {SUB_OPTIONS[interval].map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {scope.provinceLocked ? (
            <ReadOnlyField
              value={scope.provincename}
              placeholder="All provinces"
              title="Restricted to your assigned province"
              className="w-full shrink-0 sm:w-[240px]"
            />
          ) : (
            <LocationMultiSelect
              mode="location"
              value={provinces}
              locationtype="PROVINCE"
              parentcode={MIMAROPA_REGION_CODE}
              onChange={handleProvincesChange}
              placeholder="All provinces"
              hideCode
              className="w-full shrink-0 sm:w-[240px]"
            />
          )}

          {scope.stationLocked ? (
            <ReadOnlyField
              value={scope.stationname}
              placeholder="All stations"
              title="Restricted to your assigned station"
              className="w-full shrink-0 sm:w-[240px]"
            />
          ) : (
            <StationMultiSelect
              mode="station"
              value={stations}
              provinces={provinces.map((p) => ({ provinceno: p.locationno }))}
              reportyear={compareYear}
              onChange={handleStationsChange}
              placeholder="All stations"
              alwaysEnabled
              className="w-full shrink-0 sm:w-[240px]"
            />
          )}
        </div>
      </div>

      <div
        role="note"
        className="mb-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
      >
        <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0" />
        <span>Note: This feature is under development. Figures shown here are not yet final.</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="head-soft sticky left-0 z-30 w-64 min-w-64 px-3 py-2 text-center align-middle text-[10px] font-bold uppercase tracking-wider"
              >
                Fire Code Fee Collection
              </th>
              <th
                colSpan={5}
                className="head-soft border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
              >
                Combination of Manual Collection and Online Collection
              </th>
            </tr>
            <tr>
              <th className="head-soft w-40 min-w-40 border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                {periodLabel(interval, subPeriod, baseYear)}
              </th>
              <th className="head-soft w-40 min-w-40 border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                {periodLabel(interval, subPeriod, compareYear)}
              </th>
              <th className="head-soft w-32 min-w-32 border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                Variance
              </th>
              <th className="head-soft w-32 min-w-32 border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                Positive Listing
              </th>
              <th className="head-soft w-24 min-w-24 border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g.parentno || g.code || g.name}>
                <tr className="bg-primary/5">
                  <td className="sticky left-0 z-20 bg-card px-3 py-1.5 before:pointer-events-none before:absolute before:inset-0 before:bg-primary/5 before:content-['']">
                    <span className="relative text-[10px] font-bold uppercase tracking-wider text-primary">
                      {g.code || g.name}
                    </span>
                    {g.items.length > 1 && g.name && g.name !== g.code ? (
                      <span className="relative ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                        {g.name}
                      </span>
                    ) : null}
                  </td>
                  <td className="border-l border-grid px-3 py-1.5" />
                  <td className="border-l border-grid px-3 py-1.5" />
                  <td className="border-l border-grid px-3 py-1.5" />
                  <td className="border-l border-grid px-3 py-1.5" />
                  <td className="border-l border-grid px-3 py-1.5" />
                </tr>
                {g.items.map((c) => {
                  const baseAmt = amount;
                  const compareAmt = amount;
                  const pct = percentOf(baseAmt, compareAmt);
                  return (
                    <tr key={c.key} className="border-t border-grid">
                      <td className="sticky left-0 z-20 w-64 min-w-64 border-t border-grid bg-card px-3 py-1.5 align-middle text-foreground/90">
                        {c.label}
                      </td>
                      <td className={cn("border-l border-t border-grid", valueCellClass)}>
                        {peso(baseAmt)}
                      </td>
                      <td className={cn("border-l border-t border-grid", valueCellClass)}>
                        {peso(compareAmt)}
                      </td>
                      <td className="w-32 min-w-32 border-l border-t border-grid px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {peso(varianceOf(baseAmt, compareAmt))}
                      </td>
                      <td className="w-32 min-w-32 border-l border-t border-grid px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {peso(positiveOf(baseAmt, compareAmt))}
                      </td>
                      <td
                        className={cn(
                          "w-24 min-w-24 border-l border-t border-grid px-3 py-1.5 text-right font-semibold tabular-nums",
                          percentClass(pct),
                        )}
                      >
                        {percentText(pct)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-grid bg-muted/60">
              <td className="sticky left-0 z-30 w-64 min-w-64 bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
                Total
              </td>
              <td className="w-40 min-w-40 border-l border-grid px-3 py-2 text-right font-bold tabular-nums">
                {peso(amount)}
              </td>
              <td className="w-40 min-w-40 border-l border-grid px-3 py-2 text-right font-bold tabular-nums">
                {peso(amount)}
              </td>
              <td className="w-32 min-w-32 border-l border-grid px-3 py-2 text-right font-bold tabular-nums">
                {peso(varianceOf(amount, amount))}
              </td>
              <td className="w-32 min-w-32 border-l border-grid px-3 py-2 text-right font-bold tabular-nums">
                {peso(positiveOf(amount, amount))}
              </td>
              <td
                className={cn(
                  "w-24 min-w-24 border-l border-grid px-3 py-2 text-right font-bold tabular-nums",
                  percentClass(percentOf(amount, amount)),
                )}
              >
                {percentText(percentOf(amount, amount))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
