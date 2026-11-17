import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { unwrap } from "@/lib/api-envelope";
import { buildDashboardProvinces, provincesPayloadKey } from "@/pages/02_dashboard/buildProvincesPayload";
import { dashboardAPI } from "@/services/dashboardAPI";
import type { DashboardFireCodeFeeStationModel } from "@/types/dashboardType";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { buildYears } from "@/lib/utils";
import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
import { peso } from "./fees/feeColumns";

interface FireCodeFeesVarianceStationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseYear: number;
  compareYear: number;
  initialProvinces: SelectedLocation[];
  initialStations: SelectedStation[];
  provinceLocked: boolean;
  provincename?: string;
  stationLocked: boolean;
  stationname?: string;
}

export function FireCodeFeesVarianceStationDetailModal({
  open,
  onOpenChange,
  baseYear,
  compareYear,
  initialProvinces,
  initialStations,
  provinceLocked,
  provincename,
  stationLocked,
  stationname,
}: FireCodeFeesVarianceStationDetailModalProps) {
  const [years, setYears] = React.useState<[number, number]>([baseYear, compareYear]);
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>(initialProvinces);
  const [stations, setStations] = React.useState<SelectedStation[]>(initialStations);
  const [rows, setRows] = React.useState<DashboardFireCodeFeeStationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [retry, setRetry] = React.useState(0);
  const [firstYear, secondYear] = years;
  const yearOptions = React.useMemo(() => buildYears(), []);

  React.useEffect(() => {
    if (!open) return;
    setYears([baseYear, compareYear]);
    setProvinces(initialProvinces);
    setStations(initialStations);
    setError("");
  }, [open, baseYear, compareYear, initialProvinces, initialStations]);

  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinces(next);
    if (next.length === 0) {
      setStations([]);
      return;
    }
    const allowed = new Set(next.map((province) => province.locationno));
    setStations((current) => current.filter((station) => allowed.has(station.provinceno)));
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStations(next);
    setProvinces((current) => {
      const merged = [...current];
      const known = new Set(merged.map((province) => province.locationno));
      next.forEach((station) => {
        if (!station.provinceno || known.has(station.provinceno)) return;
        known.add(station.provinceno);
        merged.push({ locationno: station.provinceno, locationname: station.provincename });
      });
      return merged;
    });
  };

  const provincePayload = React.useMemo(
    () => buildDashboardProvinces(provinces, stations),
    [provinces, stations],
  );
  const scopeKey = provincesPayloadKey(provincePayload);

  React.useEffect(() => {
    if (!open || !firstYear || !secondYear) return;
    let cancelled = false;
    const controller = new AbortController();

    const loadStations = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await dashboardAPI.getYearlyFireCodeFeeStation(
          {
            reportyear: [firstYear, secondYear],
            feeparentno: [],
            provinces: provincePayload,
          },
          {
            signal: controller.signal,
            suppressGlobalLoading: true,
            suppressErrorToast: true,
          },
        );
        const result = unwrap<DashboardFireCodeFeeStationModel[]>(response);
        if (cancelled || result.canceled) return;
        if (!result.ok || (result.data !== null && !Array.isArray(result.data))) {
          setRows([]);
          setError(result.error || "Unable to load station performance.");
          return;
        }
        setRows(result.data ?? []);
      } catch {
        if (!cancelled) {
          setRows([]);
          setError("Unable to load station performance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStations();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, firstYear, secondYear, scopeKey, retry]);

  const sortedRows = React.useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (Number(b.years[String(secondYear)]) || 0) -
            (Number(a.years[String(secondYear)]) || 0) ||
          a.provincename.localeCompare(b.provincename) ||
          a.stationname.localeCompare(b.stationname),
      ),
    [rows, secondYear],
  );

  const totals = React.useMemo(
    () =>
      sortedRows.reduce(
        (sum, row) => ({
          first: sum.first + (Number(row.years[String(firstYear)]) || 0),
          second: sum.second + (Number(row.years[String(secondYear)]) || 0),
        }),
        { first: 0, second: 0 },
      ),
    [sortedRows, firstYear, secondYear],
  );

  const resetFilters = () => {
    setYears([baseYear, compareYear]);
    setProvinces(initialProvinces);
    setStations(initialStations);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-lg border-border/60 bg-card p-0 shadow-soft">
        <div className="border-b border-border/60 bg-background/95 px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="pr-6 text-lg font-semibold">
              Fire Code Fees Variance Comparison · Station Performance
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Station collections compared across the selected years.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 overflow-auto px-4 pb-5 pt-4 sm:px-5">
          <div className="mb-4 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-[150px_150px_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
              <FilterField label="First year">
                <Select
                  value={String(firstYear)}
                  onValueChange={(value) => {
                    const next = Number(value);
                    if (next === secondYear) return;
                    setYears([next, secondYear]);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="First comparison year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)} disabled={year === secondYear}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Second year">
                <Select
                  value={String(secondYear)}
                  onValueChange={(value) => {
                    const next = Number(value);
                    if (next === firstYear) return;
                    setYears([firstYear, next]);
                  }}
                >
                  <SelectTrigger className="w-full" aria-label="Second comparison year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)} disabled={year === firstYear}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Provinces">
                {provinceLocked ? (
                  <ReadOnlyField value={provincename} placeholder="All provinces" />
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
                {stationLocked ? (
                  <ReadOnlyField value={stationname} placeholder="All stations" />
                ) : (
                  <StationMultiSelect
                    mode="station"
                    value={stations}
                    provinces={provinces.map((province) => ({ provinceno: province.locationno }))}
                    reportyear={secondYear}
                    onChange={handleStationsChange}
                    placeholder="All stations"
                    alwaysEnabled
                  />
                )}
              </FilterField>
              <ResetFiltersButton onReset={resetFilters} className="justify-self-end" />
            </div>
          </div>

          {loading ? (
            <div role="status" className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading station performance…
            </div>
          ) : error ? (
            <div role="alert" className="space-y-3 rounded-lg border border-border/60 bg-card px-4 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setRetry((value) => value + 1)}>
                Retry
              </Button>
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="rounded-lg border border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No station data available for this view.
            </div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border/60 bg-card md:block">
                <div className="max-h-[55vh] overflow-auto">
                  <table className="w-full min-w-[780px] border-separate border-spacing-0 text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/60 text-foreground/90">
                      <tr>
                        <th className="sticky left-0 z-20 w-[36%] border-b border-r border-border/60 bg-muted/60 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider">Station</th>
                        <th className="border-b border-r border-border/60 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">{firstYear}</th>
                        <th className="border-b border-r border-border/60 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">{secondYear}</th>
                        <th className="border-b border-r border-border/60 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Variance</th>
                        <th className="border-b border-r border-border/60 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">Positive Listing</th>
                        <th className="border-b border-border/60 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wider">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row, index) => {
                        const first = Number(row.years[String(firstYear)]) || 0;
                        const second = Number(row.years[String(secondYear)]) || 0;
                        const variance = Math.max(0, first - second);
                        const positive = Math.max(0, second - first);
                        const percentage = first === 0 ? null : (second / first) * 100;
                        return (
                          <tr key={row.stationno || `${row.stationcode}-${index}`} className="transition-colors hover:bg-muted/20">
                            <td className="sticky left-0 z-10 border-b border-r border-border/60 bg-card px-3 py-2.5">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <AvatarWithFallback src={row.logourl} name={row.stationname} className="h-8 w-8 shrink-0" />
                                <div className="min-w-0">
                                  <div className="break-words font-medium text-foreground">{row.stationname || "—"}</div>
                                  <div className="break-words text-xs text-muted-foreground">{row.stationcode} · {row.provincename}</div>
                                </div>
                              </div>
                            </td>
                            <td className="border-b border-r border-border/60 px-3 py-2.5 text-right tabular-nums">{peso(first)}</td>
                            <td className="border-b border-r border-border/60 px-3 py-2.5 text-right font-semibold tabular-nums text-success">{peso(second)}</td>
                            <td className="border-b border-r border-border/60 px-3 py-2.5 text-right tabular-nums text-muted-foreground">{peso(variance)}</td>
                            <td className="border-b border-r border-border/60 px-3 py-2.5 text-right tabular-nums text-success">{peso(positive)}</td>
                            <td className="border-b border-border/60 px-3 py-2.5 text-right font-semibold tabular-nums">{percentage === null ? "—" : `${percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[var(--total-row)] text-[var(--total-row-foreground)]">
                        <td className="sticky left-0 z-10 border-r border-border/60 bg-[var(--total-row)] px-3 py-3 text-xs font-bold uppercase">Total</td>
                        <td className="border-r border-border/60 px-3 py-3 text-right font-bold tabular-nums">{peso(totals.first)}</td>
                        <td className="border-r border-border/60 px-3 py-3 text-right font-bold tabular-nums">{peso(totals.second)}</td>
                        <td className="border-r border-border/60 px-3 py-3 text-right font-bold tabular-nums">{peso(Math.max(0, totals.first - totals.second))}</td>
                        <td className="border-r border-border/60 px-3 py-3 text-right font-bold tabular-nums">{peso(Math.max(0, totals.second - totals.first))}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">{totals.first === 0 ? "—" : `${((totals.second / totals.first) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="space-y-3 md:hidden">
                {sortedRows.map((row, index) => {
                  const first = Number(row.years[String(firstYear)]) || 0;
                  const second = Number(row.years[String(secondYear)]) || 0;
                  const percentage = first === 0 ? null : (second / first) * 100;
                  return (
                    <article key={row.stationno || `${row.stationcode}-${index}`} className="overflow-hidden rounded-lg border border-border/60 bg-card">
                      <div className="flex items-center gap-2.5 border-b border-border/60 p-3">
                        <AvatarWithFallback src={row.logourl} name={row.stationname} className="h-9 w-9 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold">{row.stationname || "—"}</h3>
                          <p className="break-words text-xs text-muted-foreground">{row.stationcode} · {row.provincename}</p>
                        </div>
                      </div>
                      <dl className="grid grid-cols-2 gap-px bg-border/60 text-xs">
                        <div className="bg-card p-3"><dt className="text-muted-foreground">{firstYear}</dt><dd className="mt-1 font-semibold tabular-nums">{peso(first)}</dd></div>
                        <div className="bg-card p-3 text-right"><dt className="text-muted-foreground">{secondYear}</dt><dd className="mt-1 font-semibold tabular-nums text-success">{peso(second)}</dd></div>
                        <div className="bg-card p-3"><dt className="text-muted-foreground">Variance</dt><dd className="mt-1 tabular-nums">{peso(Math.max(0, first - second))}</dd></div>
                        <div className="bg-card p-3 text-right"><dt className="text-muted-foreground">Positive Listing</dt><dd className="mt-1 tabular-nums text-success">{peso(Math.max(0, second - first))}</dd></div>
                      </dl>
                      <div className="flex items-center justify-between border-t border-border/60 px-3 py-2.5 text-xs">
                        <span className="text-muted-foreground">Performance</span>
                        <span className="font-semibold tabular-nums">{percentage === null ? "—" : `${percentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</span>
                      </div>
                    </article>
                  );
                })}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                  <div className="mb-2 font-bold uppercase text-foreground">Total</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="block text-muted-foreground">{firstYear}</span><strong className="tabular-nums">{peso(totals.first)}</strong></div>
                    <div className="text-right"><span className="block text-muted-foreground">{secondYear}</span><strong className="tabular-nums">{peso(totals.second)}</strong></div>
                    <div><span className="block text-muted-foreground">Variance</span><strong className="tabular-nums">{peso(Math.max(0, totals.first - totals.second))}</strong></div>
                    <div className="text-right"><span className="block text-muted-foreground">Positive Listing</span><strong className="tabular-nums">{peso(Math.max(0, totals.second - totals.first))}</strong></div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}