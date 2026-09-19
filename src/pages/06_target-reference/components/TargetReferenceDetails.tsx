import { DayLockIcon, dayKey } from "@/components/day-lock-icon";
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
  ChevronDown,
  ChevronUp,
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
import { buildYears, displayNumber } from "@/lib/utils";
import type { TargetReferenceDetailModel } from "@/types/targetreferenceType";
import { useAuth } from "@/lib/auth";
import { canShowEditAction } from "@/lib/permissions";
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
  total = displayNumber(b?.bplo) +
    displayNumber(b?.gov) +
    displayNumber(b?.peza) +
    displayNumber(b?.tieza),
  emphasize = false,
  lockDate,
}: {
  label: string;
  b: TargetBucket;
  total?: number;
  emphasize?: boolean;
  /** When set, shows the lock / unlock indicator beside the date label. */
  lockDate?: string;
}) {
  return (
    <tr className={emphasize ? "bg-primary/10 font-semibold" : ""}>
      <td className="border-b px-3 py-2">
        {lockDate ? (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <DayLockIcon date={lockDate} module="target-reference" className="h-3 w-3" />
            {label}
          </span>
        ) : (
          label
        )}
      </td>
      {(["bplo", "gov", "peza", "tieza"] as const).map((k) => (
        <td
          key={k}
          className={`border-b px-3 py-2 text-center tabular-nums ${
            displayNumber(b?.[k]) === 0 ? "text-muted-foreground/60" : ""
          }`}
        >
          {displayNumber(b?.[k]).toLocaleString()}
        </td>
      ))}
      <td className="border-b px-3 py-2 text-center tabular-nums font-semibold bg-card">
        {displayNumber(total).toLocaleString()}
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
  const { user, systemAccess } = useAuth();
  const canEdit = canShowEditAction(user, systemAccess);
  const YEARS = React.useMemo(buildYears, []);
  const [loading, setLoading] = React.useState(false);
  const [detail, setDetail] = React.useState<TargetReferenceDetailModel | null>(null);
  const [selectedYear, setSelectedYear] = React.useState<number>(
    target?.reportyear ?? new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = React.useState<number>(
    month || new Date().getMonth() + 1,
  );
  const [mobileExpandedRows, setMobileExpandedRows] = React.useState<Record<string, boolean>>({});

  const dailyDerived = React.useMemo(
    () =>
      detail ? computeDailyFromList(detail.targetreferencelist, selectedYear, selectedMonth) : null,
    [detail, selectedYear, selectedMonth],
  );

  const derived = React.useMemo(
    () => (detail ? computeDerivedFromList(detail.targetreferencelist) : null),
    [detail],
  );

  const mobileRows = React.useMemo(() => {
    if (period === "DAILY" && dailyDerived) {
      return dailyDerived.days.map((d) => {
        const bucket = dailyDerived.daily[d];
        const total =
          displayNumber(bucket?.bplo) +
          displayNumber(bucket?.gov) +
          displayNumber(bucket?.peza) +
          displayNumber(bucket?.tieza);
        return {
          key: String(d),
          label: formatDayLabel(selectedYear, selectedMonth, d),
          total,
          values: [
            ["BPLO", bucket?.bplo],
            ["Government", bucket?.gov],
            ["PEZA", bucket?.peza],
            ["TIEZA", bucket?.tieza],
          ] as const,
          lockDate: dayKey(selectedYear, selectedMonth, d),
        };
      });
    }

    if (period === "MONTHLY") {
      return MONTHS.map((m) => {
        const bucket = derived?.monthly[m.value];
        const total =
          displayNumber(bucket?.bplo) +
          displayNumber(bucket?.gov) +
          displayNumber(bucket?.peza) +
          displayNumber(bucket?.tieza);
        return {
          key: `month-${m.value}`,
          label: m.name,
          total,
          values: [
            ["BPLO", bucket?.bplo],
            ["Government", bucket?.gov],
            ["PEZA", bucket?.peza],
            ["TIEZA", bucket?.tieza],
          ] as const,
        };
      });
    }

    if (period === "QUARTERLY") {
      return QUARTERS.map((q, i) => {
        const bucket = derived?.quarters[i];
        const total =
          displayNumber(bucket?.bplo) +
          displayNumber(bucket?.gov) +
          displayNumber(bucket?.peza) +
          displayNumber(bucket?.tieza);
        return {
          key: `quarter-${q}`,
          label: q,
          total,
          values: [
            ["BPLO", bucket?.bplo],
            ["Government", bucket?.gov],
            ["PEZA", bucket?.peza],
            ["TIEZA", bucket?.tieza],
          ] as const,
        };
      });
    }

    if (period === "SEMI-ANNUAL") {
      return HALVES.map((h, i) => {
        const bucket = derived?.halves[i];
        const total =
          displayNumber(bucket?.bplo) +
          displayNumber(bucket?.gov) +
          displayNumber(bucket?.peza) +
          displayNumber(bucket?.tieza);
        return {
          key: `half-${h}`,
          label: h,
          total,
          values: [
            ["BPLO", bucket?.bplo],
            ["Government", bucket?.gov],
            ["PEZA", bucket?.peza],
            ["TIEZA", bucket?.tieza],
          ] as const,
        };
      });
    }

    const annualTotal =
      displayNumber(derived?.annual?.bplo) +
      displayNumber(derived?.annual?.gov) +
      displayNumber(derived?.annual?.peza) +
      displayNumber(derived?.annual?.tieza);
    return [
      {
        key: "annual-total",
        label: "Annual Total",
        total: annualTotal,
        values: [
          ["BPLO", derived?.annual?.bplo],
          ["Government", derived?.annual?.gov],
          ["PEZA", derived?.annual?.peza],
          ["TIEZA", derived?.annual?.tieza],
        ] as const,
      },
    ];
  }, [dailyDerived, derived, period, selectedMonth, selectedYear]);

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
        { suppressGlobalLoading: true, noDedupe: true },
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-5">
            {loading && !detail ? (
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

                <div className="flex min-h-0 flex-col rounded-xl border border-border/60 bg-card shadow-soft">
                  <div className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                      {period === "DAILY" && "Daily Targets"}
                      {period === "MONTHLY" && "Monthly Targets"}
                      {period === "QUARTERLY" && "Quarterly Targets"}
                      {period === "SEMI-ANNUAL" && "Semi-Annual Targets"}
                      {period === "ANNUAL" && "Annual Targets"}
                    </div>
                    <div className="hidden md:block">
                      <span className="inline-flex min-w-[88px] items-center justify-end rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-bold tabular-nums text-primary">
                        {(() => {
                          if (period === "DAILY" && dailyDerived) {
                            return (dailyDerived.total.bplo + dailyDerived.total.gov + dailyDerived.total.peza + dailyDerived.total.tieza).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "MONTHLY" && overallTotals) {
                            return (overallTotals.bplo + overallTotals.gov + overallTotals.peza + overallTotals.tieza).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "QUARTERLY" && derived) {
                            return (derived.quarters.reduce((sum, q) => sum + (q?.bplo ?? 0) + (q?.gov ?? 0) + (q?.peza ?? 0) + (q?.tieza ?? 0), 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "SEMI-ANNUAL" && derived) {
                            return (derived.halves.reduce((sum, h) => sum + (h?.bplo ?? 0) + (h?.gov ?? 0) + (h?.peza ?? 0) + (h?.tieza ?? 0), 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "ANNUAL" && derived) {
                            return ((derived.annual?.bplo ?? 0) + (derived.annual?.gov ?? 0) + (derived.annual?.peza ?? 0) + (derived.annual?.tieza ?? 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          return "0.00";
                        })()}
                      </span>
                    </div>
                  </div>

                  <div className="hidden min-h-0 flex-1 overflow-auto md:block">
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
                          <th className="px-3 py-2 text-center font-semibold bg-card">
                            Government
                          </th>
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
                              lockDate={dayKey(selectedYear, selectedMonth, d)}
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
                                {displayNumber(dailyDerived.total[k]).toLocaleString()}
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
                              {displayNumber(overallTotals.bplo).toLocaleString()}
                            </td>
                            <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                              {displayNumber(overallTotals.gov).toLocaleString()}
                            </td>
                            <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                              {displayNumber(overallTotals.peza).toLocaleString()}
                            </td>
                            <td className="border-t px-3 py-2 text-center bg-card tabular-nums">
                              {displayNumber(overallTotals.tieza).toLocaleString()}
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

                  <div className="block md:hidden">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/60 bg-card px-3 py-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
                        {MONTHS[selectedMonth - 1]?.name ?? ""} {selectedYear}
                      </div>
                      <span className="inline-flex min-w-[88px] items-center justify-end rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-bold tabular-nums text-primary">
                        {(() => {
                          if (period === "DAILY" && dailyDerived) {
                            return (dailyDerived.total.bplo + dailyDerived.total.gov + dailyDerived.total.peza + dailyDerived.total.tieza).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "MONTHLY" && overallTotals) {
                            return (overallTotals.bplo + overallTotals.gov + overallTotals.peza + overallTotals.tieza).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "QUARTERLY" && derived) {
                            return (derived.quarters.reduce((sum, q) => sum + (q?.bplo ?? 0) + (q?.gov ?? 0) + (q?.peza ?? 0) + (q?.tieza ?? 0), 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "SEMI-ANNUAL" && derived) {
                            return (derived.halves.reduce((sum, h) => sum + (h?.bplo ?? 0) + (h?.gov ?? 0) + (h?.peza ?? 0) + (h?.tieza ?? 0), 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          if (period === "ANNUAL" && derived) {
                            return ((derived.annual?.bplo ?? 0) + (derived.annual?.gov ?? 0) + (derived.annual?.peza ?? 0) + (derived.annual?.tieza ?? 0)).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          return "0.00";
                        })()}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {mobileRows.map((row) => {
                        const expanded = Boolean(mobileExpandedRows[row.key]);
                        const hasRecord = row.total > 0;

                        return (
                          <div key={row.key} className="border-b border-border/60 bg-card">
                            <button
                              type="button"
                              onClick={() =>
                                setMobileExpandedRows((prev) => ({
                                  ...prev,
                                  [row.key]: !prev[row.key],
                                }))
                              }
                              className="flex w-full items-center gap-3 px-3 py-3 text-left"
                            >
                              <div className="shrink-0">
                                {row.lockDate ? (
                                  <DayLockIcon
                                    date={row.lockDate}
                                    module="target-reference"
                                    className="h-4 w-4"
                                  />
                                ) : null}
                              </div>

                              <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                                {row.label}
                              </span>

                              <div className="flex shrink-0 items-center gap-2">
                                {!hasRecord && (
                                  <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                    NO RECORD
                                  </span>
                                )}

                                <span className="text-base font-bold tabular-nums text-primary">
                                  {displayNumber(row.total).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>

                                {expanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </button>

                            {expanded && (
                              <div className="border-t border-border/50 bg-muted/10 p-3">
                                <div className="grid grid-cols-2 gap-2">
                                  {row.values.map(([label, value]) => (
                                    <div
                                      key={`${row.key}-${label}`}
                                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-2.5 py-2"
                                    >
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                        {label}
                                      </span>
                                      <span className="text-right text-sm font-semibold tabular-nums text-foreground">
                                        {displayNumber(value).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No details available.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 border-t border-border/60 bg-background px-5 py-3">
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {onEdit && canEdit && (
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
