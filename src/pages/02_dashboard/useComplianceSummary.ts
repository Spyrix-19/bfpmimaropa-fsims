import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveDateRange } from "@/lib/filters";
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
  const range = React.useMemo(
    () => resolveDateRange(reportyear, filters.interval, filters.period),
    [reportyear, filters.interval, filters.period],
  );
  const rangeKey = `${range.interval}|${range.startdate}|${range.enddate}`;

  // Stable primitive key so the effect only refires on real filter changes.
  // If the user selected stations but left provinces empty, derive the
  // provinces payload from the selected stations so the API receives a
  // non-empty `provinces` array containing both provinceno and stationnos.
  const provincesKey = React.useMemo(() => {
    let provinces: DashboardClass[] = [];

    if ((filters.provinces ?? []).length > 0) {
      provinces = filters.provinces.map((p) => ({
        provinceno: p.locationno,
        stationnos: filters.stations
          .filter((s) => s.provinceno === p.locationno)
          .map((s) => s.stationno),
      }));
    } else if ((filters.stations ?? []).length > 0) {
      const map = new Map<string, string[]>();
      filters.stations.forEach((s) => {
        if (!s.provinceno || !s.stationno) return;
        const list = map.get(s.provinceno) ?? [];
        if (!list.includes(s.stationno)) list.push(s.stationno);
        map.set(s.provinceno, list);
      });
      provinces = Array.from(map.entries()).map(([provinceno, stationnos]) => ({
        provinceno,
        stationnos,
      }));
    }

    return JSON.stringify(provinces);
  }, [filters.provinces, filters.stations]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    // Debounce rapid filter updates so only the latest fetch runs.
    const timer = setTimeout(() => {
      (async () => {
        setLoading(true);
        const resp = await dashboardAPI.getComplianceSummary(
          {
            reportyear,
            interval: range.interval,
            startdate: range.startdate,
            enddate: range.enddate,
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
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, rangeKey, provincesKey]);

  return { compliance: data, loading };
}

/** Normalizes notice names so the API can send variants like "NON OPERATIONAL",
 * "NON-OPERATIONAL", or "NONOPERATIONAL" without breaking the lookup.
 */
export function normalizeNoticeName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Case-insensitive notice lookup with a zeroed fallback. */
export function getNotice(
  compliance: DashboardComplianceModel | null,
  name: string,
): { pending: number; accomplished: number } {
  const target = normalizeNoticeName(name);
  const found: DashboardNoticeModel | undefined = (compliance?.noticeList ?? []).find(
    (x) => normalizeNoticeName(x.noticename) === target,
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
