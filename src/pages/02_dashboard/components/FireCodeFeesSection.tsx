import * as React from "react";
import { ChevronDown, Coins, Loader2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import FilterField from "@/components/filter-field";
import { cn } from "@/lib/utils";
import {
  LocationMultiSelect,
  type SelectedLocation,
} from "@/components/location-multi-select";
import {
  StationMultiSelect,
  type SelectedStation,
} from "@/components/station-multi-select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";

import { unwrap } from "@/lib/api-envelope";
import { buildDashboardProvinces, provincesPayloadKey } from "@/pages/02_dashboard/buildProvincesPayload";
import { firecodefeesAPI } from "@/services/firecodefeesAPI";
import type {
  FSISFeeCollectionDetailModel,
  FSISFeeCollectionParamClass,
} from "@/types/firecodefeesType";
import {
  FEE_SECTORS,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  SECTOR_BY_CODE,
  flattenFeeAccomItems,
  peso,
} from "@/pages/13_firecodefees/feeColumns";
import { groupCategories, useFeeCategories } from "@/pages/13_firecodefees/components/feeCategories";
import {
  MODES,
  emptyValues,
  sumAmounts,
  type SectorValues,
} from "@/pages/13_firecodefees/components/feeShared";

/* -------------------------------------------------------------------------- */
/*  Period model — the comparison is always annual (all months)                */
/* -------------------------------------------------------------------------- */

const ANNUAL_INTERVAL_CODE = 6;

const allMonths = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* -------------------------------------------------------------------------- */
/*  Aggregation helpers                                                        */
/* -------------------------------------------------------------------------- */

const addRecord = (target: SectorValues, rec: FSISFeeCollectionDetailModel) => {
  for (const item of flattenFeeAccomItems(rec)) {
    const sector = SECTOR_BY_CODE.get(Number(item.sectorno));
    if (!sector) continue;
    const mode =
      Number(item.fsicmode) === FIRE_CODE_MODE_FSIS ? FIRE_CODE_MODE_FSIS : FIRE_CODE_MODE_MANUAL;
    const feecateg = Number(item.feecateg) || 0;
    target[sector][mode][feecateg] =
      (target[sector][mode][feecateg] ?? 0) + (Number(item.collectedamount ?? 0) || 0);
  }
};

/** Combined Manual + FSIS amount of one fee category for a sector. */
const categoryTotal = (v: SectorValues, sector: string, feecateg: number) =>
  MODES.reduce((a, m) => a + (v[sector as keyof SectorValues][m.code][feecateg] ?? 0), 0);

const sectorGrand = (v: SectorValues, sector: string) =>
  MODES.reduce((a, m) => a + sumAmounts(v[sector as keyof SectorValues][m.code]), 0);

/** Every record of the ledger response, regardless of nesting depth. */
function pickRecords(data: unknown): FSISFeeCollectionDetailModel[] {
  const out: FSISFeeCollectionDetailModel[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(walk);
    const obj = value as Record<string, unknown>;
    const isRecord =
      !!obj.feeno &&
      (Array.isArray(obj.sectorlist) ||
        Array.isArray(obj.accomfeelist) ||
        obj.dateaccomplish !== undefined);
    if (isRecord) {
      out.push(obj as unknown as FSISFeeCollectionDetailModel);
      return;
    }
    if (Array.isArray(obj.feedetaillist)) (obj.feedetaillist as unknown[]).forEach(walk);
    if (Array.isArray(obj.data)) (obj.data as unknown[]).forEach(walk);
    else if (obj.data && typeof obj.data === "object") walk(obj.data);
  };
  walk(data);
  return out;
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
                    onCheckedChange={() => toggleYear(year)}
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
  const monthsInScope = React.useMemo(() => allMonths(), []);

  const provincesPayload = React.useMemo(
    () => buildDashboardProvinces(provinces, stations),
    [provinces, stations],
  );
  const scopeKey = provincesPayloadKey(provincesPayload);
  const yearsKey = sortedYears.join(",");
  const monthsKey = monthsInScope.join(",");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const yearList = yearsKey.split(",").map(Number).filter(Boolean);
      const monthList = monthsKey.split(",").map(Number).filter(Boolean);
      const Provinces = provincesPayload.map<FSISFeeCollectionParamClass>((p) => ({
        Provinceno: p.provinceno,
        Stationnos: p.stationnos,
      }));

      const results = await Promise.all(
        yearList.map(async (year) => {
          const resp = await firecodefeesAPI.getLedger(
            {
              parameters: {
                Searchkey: "",
                Reportyear: year,
                Reportmonth: monthList,
                Interval: ANNUAL_INTERVAL_CODE,
                Dateaccomplish: `${year}-01-01`,
                Provinces,
              },
              pagenumber: 1,
              pagesize: 500,
            },
            { suppressGlobalLoading: true, suppressErrorToast: true },
          );
          const { ok, data: payload } = unwrap<unknown>(resp);
          const records = ok ? pickRecords(payload) : [];

          const values = emptyValues();
          for (const rec of records) {
            const iso = String(rec?.dateaccomplish ?? "").slice(0, 10);
            if (!iso || Number(iso.slice(0, 4)) !== year) continue;
            const month = Number(iso.slice(5, 7)) || 0;
            if (!monthList.includes(month)) continue;
            addRecord(values, rec);
          }
          return { year, values };
        }),
      );

      if (cancelled) return;
      setData(results);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsKey, monthsKey, scopeKey]);

  const groups = React.useMemo(() => groupCategories(categories), [categories]);
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
      <div className="mb-1 flex items-center gap-2">
        <Coins className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Fire Code Fees Collection</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Year to Year Data Comparison</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterField label="Years">
          <YearMultiSelect value={years} onChange={setYears} />
        </FilterField>

        <FilterField label="Provinces">
          {scope.provinceLocked ? (
            <ReadOnlyField
              value={scope.provincename}
              placeholder="All provinces"
              title="Restricted to your assigned province"
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
              className="w-full"
            />
          )}
        </FilterField>

        <FilterField label="Stations">
          {scope.stationLocked ? (
            <ReadOnlyField
              value={scope.stationname}
              placeholder="All stations"
              title="Restricted to your assigned station"
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
            />
          )}
        </FilterField>
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
                        FEE_SECTORS.reduce(
                          (a, s) => a + categoryTotal(v, s.key, c.detno),
                          0,
                        )
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
                              const amount = v ? categoryTotal(v, s.key, c.detno) : 0;
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
