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
import { targetinventoryAPI } from "@/services/complianceAPI";
import { unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { cn } from "@/lib/utils";
import type { TargetAccomplishmentModel } from "@/types/complianceType";
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

/**
 * Uniform series colors — used for the chart bars, the legend swatches and
 * the table header dots / value colors so every surface reads the same.
 */
const SERIES = {
  target: "var(--color-warning)",
  inspected: "var(--color-primary)",
  variance: "var(--color-destructive)",
  positive: "var(--color-success)",
} as const;

function Dot({ color }: { color: string }) {
  return (
    <span
      className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle"
      style={{ background: color }}
    />
  );
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
  variant = "monthly",
  periodLabel,
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
  /**
   * "monthly" (default) — Edit screens: values come from the monthly
   * TargetAccomplishment API (fetched here or supplied by the caller).
   * "daily" — New screen: values come from the per-date payload returned by
   * `getDetailBydate`, so the panel is always controlled and never fetches.
   */
  variant?: "monthly" | "daily";
  /** Overrides the header period caption (e.g. the selected inspection date). */
  periodLabel?: string;
}) {
  const daily = variant === "daily";
  const controlled = daily || controlledData !== undefined;
  const [fetched, setFetched] = React.useState<TargetAccomplishmentModel | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const data = controlled ? controlledData ?? null : fetched;


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
    // Variance never goes negative — any excess moves to Positive Listing.
    const variance = Math.max(target - inspected, 0);
    const positive = Math.max(inspected - target, 0);
    const percentage = pct(inspected, target);
    return { ...c, target, inspected, variance, positive, percentage };
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
      acc.variance += r.variance;
      acc.positive += r.positive;
      return acc;
    },
    { target: 0, inspected: 0, variance: 0, positive: 0 },
  );
  const totalVariance = totals.variance;
  const totalPositive = totals.positive;
  const totalPct = pct(totals.inspected, totals.target);

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">
              {daily ? "Daily Target vs. Inspected" : "Monthly Target vs. Inspected"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {stationno
                ? periodLabel ?? (daily ? "Selected inspection date" : `${monthName} ${year}`)
                : "Select a station to load"}
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
                  <Bar dataKey="Target" fill={SERIES.target} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Accomplishment" fill={SERIES.inspected} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">

            <thead>
              <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right"><Dot color={SERIES.target} />{daily ? "Daily Target" : "Monthly Target"}</th>
                <th className="px-4 py-2 text-right"><Dot color={SERIES.inspected} />{daily ? "Daily Inspected" : "Monthly Inspected"}</th>

                <th className="px-4 py-2 text-right"><Dot color={SERIES.variance} />Variance</th>
                <th className="px-4 py-2 text-right"><Dot color={SERIES.positive} />Positive Listing</th>
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
                  <td className="px-4 py-2 text-right tabular-nums" style={stationno ? { color: SERIES.target } : undefined}>
                    {stationno ? r.target.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" style={stationno ? { color: SERIES.inspected } : undefined}>
                    {stationno ? r.inspected.toLocaleString() : "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums font-medium"
                    style={stationno && r.variance > 0 ? { color: SERIES.variance } : undefined}
                  >
                    {stationno ? r.variance.toLocaleString() : "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums font-medium"
                    style={stationno && r.positive > 0 ? { color: SERIES.positive } : undefined}
                  >
                    {stationno ? r.positive.toLocaleString() : "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-right tabular-nums font-medium"
                    style={
                      stationno
                        ? { color: r.percentage >= 100 ? SERIES.positive : SERIES.inspected }
                        : undefined
                    }
                  >
                    {stationno ? `${r.percentage.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-primary/5 font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right tabular-nums" style={stationno ? { color: SERIES.target } : undefined}>
                  {stationno ? totals.target.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums" style={stationno ? { color: SERIES.inspected } : undefined}>
                  {stationno ? totals.inspected.toLocaleString() : "—"}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={stationno && totalVariance > 0 ? { color: SERIES.variance } : undefined}
                >
                  {stationno ? totalVariance.toLocaleString() : "—"}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={stationno && totalPositive > 0 ? { color: SERIES.positive } : undefined}
                >
                  {stationno ? totalPositive.toLocaleString() : "—"}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={
                    stationno
                      ? { color: totalPct >= 100 ? SERIES.positive : SERIES.inspected }
                      : undefined
                  }
                >
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
