import * as React from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { AutoFitText } from "@/components/auto-fit-text";

import { Trophy, BadgeCheck, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatPct,
  useStationPerformance,
  MONTH_NAMES,
  type RankedStation,
} from "@/pages/02_dashboard/useStationPerformance";

function MonthlyBreakdown({ station }: { station: RankedStation }) {
  if (!station.months.length) {
    return (
      <div className="px-4 pb-3 text-[11px] text-muted-foreground">
        No monthly performance records for this period.
      </div>
    );
  }
  return (
    <div className="border-t border-border/60 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Monthly Performance
      </div>
      {/* No inner scrollbar: the font auto-shrinks so the table always fits. */}
      <AutoFitText
        className="w-full max-w-full rounded-md border border-border/40 bg-card/40"
        baseFontSize={10}
        minFontSize={5}
      >
        <table className="w-full table-auto">
          <thead className="bg-card/95 backdrop-blur">
            <tr className="text-muted-foreground">
              <th className="px-1.5 py-1 text-left font-medium">Month</th>
              <th className="px-1.5 py-1 text-right font-medium">BPLO</th>
              <th className="px-1.5 py-1 text-right font-medium">GOV</th>
              <th className="px-1.5 py-1 text-right font-medium">PEZA</th>
              <th className="px-1.5 py-1 text-right font-medium">TIEZA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {station.months.map((m) => (
              <tr key={`${m.year}-${m.month}`} className="tabular-nums">
                <td className="whitespace-nowrap px-1.5 py-1 text-left text-foreground">
                  {MONTH_NAMES[Math.min(Math.max(Number(m.month), 1), 12) - 1]}
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right">
                  {formatPct(Number(m.bploPercentage))}
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right">
                  {formatPct(Number(m.govPercentage))}
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right">
                  {formatPct(Number(m.pezaPercentage))}
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right">
                  {formatPct(Number(m.tiezaPercentage))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AutoFitText>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col overflow-hidden border-border/60 bg-card p-0 shadow-soft">
      <div className="flex items-start gap-3 border-b border-border/60 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Skeleton className="h-6 w-6 rounded-md" />
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-10 text-center text-sm text-muted-foreground">
      <p className="max-w-xs leading-relaxed">{children}</p>
    </div>
  );
}

const RANK_STYLES: Record<number, { badge: string; bar: string; row: string }> = {
  1: {
    badge: "bg-[hsl(43_74%_49%)] text-[hsl(30_45%_15%)] ring-1 ring-[hsl(43_74%_49%)]/40",
    bar: "bg-[hsl(43_74%_49%)]",
    row: "bg-[hsl(43_74%_49%)]/[0.06]",
  },
  2: {
    badge: "bg-muted-foreground/25 text-foreground ring-1 ring-muted-foreground/25",
    bar: "bg-muted-foreground/60",
    row: "bg-muted/40",
  },
  3: {
    badge: "bg-[hsl(25_45%_45%)]/20 text-[hsl(25_45%_35%)] ring-1 ring-[hsl(25_45%_45%)]/30",
    bar: "bg-[hsl(25_45%_45%)]/70",
    row: "bg-[hsl(25_45%_45%)]/[0.05]",
  },
};

function TopStationRow({ station, rank }: { station: RankedStation; rank: number }) {
  const style = RANK_STYLES[rank];
  const pct = Math.min(Math.max(station.averageOverallPercentage, 0), 100);
  const [expanded, setExpanded] = React.useState(false);
  return (
    <li className={cn("border-b border-border/40 last:border-b-0", style?.row)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2 text-left sm:flex-nowrap"
      >
        <span
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10px] font-semibold tabular-nums",
            style?.badge ?? "bg-muted text-muted-foreground",
          )}
        >
          {rank}
        </span>
        <AvatarWithFallback
          src={station.logoSrc}
          name={station.stationname}
          className="h-7 w-7 shrink-0 border border-border/60 text-[9px]"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-medium text-foreground">
            {station.stationname || "—"}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {[station.stationcode, station.provincename].filter(Boolean).join(" • ") || "—"}
          </div>
        </div>
        <div className="order-last w-full shrink-0 sm:order-none sm:w-28">
          <div className="text-right text-[11px] font-semibold tabular-nums text-foreground">
            {formatPct(station.averageOverallPercentage)}
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                style?.bar ?? "bg-primary",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && <MonthlyBreakdown station={station} />}
    </li>
  );
}

function PerfectStationRow({
  station,
  shortPeriodLabel,
  totalMonths,
}: {
  station: RankedStation;
  shortPeriodLabel: string;
  totalMonths: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <li className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-left sm:flex-nowrap"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <AvatarWithFallback
          src={station.logoSrc}
          name={station.stationname}
          className="h-8 w-8 shrink-0 border border-border/60 text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-foreground">
            {station.stationname || "—"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {[station.stationcode, station.provincename].filter(Boolean).join(" • ") || "—"}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {shortPeriodLabel} • {station.perfectMonths}/{totalMonths || station.monthsCounted}{" "}
            months at 100%
          </div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums tone-success-soft">
          100%
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && <MonthlyBreakdown station={station} />}
    </li>
  );
}

/**
 * Top 10 Performing Stations + 100% Performing Stations.
 *
 * Both sections are derived from the station monthly performance endpoint and
 * compare the averaged sector percentages for each month.
 */
export default function StationPerformanceSections({ selectedYear }: { selectedYear?: number }) {
  const { loading, topStations, perfectStations, periodLabel, shortPeriodLabel, totalMonths } =
    useStationPerformance(selectedYear);

  const perfectTitle = (() => {
    if (!periodLabel) return "100% Performing Stations";
    const match = periodLabel.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s*[–-]?\s*(.*?)(?:\s+\d{4})?$/i);
    if (!match) return `100% Performing Stations (${periodLabel})`;

    const start = match[1];
    const end = match[2]?.trim();
    if (!end || end.toLowerCase() === start.toLowerCase()) {
      return `100% Performing Stations (${start})`;
    }
    return `100% Performing Stations (${start} - ${end})`;
  })();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <SectionCard
        icon={<Trophy className="h-4 w-4" />}
        title="Top 10 Performing Stations"
        subtitle={`Overall station performance • ${periodLabel}. Ranked by the average overall performance across all available months.`}
      >
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : topStations.length === 0 ? (
          <EmptyState>
            No station performance data is available for the current reporting period.
          </EmptyState>
        ) : (
          <div className="w-full max-h-[26rem] overflow-y-auto overflow-x-hidden overscroll-contain">
            <ol>
              {topStations.map((s, i) => (
                <TopStationRow key={s.stationno || s.stationcode || i} station={s} rank={s.rank} />
              ))}
            </ol>
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<BadgeCheck className="h-4 w-4" />}
        title={perfectTitle}
        subtitle={`Stations that achieved 100% overall performance in every month of the current reporting period (${periodLabel}).`}
      >
        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 4 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : perfectStations.length === 0 ? (
          <EmptyState>
            No stations have achieved 100% performance for every month of the current reporting
            period.
          </EmptyState>
        ) : (
          <div className="w-full max-h-[26rem] overflow-y-auto overflow-x-hidden overscroll-contain">
            <ul>
              {perfectStations.map((s, i) => (
                <PerfectStationRow
                  key={s.stationno || s.stationcode || i}
                  station={s}
                  shortPeriodLabel={shortPeriodLabel}
                  totalMonths={totalMonths}
                />
              ))}
            </ul>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
