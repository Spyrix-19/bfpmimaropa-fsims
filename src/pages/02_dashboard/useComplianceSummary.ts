import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveReportMonths } from "@/lib/filters";
import type {
  DashboardClass,
  DashboardComplianceModel,
  DashboardNoticeModel,
} from "@/types/dashboardType";

/** Backend sentinel meaning "all months" (kept for legacy consumers). */
export const ALL_MONTHS = 13;

/**
 * Fetches the Dashboard Compliance Summary using the currently selected
 * dashboard filters. Returns `null` while loading or when the request fails
 * (no mock/fallback data is ever substituted).
 */
export function useComplianceSummary() {
  const { filters } = useFilters();
  const [data, setData] = React.useState<DashboardComplianceModel | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reportyear = Number(filters.year) || new Date().getFullYear();
  const reportmonth = React.useMemo(
    () => resolveReportMonths(filters.interval, filters.period),
    [filters.interval, filters.period],
  );
  const reportmonthKey = reportmonth.join(",");

  // Stable primitive key so the effect only refires on real filter changes.
  const provincesKey = React.useMemo(() => {
    const provinces: DashboardClass[] = filters.provinces.map((p) => ({
      provinceno: p.locationno,
      stationnos: filters.stations
        .filter((s) => s.provinceno === p.locationno)
        .map((s) => s.stationno),
    }));
    return JSON.stringify(provinces);
  }, [filters.provinces, filters.stations]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getComplianceSummary(
        {
          reportyear,
          reportmonth,
          provinces: JSON.parse(provincesKey) as DashboardClass[],
        },
        {
          suppressGlobalLoading: true,
          suppressErrorToast: true,
          signal: controller.signal,
          timeout: 90000,
          retries: 3,
          retryDelayMs: 800,
        },
      );
      const { ok, data: payload, error, canceled } = unwrap<DashboardComplianceModel>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load compliance summary." : error);
        setData(null);
      } else {
        setData(payload ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, reportmonthKey, provincesKey]);

  return { compliance: data, loading };
}

/** Case-insensitive notice lookup with a zeroed fallback. */
export function getNotice(
  compliance: DashboardComplianceModel | null,
  name: string,
): { pending: number; accomplished: number } {
  const found: DashboardNoticeModel | undefined = (compliance?.noticeList ?? []).find(
    (x) => (x.noticename ?? "").trim().toUpperCase() === name.trim().toUpperCase(),
  );
  return {
    pending: found?.totalpending ?? 0,
    accomplished: found?.totalaccomplished ?? 0,
  };
}

/** Sums a numeric field across a list of monthly rows. */
export function sumBy<T>(list: T[] | undefined, pick: (row: T) => number | undefined): number {
  return (list ?? []).reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}
