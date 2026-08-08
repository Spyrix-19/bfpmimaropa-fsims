import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import type { SelectedStation } from "@/components/station-multi-select";
import type { DashboardTargetAccomplishModel } from "@/types/dashboardType";
import {
  buildDashboardProvinces,
  provincesPayloadKey,
  type ProvinceSelection,
} from "@/pages/02_dashboard/buildProvincesPayload";

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
  selectedProvinces?: ProvinceSelection[];
}) {
  const [rows, setRows] = React.useState<TargetVsActualRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = selectedYear ?? new Date().getFullYear();
  const provincesPayload = React.useMemo(
    () => buildDashboardProvinces(selectedProvinces, selectedStations),
    [selectedProvinces, selectedStations],
  );
  const payloadKey = provincesPayloadKey(provincesPayload);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getTargetVSInspection(
        {
          reportyear: [reportyear],
          Provinces: provincesPayload,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportyear, payloadKey]);

  return { rows, loading };
}
