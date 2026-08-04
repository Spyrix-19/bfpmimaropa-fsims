import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveReportMonths } from "@/lib/filters";
import type {
  DashboardMonthlyTargetAccomplishModel,
  DashboardMonthlySectorInspectionModel,
} from "@/types/dashboardType";

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

export interface MonthlyTargetPoint {
  name: string;
  target: number;
  actual: number;
}

export interface MonthlySectorPoint {
  name: string;
  BPLO: number;
  GOVT: number;
  PEZA: number;
  TIEZA: number;
}

/** Monthly Accomplishment Trend (Target vs Actual per month). */
export function useMonthlyTargetVsActual() {
  const { filters } = useFilters();
  const [rows, setRows] = React.useState<MonthlyTargetPoint[]>([]);
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
      const resp = await dashboardAPI.getMonthlyTargetVSInspection(
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
      const { ok, data, error, canceled } = unwrap<DashboardMonthlyTargetAccomplishModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load monthly trend." : error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((m) => {
            const totals = (m.monthlytargetaccomList ?? []).reduce(
              (acc, g) => ({
                target: acc.target + (Number(g.totaltarget) || 0),
                actual: acc.actual + (Number(g.totalaccomplish) || 0),
              }),
              { target: 0, actual: 0 },
            );
            const idx = Math.min(Math.max(Number(m.reportmonth) || 1, 1), 12) - 1;
            return { name: MONTH_NAMES[idx], ...totals };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, reportmonthKey]);

  return { rows, loading };
}

/** Monthly Trend by Sector (actual inspections per sector per month). */
export function useMonthlySectorTrend() {
  const { filters } = useFilters();
  const [rows, setRows] = React.useState<MonthlySectorPoint[]>([]);
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
      const resp = await dashboardAPI.getMonthlySectorInspection(
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
      const { ok, data, error, canceled } = unwrap<DashboardMonthlySectorInspectionModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load monthly trend by sector." : error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((m) => {
            const totals = (m.monthlysectorinspectionList ?? []).reduce(
              (acc, g) => ({
                BPLO: acc.BPLO + (Number(g.totalbplo) || 0),
                GOVT: acc.GOVT + (Number(g.totalgov) || 0),
                PEZA: acc.PEZA + (Number(g.totalpeza) || 0),
                TIEZA: acc.TIEZA + (Number(g.totaltieza) || 0),
              }),
              { BPLO: 0, GOVT: 0, PEZA: 0, TIEZA: 0 },
            );
            const idx = Math.min(Math.max(Number(m.reportmonth) || 1, 1), 12) - 1;
            return { name: MONTH_NAMES[idx], ...totals };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, reportmonthKey]);

  return { rows, loading };
}
