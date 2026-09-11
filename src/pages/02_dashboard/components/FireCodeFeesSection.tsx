import * as React from "react";
import { ChevronDown, Coins, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { buildYears, cn } from "@/lib/utils";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";

import { unwrap } from "@/lib/api-envelope";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
} from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardFeeCollectionModel } from "@/types/dashboardType";
import {
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIS,
  SECTOR_BY_CODE,
  peso,
  sectorKeyFromCode,
} from "./fees/feeColumns";
import {
  groupCategories,
  useFeeCategories,
  type FeeCategory,
} from "./fees/feeCategories";
import { FeeTypeMultiSelect, useFeeTypes } from "./fees/FeeTypeMultiSelect";
import {
  MODES,
  emptyValues,
  sumAmounts,
  type SectorValues,
} from "./fees/feeShared";

/* -------------------------------------------------------------------------- */
/*  Aggregation helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Combined Manual + FSIS amount of one fee category for a sector. */
const categoryTotal = (v: SectorValues, sector: string, categIndex: number) =>
  MODES.reduce((a, m) => a + (v[sector as keyof SectorValues][m.code][categIndex] ?? 0), 0);

const sectorGrand = (v: SectorValues, sector: string) =>
  MODES.reduce((a, m) => a + sumAmounts(v[sector as keyof SectorValues][m.code]), 0);

/**
 * API grouped summary keys: the backend aggregates by fee parent code, not by
 * the local printed report-column order. Use the parent code as the canonical
 * grouping key so the plotted values match the payload returned by the API.
 */
const apiFeeGroupKey = (
  fee: Partial<{
    feeparentcode: string | null;
    feecategcode: string | number | null;
    feecateg: number | string | null;
    feecategname: string | null;
  }>,
) => String(fee?.feeparentcode ?? fee?.feecategcode ?? fee?.feecateg ?? fee?.feecategname ?? "").trim();

const apiFeeLabel = (
  fee: Partial<{
    feeparentcode: string | null;
    feecategcode: string | number | null;
    feecategname: string | null;
  }>,
) =>
  String(fee?.feecategname ?? fee?.feecategcode ?? fee?.feeparentcode ?? "").trim();

function buildApiFeeCategories(payload: DashboardFeeCollectionModel | null): FeeCategory[] {
  const byKey = new Map<string, FeeCategory>();
  for (const fee of payload?.feeList ?? []) {
    const key = apiFeeGroupKey(fee);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, {
      key: `api-${key}`,
      detno: Number(fee?.feecateg) || 0,
      code: key,
      label: apiFeeLabel(fee) || key,
      groupLabel: apiFeeLabel(fee) || key,
    });
  }
  return [...byKey.values()];
}

function mapSummaryToYears(
  payload: DashboardFeeCollectionModel | null,
  years: number[],
): { year: number; values: SectorValues }[] {
  const byYear = new Map<number, SectorValues>(years.map((y) => [y, emptyValues()]));
  const categoryOrder = new Map<string, number>();

  for (const fee of payload?.feeList ?? []) {
    const key = apiFeeGroupKey(fee);
    if (!key) continue;
    if (!categoryOrder.has(key)) categoryOrder.set(key, categoryOrder.size);
  }

  for (const fee of payload?.feeList ?? []) {
    const key = apiFeeGroupKey(fee);
    if (!key) continue;
    const categoryIndex = categoryOrder.get(key) ?? 0;
    for (const yearEntry of fee.yearList ?? []) {
      const values = byYear.get(Number(yearEntry?.reportyear));
      if (!values) continue;
      for (const sector of yearEntry.sectors ?? []) {
        const sectorKey =
          SECTOR_BY_CODE.get(Number(sector?.sectorno)) ??
          sectorKeyFromCode(String(sector?.sectorcode ?? ""));
        if (!sectorKey) continue;
        const bucket = values[sectorKey as keyof SectorValues][FIRE_CODE_MODE_FSIS];
        bucket[categoryIndex] = (bucket[categoryIndex] ?? 0) + (Number(sector?.collectionamount ?? 0) || 0);
      }
    }
  }

  return years.map((year) => ({ year, values: byYear.get(year) ?? emptyValues() }));
}


/* -------------------------------------------------------------------------- */
/*  Year multi-select — mirrors the Year-over-Year Inspection Comparison       */
/*  selector: minimum 2, maximum 5 years                                       */
/* -------------------------------------------------------------------------- */

const MIN_YEARS = 2;
const MAX_YEARS = 5;

function defaultYears(): number[] {
  const now = new Date().getFullYear();
  return [now - 2, now - 1, now];
}

function YearMultiSelect({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const options = React.useMemo(() => buildYears(), []);
  const label = value.length > 0 ? value.join(", ") : "Select years";

  const toggleYear = (year: number) => {
    const selected = value.includes(year);
    if (selected) {
      if (value.length <= MIN_YEARS) return; // keep at least two years
      onChange(value.filter((y) => y !== year));
      return;
    }
    const next = [...new Set([...value, year])].sort((a, b) => a - b);
    onChange(next.length > MAX_YEARS ? next.slice(next.length - MAX_YEARS) : next);
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
            {options.map((year) => {
              const checked = value.includes(year);
              return (
                <label
                  key={year}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(checkedState: boolean | "indeterminate") => {
                      if (checkedState === "indeterminate") return;
                      toggleYear(year);
                    }}
                    aria-label={`Toggle ${year}`}
                  />
                  <span className="text-sm">{year}</span>
                </label>
              );
            })}
          </div>
          <div className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Select {MIN_YEARS} to {MAX_YEARS} years. Default is current year and previous 2 years.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export default function FireCodeFeesSection() {
  const { categories } = useFeeCategories();
  const { user, systemAccess, isAuthenticated } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  const [years, setYears] = React.useState<number[]>(defaultYears);
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>([]);
  const [stations, setStations] = React.useState<SelectedStation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{ year: number; values: SectorValues }[]>([]);
  const [apiCategories, setApiCategories] = React.useState<FeeCategory[]>([]);
  const { options: feeTypeOptions, loading: feeTypesLoading } = useFeeTypes();
  const [feeTypes, setFeeTypes] = React.useState<string[]>([]);

  // Role-based scope: seed the locked province / station.
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

  /** Province change: stations outside the picked provinces are dropped. */
  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinces(next);
    if (next.length === 0) {
      setStations([]);
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    setStations((prev) => prev.filter((s) => allowed.has(s.provinceno)));
  };

  /** Station change: provinces of the picked stations are added. */
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

  const sortedYears = React.useMemo(() => [...years].sort((a, b) => a - b), [years]);

  const provincesPayload = React.useMemo(
    () => buildDashboardProvinces(provinces, stations),
    [provinces, stations],
  );
  const scopeKey = provincesPayloadKey(provincesPayload);
  const yearsKey = sortedYears.join(",");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const yearList = yearsKey.split(",").map(Number).filter(Boolean);

      const resp = await dashboardAPI.getYearlyFireCodeFees(
        {
          reportyear: yearList,
          Provinces: provincesPayload,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      const { ok, data: payload } = unwrap<DashboardFeeCollectionModel>(resp);

      if (cancelled) return;
      const nextApiCategories = buildApiFeeCategories(ok ? payload : null);
      setApiCategories(nextApiCategories);
      setData(ok ? mapSummaryToYears(payload, yearList) : mapSummaryToYears(null, yearList));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsKey, scopeKey]);

  const displayCategories = React.useMemo(
    () => (apiCategories.length ? apiCategories : categories),
    [apiCategories, categories],
  );
  const allGroups = React.useMemo(() => groupCategories(displayCategories), [displayCategories]);
  /** Fee-type filter is display-only: category positions below stay untouched. */
  const groups = React.useMemo(() => {
    if (feeTypes.length === 0) return allGroups;
    const wanted = feeTypes.map((c) => c.toUpperCase());
    const selectedLabels = feeTypeOptions
      .filter((o) => feeTypes.includes(o.code))
      .map((o) => o.label.toUpperCase());
    const matches = (text: string) => {
      const t = text.toUpperCase();
      return (
        wanted.some((c) => c && (t === c || t.includes(c))) ||
        selectedLabels.some((l) => l && (t === l || t.includes(l)))
      );
    };
    const filtered = allGroups.filter(
      (g) => matches(g.code) || matches(g.label) || g.items.some((i) => matches(i.label)),
    );
    return filtered.length ? filtered : [];
  }, [allGroups, feeTypes, feeTypeOptions]);
  /** Report-order position of each category — the API keys amounts by position. */
  const categIndex = React.useMemo(() => {
    const map = new Map<string, number>();
    displayCategories.forEach((c, i) => map.set(c.key, i));
    return map;
  }, [displayCategories]);

  const valuesOf = React.useCallback(
    (year: number) => data.find((d) => d.year === year)?.values,
    [data],
  );

  /** Per-year grand total (all sectors, both modes). */
  const yearTotal = (year: number) => {
    const v = valuesOf(year);
    if (!v) return 0;
    return FEE_SECTORS.reduce((a, s) => a + sectorGrand(v, s.key), 0);
  };

  const yearColClass = "w-32 min-w-32";

  return (
    <Card className="border-border/60 bg-card p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Fire Code Fees Collection</h3>
          </div>
          <p className="text-xs text-muted-foreground">Year to Year Data Comparison</p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <YearMultiSelect value={years} onChange={setYears} />

          <FeeTypeMultiSelect
            options={feeTypeOptions}
            loading={feeTypesLoading}
            value={feeTypes}
            onChange={setFeeTypes}
          />

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
              reportyear={sortedYears[sortedYears.length - 1]}
              onChange={handleStationsChange}
              placeholder="All stations"
              alwaysEnabled
              className="w-full shrink-0 sm:w-[240px]"
            />
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading collection records…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="head-soft sticky left-0 z-30 w-64 min-w-64 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider"
                >
                  Fee Category
                </th>
                {FEE_SECTORS.map((s) => (
                  <th
                    key={s.key}
                    colSpan={sortedYears.length}
                    className="head-soft border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
                  >
                    {s.label}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="head-soft border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
                >
                  Total
                </th>
              </tr>
              <tr>
                {FEE_SECTORS.map((s) => (
                  <React.Fragment key={`${s.key}-years`}>
                    {sortedYears.map((y, yi) => (
                      <th
                        key={`${s.key}-${y}`}
                        className={cn(
                          "head-soft px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider",
                          yearColClass,
                          yi === 0 && "border-l border-grid",
                        )}
                      >
                        {y}
                      </th>
                    ))}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g.label}>
                  <tr className="bg-primary/5">
                    <td className="sticky left-0 z-20 bg-card px-3 py-1.5 before:pointer-events-none before:absolute before:inset-0 before:bg-primary/5 before:content-['']">
                      <span className="relative text-[10px] font-bold uppercase tracking-wider text-primary">
                        {g.code || g.label}
                      </span>
                      {g.items.length > 1 && g.label ? (
                        <span className="relative ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                          {g.label}
                        </span>
                      ) : null}
                    </td>
                    {FEE_SECTORS.map((s) => (
                      <td
                        key={`${s.key}-g`}
                        colSpan={sortedYears.length}
                        className="border-l border-grid px-3 py-1.5"
                      />
                    ))}
                    <td className="border-l border-grid px-3 py-1.5" />
                  </tr>
                  {g.items.map((c) => {
                    const rowTotal = sortedYears.reduce((yearAcc, y) => {
                      const v = valuesOf(y);
                      if (!v) return yearAcc;
                      return (
                        yearAcc +
                        FEE_SECTORS.reduce((a, s) => a + categoryTotal(v, s.key, categIndex.get(c.key) ?? -1), 0)
                      );
                    }, 0);
                    return (
                      <tr key={c.key} className="border-t border-grid">
                        <td className="sticky left-0 z-20 w-64 min-w-64 border-t border-grid bg-card px-3 py-1.5 align-middle text-foreground/90">
                          {c.label}
                        </td>
                        {FEE_SECTORS.map((s) => (
                          <React.Fragment key={`${s.key}-${c.key}`}>
                            {sortedYears.map((y, yi) => {
                              const v = valuesOf(y);
                              const amount = v ? categoryTotal(v, s.key, categIndex.get(c.key) ?? -1) : 0;
                              return (
                                <td
                                  key={`${s.key}-${c.key}-${y}`}
                                  className={cn(
                                    "border-t border-grid px-3 py-1.5 text-right tabular-nums",
                                    yearColClass,
                                    yi === 0 && "border-l",
                                    !amount && "text-muted-foreground",
                                  )}
                                >
                                  {peso(amount)}
                                </td>
                              );
                            })}
                          </React.Fragment>
                        ))}
                        <td className="border-l border-t border-grid px-3 py-1.5 text-right font-semibold tabular-nums">
                          {peso(rowTotal)}
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
                {FEE_SECTORS.map((s) => (
                  <React.Fragment key={`${s.key}-total`}>
                    {sortedYears.map((y, yi) => {
                      const v = valuesOf(y);
                      const total = v ? sectorGrand(v, s.key) : 0;
                      return (
                        <td
                          key={`${s.key}-${y}-total`}
                          className={cn(
                            "px-3 py-2 text-right font-bold tabular-nums",
                            yearColClass,
                            yi === 0 && "border-l border-grid",
                          )}
                        >
                          {peso(total)}
                        </td>
                      );
                    })}
                  </React.Fragment>
                ))}
                <td className="border-l border-grid px-3 py-2 text-right font-bold tabular-nums text-primary">
                  {peso(sortedYears.reduce((a, y) => a + yearTotal(y), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
