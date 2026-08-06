import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveReportMonths } from "@/lib/filters";
import type { SelectedStation } from "@/components/station-multi-select";
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
export function useMonthlyTargetVsActual({
  selectedYear,
  selectedStations = [],
}: {
  selectedYear?: number;
  selectedStations?: SelectedStation[];
}) {
  const [rows, setRows] = React.useState<MonthlyTargetPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = selectedYear ?? new Date().getFullYear();
  const stationnos = React.useMemo(() => selectedStations.map((s) => s.stationno), [selectedStations]);
  const stationKey = stationnos.join(",");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getMonthlyTargetVSInspection(
        {
          reportyear: [reportyear],
          stationno: stationnos,
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
      const { ok, data, error, canceled } = unwrap<DashboardMonthlyTargetAccomplishModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load monthly trend." : error);
        setRows([]);
      } else {
        const monthRows = MONTH_NAMES.map((name) => ({ name, target: 0, actual: 0 }));
        (data ?? []).forEach((m) => {
          const idx = Math.min(Math.max(Number(m.reportmonth) || 1, 1), 12) - 1;
          const totals = (m.monthlytargetaccomList ?? []).reduce(
            (acc, g) => ({
              target: acc.target + (Number(g.totaltarget) || 0),
              actual: acc.actual + (Number(g.totalaccomplish) || 0),
            }),
            { target: 0, actual: 0 },
          );
          monthRows[idx] = { name: MONTH_NAMES[idx], ...totals };
        });
        setRows(monthRows);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reportyear, stationKey]);

  return { rows, loading };
}

/** Monthly Trend by Sector (actual inspections per sector per month). */
export function useMonthlySectorTrend({
  selectedYear,
  selectedStations = [],
}: {
  selectedYear?: number;
  selectedStations?: SelectedStation[];
}) {
  const [rows, setRows] = React.useState<MonthlySectorPoint[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = selectedYear ?? new Date().getFullYear();
  const stationnos = React.useMemo(() => selectedStations.map((s) => s.stationno), [selectedStations]);
  const stationKey = stationnos.join(",");

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getMonthlySectorInspection(
        {
          reportyear: [reportyear],
          stationno: stationnos,
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
      const { ok, data, error, canceled } = unwrap<DashboardMonthlySectorInspectionModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load monthly trend by sector." : error);
        setRows([]);
      } else {
        const monthRows = MONTH_NAMES.map((name) => ({ name, BPLO: 0, GOVT: 0, PEZA: 0, TIEZA: 0 }));
        (data ?? []).forEach((m) => {
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
          monthRows[idx] = { name: MONTH_NAMES[idx], ...totals };
        });
        setRows(monthRows);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reportyear, stationKey]);

  return { rows, loading };
}
