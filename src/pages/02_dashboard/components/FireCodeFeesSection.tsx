import * as React from "react";
import { ChevronDown, ChevronUp, Coins, Construction, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { groupByParent, useFeeCategories, type FeeCategory } from "./fees/feeCategories";
import { FeeTypeMultiSelect, useFeeTypes } from "./fees/FeeTypeMultiSelect";
import { MODES, emptyValues, sumAmounts, type SectorValues } from "./fees/feeShared";

/* -------------------------------------------------------------------------- */
/*  Aggregation helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Combined Manual + FSIS amount of one fee category for a sector. */
const categoryTotal = (v: SectorValues, sector: string, feecateg: number) =>
  MODES.reduce((a, m) => a + (v[sector as keyof SectorValues][m.code][feecateg] ?? 0), 0);

const sectorGrand = (v: SectorValues, sector: string) =>
  MODES.reduce((a, m) => a + sumAmounts(v[sector as keyof SectorValues][m.code]), 0);

/** The dashboard collection summary is intentionally limited to BPLO. */
const DASHBOARD_FEE_SECTORS = FEE_SECTORS.filter((sector) => sector.key === "bplo");

/**
 * Fee categories exactly as the API returns them: one row per `feecateg`,
 * labelled with `feecategname`, carrying its `feeparentno` / `feeparentcode` /
 * `feeparentname` so the table can group the rows under their parent.
 */
function buildApiFeeCategories(payload: DashboardFeeCollectionModel[] | null): FeeCategory[] {
  const byCateg = new Map<number, FeeCategory>();
  for (const yearEntry of payload ?? []) {
    for (const fee of yearEntry?.feeList ?? []) {
      const feecateg = Number(fee?.feecateg) || 0;
      if (!feecateg || byCateg.has(feecateg)) continue;
      const label = String(fee?.feecategname ?? "").trim() || String(fee?.feecategcode ?? "").trim();
      const parentcode = String(fee?.feeparentcode ?? "").trim();
      const parentname = String(fee?.feeparentname ?? "").trim();
      byCateg.set(feecateg, {
        key: `fee-${feecateg}`,
        detno: feecateg,
        code: parentcode || parentname,
        label: label || String(feecateg),
        groupLabel: parentname || parentcode,
        parentno: Number(fee?.feeparentno) || 0,
        parentname: parentname || parentcode,
      });
    }
  }
  return [...byCateg.values()];
}

function mapSummaryToYears(
  payload: DashboardFeeCollectionModel[] | null,
  years: number[],
): { year: number; values: SectorValues }[] {
  const byYear = new Map<number, SectorValues>(years.map((y) => [y, emptyValues()]));

  for (const yearEntry of payload ?? []) {
    const year = Number(yearEntry?.reportyear) || 0;
    const values = byYear.get(year);
    if (!values) continue;

    for (const rawFee of yearEntry?.feeList ?? []) {
      const feecateg = Number(rawFee?.feecateg) || 0;
      if (!feecateg) continue;
      const amount = Number(rawFee?.collectionamount ?? 0) || 0;
      const bucket = values.bplo[FIRE_CODE_MODE_FSIS];
      bucket[feecateg] = (bucket[feecateg] ?? 0) + amount;
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
          className="h-11 w-full shrink-0 justify-between rounded-lg border border-border/70 bg-card/80 px-3.5 text-sm font-medium text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:w-[180px] md:rounded-md"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 text-primary" />
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
  const [collapsed, setCollapsed] = React.useState(true);
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
      const { ok, data: payload } = unwrap<DashboardFeeCollectionModel[]>(resp);

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
  const allGroups = React.useMemo(() => groupByParent(displayCategories), [displayCategories]);
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
      (g) => matches(g.code) || matches(g.name) || g.items.some((i) => matches(i.label)),
    );
    return filtered.length ? filtered : [];
  }, [allGroups, feeTypes, feeTypeOptions]);

  const valuesOf = React.useCallback(
    (year: number) => data.find((d) => d.year === year)?.values,
    [data],
  );

  /** Per-year grand total (all sectors, both modes). */
  const yearTotal = (year: number) => {
    const v = valuesOf(year);
    if (!v) return 0;
    return DASHBOARD_FEE_SECTORS.reduce((a, s) => a + sectorGrand(v, s.key), 0);
  };

  const yearColClass = "w-[12%] min-w-[90px]";

  const mobileRows = React.useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => {
          const yearlyTotals = sortedYears.map((year) => {
            const v = valuesOf(year);
            const total = v
              ? DASHBOARD_FEE_SECTORS.reduce(
                  (sum, sector) => sum + categoryTotal(v, sector.key, item.detno),
                  0,
                )
              : 0;
            return { year, total };
          });

          return {
            key: item.key,
            label: item.label,
            yearlyTotals,
            collectionTotal: yearlyTotals.reduce((sum, row) => sum + row.total, 0),
          };
        }),
      ),
    [groups, sortedYears, valuesOf],
  );

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="border-b border-border/60 p-3 sm:p-4">
        <div className="space-y-3">
          <div
            className="flex cursor-pointer items-start justify-between gap-3 rounded-lg transition-colors hover:bg-muted/20"
            onClick={() => setCollapsed((v) => !v)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setCollapsed((v) => !v);
              }
            }}
            role="button"
            tabIndex={0}
            aria-expanded={!collapsed}
            aria-label={
              collapsed
                ? "Show Fire Code Fees Yearly Collection Comparison"
                : "Hide Fire Code Fees Yearly Collection Comparison"
            }
          >
            <div className="min-w-0 border-b border-border/60 pb-2.5">
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/8 text-primary ring-1 ring-primary/15">
                  <Coins className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold leading-tight tracking-tight">
                  Fire Code Fees Yearly Collection Comparison
                </h3>
              </div>
              <p className="pl-10 text-sm text-muted-foreground">Year to Year Data Comparison</p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setCollapsed((v) => !v);
              }}
              className="h-8 w-8 shrink-0 rounded-md border border-border/60 bg-background/60 p-0 text-muted-foreground hover:bg-accent"
              aria-label={
                collapsed
                  ? "Show Fire Code Fees Yearly Collection Comparison"
                  : "Hide Fire Code Fees Yearly Collection Comparison"
              }
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>

          {!collapsed && (
            <>
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100">
                <Construction className="h-4 w-4" />
                <AlertTitle className="font-semibold">Note</AlertTitle>
                <AlertDescription>
                  This feature is under development. The matrix output may still change.
                </AlertDescription>
              </Alert>

              <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:bg-muted/20 md:p-2">
                <div className="grid w-full grid-cols-1 gap-2 md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
                  <YearMultiSelect value={years} onChange={setYears} />

                  <FeeTypeMultiSelect
                    options={feeTypeOptions}
                    loading={feeTypesLoading}
                    value={feeTypes}
                    onChange={setFeeTypes}
                    className="h-11 w-full rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-2 focus-visible:ring-primary/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
                  />

                  {scope.provinceLocked ? (
                    <ReadOnlyField
                      value={scope.provincename}
                      placeholder="All provinces"
                      title="Restricted to your assigned province"
                      className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
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
                      className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
                    />
                  )}

                  {scope.stationLocked ? (
                    <ReadOnlyField
                      value={scope.stationname}
                      placeholder="All stations"
                      title="Restricted to your assigned station"
                      className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
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
                      className="h-11 w-full shrink-0 rounded-lg border border-border/70 bg-card/80 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-primary/40 hover:bg-accent/30 md:h-10 md:min-w-[180px] md:w-[220px] md:rounded-md"
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!collapsed && loading ? (
        <div className="m-4 flex items-center justify-center gap-2 rounded-xl border border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading collection records…
        </div>
      ) : null}

      {!collapsed && !loading ? (
        <>
          <div className="hidden p-3 md:block">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-[10px] sm:text-[11px]">
                  <colgroup>
                    <col className="w-[34%]" />
                    {DASHBOARD_FEE_SECTORS.map((s) => (
                      <React.Fragment key={`${s.key}-colgroup`}>
                        {sortedYears.map((y) => (
                          <col key={`${s.key}-${y}-col`} className="w-[12%]" />
                        ))}
                      </React.Fragment>
                    ))}
                  </colgroup>
                  <thead className="bg-[var(--head-soft)] text-[var(--head-soft-foreground)]">
                    <tr>
                      <th
                        rowSpan={2}
                        className="sticky left-0 z-30 border-r border-grid bg-[var(--head-soft)] px-2 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--head-soft-foreground)] sm:px-2.5"
                      >
                        Fee Category
                      </th>
                      {DASHBOARD_FEE_SECTORS.map((s) => (
                        <th
                          key={s.key}
                          colSpan={sortedYears.length}
                          className="border-l border-grid bg-[var(--head-soft)] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--head-soft-foreground)] sm:px-2.5"
                        >
                          {s.label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {DASHBOARD_FEE_SECTORS.map((s) => (
                        <React.Fragment key={`${s.key}-years`}>
                          {sortedYears.map((y, yi) => (
                            <th
                              key={`${s.key}-${y}`}
                              className={cn(
                                "border-l border-grid bg-[var(--head-soft)] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--head-soft-foreground)] sm:px-2.5",
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
                  <tbody className="bg-card">
                    {groups.map((g) => (
                      <React.Fragment key={g.parentno || g.code || g.name}>
                        <tr className="group-row bg-primary/5">
                          <td className="sticky left-0 z-20 border-r border-grid bg-transparent px-2 py-1.5 before:pointer-events-none before:absolute before:inset-0 before:bg-transparent before:content-['']">
                            <span className="relative text-[10px] font-bold uppercase tracking-wider">
                              {g.code || g.name}
                            </span>
                            {g.items.length > 1 && g.name && g.name !== g.code ? (
                              <span className="relative ml-1.5 text-[10px] font-normal normal-case text-muted-foreground">
                                {g.name}
                              </span>
                            ) : null}
                          </td>
                          {DASHBOARD_FEE_SECTORS.map((s) => (
                            <td
                              key={`${s.key}-g`}
                              colSpan={sortedYears.length}
                              className="border-l border-grid px-3 py-1.5"
                            />
                          ))}
                        </tr>
                        {g.items.map((c) => {
                          const rowTotal = sortedYears.reduce((yearAcc, y) => {
                            const v = valuesOf(y);
                            if (!v) return yearAcc;
                            return (
                              yearAcc +
                              DASHBOARD_FEE_SECTORS.reduce(
                                (a, s) => a + categoryTotal(v, s.key, c.detno),
                                0,
                              )
                            );
                          }, 0);
                          return (
                            <tr key={c.key} className="border-b border-grid transition-colors hover:bg-muted/20">
                              <td className="sticky left-0 z-20 border-r border-grid bg-card px-2 py-2 align-middle text-foreground/90 sm:px-2.5">
                                {c.label}
                              </td>
                              {DASHBOARD_FEE_SECTORS.map((s) => (
                                <React.Fragment key={`${s.key}-${c.key}`}>
                                  {sortedYears.map((y, yi) => {
                                    const v = valuesOf(y);
                                    const amount = v ? categoryTotal(v, s.key, c.detno) : 0;
                                    return (
                                      <td
                                        key={`${s.key}-${c.key}-${y}`}
                                        className={cn(
                                          "border-l border-grid bg-card px-2 py-2 text-right tabular-nums sm:px-2.5",
                                          yearColClass,
                                          yi === 0 && "border-l border-grid",
                                          !amount && "text-muted-foreground",
                                        )}
                                      >
                                        {peso(amount)}
                                      </td>
                                    );
                                  })}
                                </React.Fragment>
                              ))}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {mobileRows.map((row) => (
              <article key={row.key} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                <div className="border-b border-border/60 bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground">
                  {row.label}
                </div>

                <div className="grid grid-cols-2 gap-px bg-border/60 text-xs">
                  {row.yearlyTotals.map(({ year, total }) => (
                    <div key={`${row.key}-${year}`} className="bg-card p-3">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {year}
                      </div>
                      <div className="mt-1 font-semibold tabular-nums text-foreground">
                        {peso(total)}
                      </div>
                    </div>
                  ))}
                </div>

              </article>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}
