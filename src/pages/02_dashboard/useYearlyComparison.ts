import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import type { SelectedStation } from "@/components/station-multi-select";
import type { DashboardYearlyInspectionModel, DashboardYearToYearDTO } from "@/types/dashboardType";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export type YearlyPoint = { name: string } & Record<string, number | string>;

/** Year-over-Year Comparison (monthly actuals per report year). */
export function useYearlyComparison({
  selectedYears,
  selectedStations,
}: {
  selectedYears: number[];
  selectedStations: SelectedStation[];
}) {
  const [rows, setRows] = React.useState<YearlyPoint[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);

  const selectedYearKey = React.useMemo(
    () => [...selectedYears].sort((a, b) => a - b).join(","),
    [selectedYears],
  );
  const selectedStationKey = React.useMemo(
    () => selectedStations.map((s) => s.stationno).sort().join(","),
    [selectedStations],
  );

  const stationnos = React.useMemo(
    () => selectedStations.map((s) => s.stationno),
    [selectedStations],
  );

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const yearsToQuery = selectedYears.length
        ? [...selectedYears].sort((a, b) => a - b)
        : [];
      const body: DashboardYearToYearDTO = {
        reportyear: yearsToQuery,
        stationno: stationnos,
      };

      const resp = await dashboardAPI.getYearlyInspection(body, {
        suppressGlobalLoading: true,
        suppressErrorToast: true,
        signal: controller.signal,
        timeout: 90000,
        retries: 3,
        retryDelayMs: 800,
      });

      const { ok, data, error, canceled } = unwrap<DashboardYearlyInspectionModel[]>(resp);
      if (cancelled || canceled) return;

      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load year-over-year comparison." : error);
        setRows([]);
        setYears([]);
      } else {
        const list = data ?? [];
        const yearKeys = list
          .map((y) => Number(y.reportyear) || 0)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const byMonth: YearlyPoint[] = MONTH_NAMES.map((name) => ({ name }));
        for (const y of list) {
          const yr = String(Number(y.reportyear) || "");
          for (const m of y.yearlyinspectionList ?? []) {
            const idx = Math.min(Math.max(Number(m.reportmonth) || 1, 1), 12) - 1;
            byMonth[idx][yr] = Number(m.totalaccomplish) || 0;
          }
        }
        for (const p of byMonth) {
          for (const yr of yearKeys) if (p[String(yr)] == null) p[String(yr)] = 0;
        }

        setYears(yearKeys);
        setRows(byMonth);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedYearKey, selectedStationKey, stationnos]);

  return { rows, years, loading };
}
