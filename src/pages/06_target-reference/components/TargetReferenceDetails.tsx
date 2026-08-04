import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Calendar as CalendarIcon,
  ChevronsDown,
  ChevronsUp,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { MONTHS, QUARTERS, HALVES } from "@/lib/fsims-constants";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import StationInfoCard from "@/components/station-info-card";

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
  /** Opens the edit form for the period currently shown in this view. */
  onEdit?: (year: number, month: number) => void;
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
          className={`border-b px-3 py-2 text-center tabular-nums ${
            b[k] === 0 ? "text-muted-foreground/60" : ""
          }`}
        >
          {b[k].toLocaleString()}
        </td>
      ))}
      <td className="border-b px-3 py-2 text-center tabular-nums font-semibold bg-card">
        {total.toLocaleString()}
      </td>
    </tr>
  );
}

export default function TargetReferenceDetails({
  open,
  onOpenChange,
  target,
  period,
  month,
  onEdit,
}: Props) {
  const YEARS = React.useMemo(buildYears, []);
  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<TargetReferenceDetailModel | null>(null);
  const [selectedYear, setSelectedYear] = React.useState<number>(
    target?.reportyear ?? new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = React.useState<number>(
    month || new Date().getMonth() + 1,
  );

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

  const baseYear = target?.reportyear ?? new Date().getFullYear();
  const baseMonth = month || new Date().getMonth() + 1;
  const isPeriodChanged = selectedMonth !== baseMonth || selectedYear !== baseYear;

  const dailyDerived = React.useMemo(
    () =>
      detail
        ? computeDailyFromList(detail.targetreferencelist, selectedYear, selectedMonth)
        : null,
    [detail, selectedYear, selectedMonth],
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

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = React.useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setCanScroll(el.scrollHeight - el.clientHeight > 40);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [detail, period, selectedMonth, selectedYear, loading]);

  const scrollTo = (dir: "top" | "bottom") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: dir === "top" ? 0 : el.scrollHeight, behavior: "smooth" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] min-h-0 max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Target Reference Details</DialogTitle>
              <DialogDescription>
                {detail?.stationname ? `${detail.stationname} · ` : ""}
                {MONTHS[selectedMonth - 1]?.name ?? ""} {selectedYear}
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                View only — values are displayed as recorded and cannot be modified here.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
          <div
            ref={scrollRef}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-5"
          >
        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : detail && derived ? (
          <>

            <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  Reporting Period
                </h2>
                {isPeriodChanged && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedMonth(baseMonth);
                      setSelectedYear(baseYear);
                    }}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to {MONTHS[baseMonth - 1]?.name} {baseYear}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Month</span>
                  <Select
                    value={String(selectedMonth)}
                    onValueChange={(next) => setSelectedMonth(Number(next))}
                  >
                    <SelectTrigger className="h-10 w-full">
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
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Year</span>
                  <Select
                    value={String(selectedYear)}
                    onValueChange={(next) => setSelectedYear(Number(next))}
                  >
                    <SelectTrigger className="h-10 w-full">
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
              </div>
            </Card>

            <StationInfoCard
              className="rounded-xl"
              stationName={detail.stationname}
              unitCode={detail.stationcode}
              logoUrl={detail.logourl || null}
              fields={[
                { label: "Station Code", value: detail.stationcode },
                { label: "Station Name", value: detail.stationname },
                { label: "Province", value: detail.provincename },
              ]}
            />

            <div className="flex h-[360px] min-h-[360px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-soft">
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
                      <th className="px-3 py-2 text-center font-semibold bg-card">BPLO</th>
                      <th className="px-3 py-2 text-center font-semibold bg-card">Government</th>
                      <th className="px-3 py-2 text-center font-semibold bg-card">PEZA</th>
                      <th className="px-3 py-2 text-center font-semibold bg-card">TIEZA</th>
                      <th className="px-3 py-2 text-center font-semibold bg-card">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {period === "DAILY" &&
                      dailyDerived &&
                      dailyDerived.days.map((d) => (
                        <Row
                          key={d}
                          label={formatDayLabel(selectedYear, selectedMonth, d)}
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
                          <td
                            key={k}
                            className="border-t px-3 py-2 text-center bg-card tabular-nums"
                          >
                            {dailyDerived.total[k].toLocaleString()}
                          </td>
                        ))}
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
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
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                          {overallTotals.bplo.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                          {overallTotals.gov.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                          {overallTotals.peza.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                          {overallTotals.tieza.toLocaleString()}
                        </td>
                        <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
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
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            No details available.
          </div>
        )}
          </div>

          {canScroll && (
            <div className="pointer-events-none absolute bottom-3 right-4 flex flex-col gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Scroll to top"
                onClick={() => scrollTo("top")}
                className="pointer-events-auto h-8 w-8 rounded-full border border-border/60 shadow-soft"
              >
                <ChevronsUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Scroll to bottom"
                onClick={() => scrollTo("bottom")}
                className="pointer-events-auto h-8 w-8 rounded-full border border-border/60 shadow-soft"
              >
                <ChevronsDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-background px-5 py-3">
          {onEdit && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onEdit(selectedYear, selectedMonth);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} className="gap-2">
            <X className="h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

