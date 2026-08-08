import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import type { SelectedStation } from "@/components/station-multi-select";
import type { DashboardTargetAccomplishModel } from "@/types/dashboardType";

export interface TargetVsActualRow {
  name: string;
  provinceno: string;
  target: number;
  actual: number;
}

/** Fetches Target vs Actual per province. */
export function useTargetVsActual({
  selectedYear,
  selectedStations = [],
  selectedProvinces = [],
}: {
  selectedYear?: number;
  selectedStations?: SelectedStation[];
  selectedProvinces?: { locationno: string }[];
}) {
  const [rows, setRows] = React.useState<TargetVsActualRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = selectedYear ?? new Date().getFullYear();
  const stationnos = React.useMemo(() => selectedStations.map((s) => s.stationno), [selectedStations]);
  const stationKey = stationnos.join(",");
  const provinceKey = React.useMemo(
    () => selectedProvinces.map((p) => p.locationno).join(","),
    [selectedProvinces],
  );


  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getTargetVSInspection(
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
      const { ok, data, error, canceled } = unwrap<DashboardTargetAccomplishModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load target vs actual." : error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((p) => {
            const totals = (p.targetaccomList ?? []).reduce(
              (acc, g) => ({
                target: acc.target + (Number(g.totaltarget) || 0),
                actual: acc.actual + (Number(g.totalaccomplish) || 0),
              }),
              { target: 0, actual: 0 },
            );
            return {
              name: p.provincename,
              provinceno: p.provinceno,
              ...totals,
            };
          }),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reportyear, stationKey]);

  const filteredRows = React.useMemo(() => {
    if (!provinceKey) return rows;
    const allowed = new Set(provinceKey.split(","));
    return rows.filter((r) => allowed.has(r.provinceno));
  }, [rows, provinceKey]);

  return { rows: filteredRows, loading };

}
