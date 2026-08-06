import * as React from "react";
import { toast } from "@/lib/toast";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters, resolveDateRange } from "@/lib/filters";
import type { DashboardIssuanceGapModel } from "@/types/dashboardType";

export interface IssuanceGapRow {
  name: string;
  provinceno: string;
  BPLO: number;
  GOVT: number;
  PEZA: number;
  TIEZA: number;
  gap: number;
}

/**
 * Fetches the Target Gap (Issuance Gap) summary per province, honoring the
 * current year + interval/period filter (expanded into a list of months).
 */
export function useIssuanceGap() {
  const { filters } = useFilters();
  const [rows, setRows] = React.useState<IssuanceGapRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = Number(filters.year) || new Date().getFullYear();
  const range = React.useMemo(
    () => resolveDateRange(reportyear, filters.interval, filters.period),
    [reportyear, filters.interval, filters.period],
  );
  const rangeKey = `${range.interval}|${range.startdate}|${range.enddate}`;

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getGapSummary(
        {
          reportyear,
          interval: range.interval,
          startdate: range.startdate,
          enddate: range.enddate,
          provinces: [],
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
      const { ok, data, error, canceled } = unwrap<DashboardIssuanceGapModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load target gap by province." : error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((p) => {
            const totals = (p.gapList ?? []).reduce(
              (acc, g) => ({
                BPLO: acc.BPLO + (Number(g.totalbplo) || 0),
                GOVT: acc.GOVT + (Number(g.totalgov) || 0),
                PEZA: acc.PEZA + (Number(g.totalpeza) || 0),
                TIEZA: acc.TIEZA + (Number(g.totaltieza) || 0),
              }),
              { BPLO: 0, GOVT: 0, PEZA: 0, TIEZA: 0 },
            );
            return {
              name: p.provincename,
              provinceno: p.provinceno,
              ...totals,
              gap: totals.BPLO + totals.GOVT + totals.PEZA + totals.TIEZA,
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
  }, [reportyear, rangeKey]);

  return { gapRows: rows, loading };
}
