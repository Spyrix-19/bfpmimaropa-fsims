import * as React from "react";
import { toast } from "sonner";
import { dashboardAPI } from "@/services/dashboardAPI";
import { unwrap } from "@/lib/api-envelope";
import { isGenericError } from "@/lib/api-messages";
import { useFilters } from "@/lib/filters";
import { ALL_MONTHS } from "@/pages/02_dashboard/useComplianceSummary";
import type { DashboardInspectionAccomplishModel } from "@/types/dashboardType";

export interface InspectionSummaryRow {
  name: string;
  provinceno: string;
  BPLO: number;
  GOVT: number;
  PEZA: number;
  TIEZA: number;
  total: number;
}

/**
 * Fetches the Inspection Summary per province.
 * Month is always sent as ALL_MONTHS (13) for now — the month filter is a
 * future implementation; only the year filter is applied.
 */
export function useInspectionSummary() {
  const { filters } = useFilters();
  const [rows, setRows] = React.useState<InspectionSummaryRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reportyear = Number(filters.year) || new Date().getFullYear();

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await dashboardAPI.getInspectionSummary(
        { reportyear, reportmonth: ALL_MONTHS },
        {
          suppressGlobalLoading: true,
          suppressErrorToast: true,
          signal: controller.signal,
          timeout: 90000,
          retries: 3,
          retryDelayMs: 800,
        },
      );
      const { ok, data, error, canceled } = unwrap<DashboardInspectionAccomplishModel[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(isGenericError(error) ? "Unable to load inspections by sector." : error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map((p) => {
            const list = p.gapList ?? p.inspectionList ?? [];
            const totals = list.reduce(
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
              total: totals.BPLO + totals.GOVT + totals.PEZA + totals.TIEZA,
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
  }, [reportyear]);

  return { rows, loading };
}
