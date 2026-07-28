import * as React from "react";
import { Loader2, Target } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { cn } from "@/lib/utils";
import type { TargetAccomplishmentModel } from "@/types/targetinventoryType";
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";

type CategoryKey = "bplo" | "gov" | "peza" | "tieza";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "bplo", label: "BPLO" },
  { key: "gov", label: "GOV" },
  { key: "peza", label: "PEZA" },
  { key: "tieza", label: "TIEZA" },
];

function pct(inspected: number, target: number): number {
  return target > 0 ? (inspected / target) * 100 : 0;
}

function pickTarget(m: TargetAccomplishmentModel, k: CategoryKey): number {
  switch (k) {
    case "bplo": return Number(m.totaltargetbplo ?? 0) || 0;
    case "gov": return Number(m.totaltargetgov ?? 0) || 0;
    case "peza": return Number(m.totaltargetpeza ?? 0) || 0;
    case "tieza": return Number(m.totaltargettieza ?? 0) || 0;
  }
}

function pickInspected(m: TargetAccomplishmentModel, k: CategoryKey): number {
  switch (k) {
    case "bplo": return Number(m.totalAccomplishmentbplo ?? 0) || 0;
    case "gov": return Number(m.totalAccomplishmentgov ?? 0) || 0;
    case "peza": return Number(m.totalAccomplishmentpeza ?? 0) || 0;
    case "tieza": return Number(m.totalAccomplishmenttieza ?? 0) || 0;
  }
}

/**
 * Fetches TargetAccomplishment for {station, year, month} and renders a
 * per-category table (Target / Inspected / Variance / % Accomplishment).
 *
 * Dedupes requests: only refetches when the (station, year, month) triple
 * differs from the previous successful request.
 */
export default function TargetAccomplishmentPanel({
  stationno,
  year,
  month,
  data: controlledData,
}: {
  stationno: string | undefined;
  year: number;
  month: number;
  /**
   * When provided, the panel becomes controlled — it skips the internal fetch
   * and renders the caller-supplied target/accomplishment values. Used by
   * MonitoringEdit to keep the summary in sync with in-progress ledger edits.
   */
  data?: TargetAccomplishmentModel | null;
}) {
  const controlled = controlledData !== undefined;
  const [fetched, setFetched] = React.useState<TargetAccomplishmentModel | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const data = controlled ? controlledData : fetched;

  // Always request fresh data whenever station / year / month changes.
  React.useEffect(() => {
    if (controlled) return;
    if (!stationno) {
      setFetched(null);
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const resp = await targetinventoryAPI.getTargetAccomplishment({
        stationno,
        reportyear: year,
        reportmonth: month,
      });
      const { ok, data: payload, error: err } = unwrap<TargetAccomplishmentModel>(resp);
      if (cancelled) return;
      if (!ok || !payload) {
        setFetched(null);
        setError(err || "Unable to load target / accomplishment.");
      } else {
        setFetched(payload);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [controlled, stationno, year, month]);

  const monthName = MONTHS.find((m) => m.value === month)?.name ?? String(month);

  const rows = CATEGORIES.map((c) => {
    const target = data ? pickTarget(data, c.key) : 0;
    const inspected = data ? pickInspected(data, c.key) : 0;
    const variance = target - inspected;
    const percentage = pct(inspected, target);
    return { ...c, target, inspected, variance, percentage };
  });

  const chartData = rows.map((r) => ({
    name: r.label,
    Target: r.target,
    Accomplishment: r.inspected,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.target += r.target;
      acc.inspected += r.inspected;
      return acc;
    },
    { target: 0, inspected: 0 },
  );
  const totalVariance = totals.target - totals.inspected;
  const totalPct = pct(totals.inspected, totals.target);

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Monthly Target vs. Inspected</div>
            <div className="text-[11px] text-muted-foreground">
              {stationno ? `${monthName} ${year}` : "Select a station to load"}
            </div>
          </div>
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </span>
        )}
      </div>

      {error ? (
        <div className="p-4 text-center text-sm text-destructive">{error}</div>
      ) : !stationno ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Select a station to view target vs. accomplishment.
        </div>
      ) : (
        <>
          <div className="border-b border-border/50 bg-card/40 p-4">
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" {...axisProps} allowDecimals={false} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />

                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Target" fill="var(--color-warning, hsl(38 92% 50%))" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="Accomplishment"
                    fill="var(--color-primary, hsl(221 83% 53%))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            <thead>
              <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">Monthly Target</th>
                <th className="px-4 py-2 text-right">Monthly Inspected</th>
                <th className="px-4 py-2 text-right">Variance</th>
                <th className="px-4 py-2 text-right">% Accomplishment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.key}
                  className={cn(
                    "border-t border-border/50",
                    i % 2 === 1 && "bg-muted/20",
                  )}
                >
                  <td className="px-4 py-2 font-semibold text-foreground">
                    {r.label}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {stationno ? r.target.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {stationno ? r.inspected.toLocaleString() : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2 text-right tabular-nums font-medium",
                      stationno && r.variance > 0 && "text-warning",
                      stationno && r.variance < 0 && "text-primary",
                      stationno && r.variance === 0 && "text-success",
                    )}
                  >
                    {stationno ? r.variance.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {stationno ? `${r.percentage.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-primary/5 font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {stationno ? totals.target.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {stationno ? totals.inspected.toLocaleString() : "—"}
                </td>
                <td
                  className={cn(
                    "px-4 py-2 text-right tabular-nums",
                    stationno && totalVariance > 0 && "text-warning",
                    stationno && totalVariance < 0 && "text-primary",
                    stationno && totalVariance === 0 && "text-success",
                  )}
                >
                  {stationno ? totalVariance.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {stationno ? `${totalPct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </>
      )}
    </Card>
  );
}
