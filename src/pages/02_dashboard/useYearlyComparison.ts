import * as React from "react";
import { toast } from "sonner";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveReportMonths } from "@/lib/filters";
import type { DashboardYearlyInspectionModel } from "@/types/dashboardType";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type YearlyPoint = { name: string } & Record<string, number | string>;

/** Year-over-Year Comparison (monthly actuals per report year). */
export function useYearlyComparison() {
  const { filters } = useFilters();
  const [rows, setRows] = React.useState<YearlyPoint[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = Number(filters.year) || new Date().getFullYear();
  const reportmonth = React.useMemo(
    () => resolveReportMonths(filters.interval, filters.period),
    [filters.interval, filters.period],
  );
  const reportmonthKey = reportmonth.join(",");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getYearlyInspection(
        { reportyear, reportmonth, provinces: [] },
        {
          suppressGlobalLoading: true,
          suppressErrorToast: true,
          signal: controller.signal,
          timeout: 90000,
          retries: 3,
          retryDelayMs: 800,
        },
      );
      const { ok, data, error, canceled } =
        unwrap<DashboardYearlyInspectionModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(
          isGenericError(error) ? "Unable to load year-over-year comparison." : error,
        );
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
        // ensure every year key exists on every point
        for (const p of byMonth) {
          for (const yr of yearKeys) if (p[String(yr)] == null) p[String(yr)] = 0;
        }

        setYears(yearKeys);
        setRows(reportmonth.length ? byMonth.filter((_, i) => reportmonth.includes(i + 1)) : byMonth);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, reportmonthKey]);

  return { rows, years, loading };
}
