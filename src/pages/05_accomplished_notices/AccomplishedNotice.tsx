import * as React from "react";
import { BellRing, ListChecks } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
import AvatarWithFallback from "@/components/avatar-with-fallback";

import {
  accomplishedNoticesData,
  computeCategoryRows,
  computeTotals,
  NOTICE_CATEGORIES,
  REPORT_YEARS,
  type AccomplishedNoticeRecord,
  type NoticeCategory,
} from "@/data/05_accomplished_notices";

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

function completionTone(pct: number): {
  bar: string;
  badge: string;
  label: string;
} {
  if (pct >= 100)
    return {
      bar: "[&>div]:bg-emerald-500",
      badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
      label: "Complete",
    };
  if (pct >= 75)
    return {
      bar: "[&>div]:bg-blue-500",
      badge: "bg-blue-500/15 text-blue-600 border-blue-500/30",
      label: "On Track",
    };
  if (pct >= 50)
    return {
      bar: "[&>div]:bg-orange-500",
      badge: "bg-orange-500/15 text-orange-600 border-orange-500/30",
      label: "Behind",
    };
  return {
    bar: "[&>div]:bg-red-500",
    badge: "bg-red-500/15 text-red-600 border-red-500/30",
    label: "Critical",
  };
}

function StationCard({ record }: { record: AccomplishedNoticeRecord }) {
  const totals = computeTotals(record.breakdown);
  const rows = computeCategoryRows(record.breakdown);
  const tone = completionTone(totals.completionPct);

  return (
    <Card className="flex flex-col overflow-hidden shadow-elegant transition-shadow hover:shadow-lg">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border/60 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-4">
        <AvatarWithFallback
          entity={{ stationcode: record.stationCode }}
          src={record.logoUrl || undefined}
          name={record.stationName}
          className="h-12 w-12 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              {record.stationCode}
            </span>
            <Badge variant="outline" className={cn("text-[10px]", tone.badge)}>
              {tone.label}
            </Badge>
          </div>
          <div className="mt-1 truncate text-sm font-semibold leading-tight">
            {record.stationName}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {record.municipality} · {record.province}
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Totals summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-center">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {totals.pending}
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">
              Pending
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {totals.accomplished}
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">
              Accomplished
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/50 p-2.5 text-center">
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {totals.completionPct.toFixed(0)}%
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">
              Completion
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Progress
            value={Math.min(100, totals.completionPct)}
            className={cn(
              "h-2 [&>div]:transition-all [&>div]:duration-700",
              tone.bar,
            )}
          />
        </div>

        {/* Notice breakdown comparison */}
        <div className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Notice Breakdown
        </div>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                <th className="px-2 py-1.5 text-right font-semibold">Pending</th>
                <th className="px-2 py-1.5 text-right font-semibold">Accom.</th>
                <th className="px-2 py-1.5 text-right font-semibold">Rem.</th>
                <th className="px-2 py-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.category}
                  className="border-t border-border/60 odd:bg-card/40"
                >
                  <td className="px-2 py-1.5 font-medium">
                    {CATEGORY_LABEL[r.category]}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {r.pending}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      {r.accomplished}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Badge
                      variant="outline"
                      className="border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    >
                      {r.remaining}
                    </Badge>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <Badge
                      variant="outline"
                      className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    >
                      {r.completionPct.toFixed(0)}%
                    </Badge>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/40 font-semibold">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {totals.pending}
                </td>
                <td className="px-2 py-1.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {totals.accomplished}
                </td>
                <td className="px-2 py-1.5 text-right text-orange-600 dark:text-orange-400 tabular-nums">
                  {totals.remaining}
                </td>
                <td className="px-2 py-1.5 text-right text-blue-600 dark:text-blue-400 tabular-nums">
                  {totals.completionPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

export default function AccomplishedNotice() {
  const [reportYear, setReportYear] = React.useState<string>("all");
  const [province, setProvince] = React.useState<string>("all");
  const [station, setStation] = React.useState<string>("all");

  const provinces = React.useMemo(
    () =>
      Array.from(new Set(accomplishedNoticesData.map((r) => r.province))).sort(),
    [],
  );
  const stations = React.useMemo(() => {
    const scoped = accomplishedNoticesData.filter(
      (r) => province === "all" || r.province === province,
    );
    const map = new Map<string, string>();
    scoped.forEach((r) => map.set(r.stationCode, r.stationName));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [province]);

  const filtered = React.useMemo(() => {
    let list = accomplishedNoticesData.filter((r) => {
      if (reportYear !== "all" && String(r.reportYear) !== reportYear)
        return false;
      if (province !== "all" && r.province !== province) return false;
      if (station !== "all" && r.stationCode !== station) return false;
      return true;
    });

    // Deduplicate by station when "all years" is selected — aggregate totals.
    if (reportYear === "all") {
      const byStation = new Map<string, AccomplishedNoticeRecord>();
      list.forEach((r) => {
        const existing = byStation.get(r.stationCode);
        if (!existing) {
          byStation.set(r.stationCode, {
            ...r,
            breakdown: { ...r.breakdown },
          });
          return;
        }
        NOTICE_CATEGORIES.forEach((c) => {
          existing.breakdown[c] = {
            pending: existing.breakdown[c].pending + r.breakdown[c].pending,
            accomplished:
              existing.breakdown[c].accomplished +
              r.breakdown[c].accomplished,
          };
        });
      });
      list = Array.from(byStation.values());
    }

    list.sort((a, b) => a.stationName.localeCompare(b.stationName));
    return list;
  }, [reportYear, province, station]);

  const resetFilters = () => {
    setReportYear("all");
    setProvince("all");
    setStation("all");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          Accomplished Notice
        </h1>
        <p className="text-xs text-muted-foreground">
          Station-level summary of accomplished notices across all categories.
        </p>
      </div>

      {/* Filters */}
      <Card className="grid gap-3 border-border/60 p-4 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
        <FilterField label="Report Year">
          <Select value={reportYear} onValueChange={setReportYear}>
            <SelectTrigger>
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {REPORT_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Province">
          <Select
            value={province}
            onValueChange={(v) => {
              setProvince(v);
              setStation("all");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Provinces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Provinces</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Station">
          <Select value={station} onValueChange={setStation}>
            <SelectTrigger>
              <SelectValue placeholder="All Stations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stations</SelectItem>
              {stations.map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <div className="flex items-end justify-end md:col-span-2 lg:col-span-1">
          <ResetFiltersButton onReset={resetFilters} />
        </div>
      </Card>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center shadow-elegant">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ListChecks className="h-6 w-6" />
          </div>
          <div className="text-sm font-medium">
            No Accomplished Notice records found.
          </div>
          <div className="text-xs text-muted-foreground">
            Try adjusting your filters.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <StationCard key={`${r.stationCode}-${r.reportYear}`} record={r} />
          ))}
        </div>
      )}
    </div>
  );
}
