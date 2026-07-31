import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, X } from "lucide-react";
import { MONTHS, QUARTERS, HALVES } from "@/lib/fsims-constants";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { unwrap } from "@/lib/api-envelope";
import { buildYears } from "@/lib/utils";
import type { TargetReferenceDetailModel } from "@/types/targetreferenceType";
import {
  computeDerivedFromList,
  computeDailyFromList,
  formatDayLabel,
  type TargetPeriod,
  type TargetBucket,
} from "../helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Station + year to fetch details for; null when the dialog is closed. */
  target: { stationno: string; reportyear: number } | null;
  period: TargetPeriod;
  /** Report month (1..12) driving the Daily breakdown. */
  month: number;
}

function Row({
  label,
  b,
  total = b.bplo + b.gov + b.peza + b.tieza,
  emphasize = false,
}: {
  label: string;
  b: TargetBucket;
  total?: number;
  emphasize?: boolean;
}) {
  return (
    <tr className={emphasize ? "bg-primary/10 font-semibold" : ""}>
      <td className="border-b px-3 py-2">{label}</td>
      {(["bplo", "gov", "peza", "tieza"] as const).map((k) => (
        <td
          key={k}
          className={`border-b px-3 py-2 text-right tabular-nums ${
            b[k] === 0 ? "text-muted-foreground/60" : ""
          }`}
        >
          {b[k].toLocaleString()}
        </td>
      ))}
      <td className="border-b px-3 py-2 text-right tabular-nums font-semibold bg-card">
        {total.toLocaleString()}
      </td>
    </tr>
  );
}

export default function TargetReferenceDetails({ open, onOpenChange, target, period, month }: Props) {
  const YEARS = React.useMemo(buildYears, []);
  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<TargetReferenceDetailModel | null>(null);
  const [selectedYear, setSelectedYear] = React.useState<number>(target?.reportyear ?? new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = React.useState<number>(month || new Date().getMonth() + 1);

  React.useEffect(() => {
    if (!target) return;
    setSelectedYear(target.reportyear);
    setSelectedMonth(month || new Date().getMonth() + 1);
  }, [target, month]);

  React.useEffect(() => {
    if (!open || !target) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await targetreferenceAPI.getDetail(
        {
          stationno: target.stationno,
          reportyear: selectedYear,
          reportmonth: selectedMonth,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<TargetReferenceDetailModel>(resp);
      if (cancelled) return;
      setDetail(ok && data ? data : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, target, selectedYear, selectedMonth]);

  const dailyDerived = React.useMemo(
    () =>
      detail
        ? computeDailyFromList(detail.targetreferencelist, target?.reportyear ?? 0, month)
        : null,
    [detail, target?.reportyear, month],
  );

  const derived = React.useMemo(
    () => (detail ? computeDerivedFromList(detail.targetreferencelist) : null),
    [detail],
  );

  const overallTotals = derived
    ? {
        bplo: Object.values(derived.monthly).reduce((sum, bucket) => sum + bucket.bplo, 0),
        gov: Object.values(derived.monthly).reduce((sum, bucket) => sum + bucket.gov, 0),
        peza: Object.values(derived.monthly).reduce((sum, bucket) => sum + bucket.peza, 0),
        tieza: Object.values(derived.monthly).reduce((sum, bucket) => sum + bucket.tieza, 0),
      }
    : null;

  const completeAddress = detail ? detail.provincename : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-3xl h-[90vh] overflow-hidden min-h-0"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-4 w-4 text-primary" /> Target Reference Details
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : detail && derived ? (
          <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <div className="flex flex-col gap-4 sm:flex-row">
                <AvatarWithFallback
                  entity={{ name: detail.stationname }}
                  src={detail.logourl || undefined}
                  name={detail.stationname}
                  className="h-20 w-20 rounded-full ring-2 ring-primary/20"
                />
                <div className="grid flex-1 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Station Code
                    </div>
                    <div className="text-sm font-semibold">{detail.stationcode}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Station Name
                    </div>
                    <div className="text-sm font-semibold">{detail.stationname}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Province
                    </div>
                    <div className="text-sm">{detail.provincename}</div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Year
                    </div>
                    <Select
                      value={String(selectedYear)}
                      onValueChange={(next) => setSelectedYear(Number(next))}
                    >
                      <SelectTrigger className="h-10 min-w-[120px] rounded-md border bg-background px-3 text-left text-sm">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map((yearOption) => (
                          <SelectItem key={yearOption} value={String(yearOption)}>
                            {yearOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                      Month
                    </div>
                    <Select
                      value={String(selectedMonth)}
                      onValueChange={(next) => setSelectedMonth(Number(next))}
                    >
                      <SelectTrigger className="h-10 min-w-[120px] rounded-md border bg-background px-3 text-left text-sm">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={String(m.value)}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
              <div className="border-b bg-card px-4 py-2 text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                {period === "DAILY" && "Daily Targets"}
                {period === "MONTHLY" && "Monthly Targets"}
                {period === "QUARTERLY" && "Quarterly Targets"}
                {period === "SEMI-ANNUAL" && "Semi-Annual Targets"}
                {period === "ANNUAL" && "Annual Targets"}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="bg-card text-left text-xs uppercase tracking-[0.15em] text-primary">
                      <th className="px-3 py-2 font-semibold bg-card">
                        {period === "DAILY"
                          ? "Date"
                          : period === "MONTHLY"
                          ? "Month"
                          : period === "QUARTERLY"
                          ? "Quarter"
                          : period === "SEMI-ANNUAL"
                          ? "Period"
                          : "Annual Total"}
                      </th>
                      <th className="px-3 py-2 text-right font-semibold bg-card">BPLO</th>
                      <th className="px-3 py-2 text-right font-semibold bg-card">Government</th>
                      <th className="px-3 py-2 text-right font-semibold bg-card">PEZA</th>
                      <th className="px-3 py-2 text-right font-semibold bg-card">TIEZA</th>
                      <th className="px-3 py-2 text-right font-semibold bg-card">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period === "DAILY" &&
                      dailyDerived &&
                      dailyDerived.days.map((d) => (
                        <Row
                          key={d}
                          label={formatDayLabel(target?.reportyear ?? 0, month, d)}
                          b={dailyDerived.daily[d]}
                        />
                      ))}
                    {period === "MONTHLY" &&
                      MONTHS.map((m) => (
                        <Row key={m.value} label={m.name} b={derived.monthly[m.value]} />
                      ))}
                    {period === "QUARTERLY" &&
                      QUARTERS.map((q, i) => <Row key={q} label={q} b={derived.quarters[i]} />)}
                    {period === "SEMI-ANNUAL" &&
                      HALVES.map((h, i) => <Row key={h} label={h} b={derived.halves[i]} />)}
                    {period === "ANNUAL" && (
                      <Row label="Annual Total" b={derived.annual} emphasize />
                    )}
                  </tbody>
                  {period === "DAILY" && dailyDerived ? (
                    <tfoot className="sticky bottom-0 bg-card">
                      <tr className="bg-card text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        <td className="border-t px-3 py-2 bg-card">TOTAL</td>
                        {(["bplo", "gov", "peza", "tieza"] as const).map((k) => (
                          <td key={k} className="border-t px-3 py-2 text-right bg-card tabular-nums">
                            {dailyDerived.total[k].toLocaleString()}
                          </td>
                        ))}
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {(
                            dailyDerived.total.bplo +
                            dailyDerived.total.gov +
                            dailyDerived.total.peza +
                            dailyDerived.total.tieza
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                  {period === "MONTHLY" && overallTotals ? (
                    <tfoot className="sticky bottom-0 bg-card">
                      <tr className="bg-card text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        <td className="border-t px-3 py-2 bg-card">TOTAL</td>
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {overallTotals.bplo.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {overallTotals.gov.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {overallTotals.peza.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {overallTotals.tieza.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-right bg-card tabular-nums">
                          {(
                            overallTotals.bplo +
                            overallTotals.gov +
                            overallTotals.peza +
                            overallTotals.tieza
                          ).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No details available.
          </div>
        )}

        <DialogFooter className="mt-auto">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
