import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Eye, Loader2, Target } from "lucide-react";
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
import { toast } from "@/lib/toast";

import { stationAPI } from "@/services/stationAPI";
import { complianceAPI } from "@/services/complianceAPI";
import { toMonthlyLedgerModel } from "@/lib/complianceAdapters";
import { MONITORING_THEME } from "./complianceTheme";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { CATEGORY_FIELDS } from "@/lib/complianceHelpers";
import { cn } from "@/lib/utils";
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import type { ComplianceDailyCounts } from "@/types/complianceType";
import type {
  FSISComplianceMonthlyLedgerModel,
  FSISComplianceDailyClass,
  FSISIssuanceClassModel,
  FSISComplianceDetailModel,
} from "@/types/complianceType";
import type { SearchStationModel } from "@/types/stationTypes";

const CATEGORY_ORDER = ["INSPECTION", "FSEC", "FSIC", "NOTICES"] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: CATEGORY_FIELDS[category],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

// Unified palette — every group/sub-group shares the same color family
// (see monitoringTheme.ts). Grouping is preserved by labels, not by hue.
const GROUP_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSoft,
  FSEC: MONITORING_THEME.headerSoft,
  FSIC: MONITORING_THEME.headerSoft,
  NOTICES: MONITORING_THEME.headerSoft,
};

const SUB_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSofter,
  FSEC: MONITORING_THEME.headerSofter,
  FSIC: MONITORING_THEME.headerSofter,
  NOTICES: MONITORING_THEME.headerSofter,
};

const FIELD_CATEGORY = new Map<string, (typeof CATEGORY_ORDER)[number]>(
  FIELD_GROUPS.flatMap((g) =>
    g.fields.map((f) => [String(f.key), g.category] as const),
  ),
);

/** Flat inspection record extracted from a Monthly ledger row. */
interface InspectionCounts {
  remarks: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  dailytargetbplo: number;
  dailytargetgov: number;
  dailytargetpeza: number;
  dailytargettieza: number;
}

interface IssuanceCounts {
  fsecbuildingcount: number;
  fsecgovcount: number;
  fsecpezacount: number;
  fsectiezacount: number;
  fsicoccupancycount: number;
  fsicbplonewcount: number;
  fsicbplorenewcount: number;
  fsicgovcount: number;
  fsicpezacount: number;
  fsictiezacount: number;
  nodcount: number;
  ntccount: number;
  ntcvcount: number;
  abatementcount: number;
  closurecount: number;
}

/** Map ComplianceDailyCounts keys to the flat API count keys. */
const FIELD_TO_API: Record<string, string> = {
  insp_during: "inspectduringcount",
  insp_after: "inspectaftercount",
  insp_bplo: "inspectbplocount",
  insp_gov: "inspectgovcount",
  insp_peza: "inspectpezacount",
  insp_tieza: "inspecttiezacount",
  fsec_building: "fsecbuildingcount",
  fsec_gov: "fsecgovcount",
  fsec_peza: "fsecpezacount",
  fsec_tieza: "fsectiezacount",
  fsic_occupancy: "fsicoccupancycount",
  fsic_bplo_new: "fsicbplonewcount",
  fsic_bplo_renewal: "fsicbplorenewcount",
  fsic_gov: "fsicgovcount",
  fsic_peza: "fsicpezacount",
  fsic_tieza: "fsictiezacount",
  not_nod: "nodcount",
  not_ntc: "ntccount",
  not_ntcv: "ntcvcount",
  not_abatement: "abatementcount",
  not_closure: "closurecount",
};

/** Inspection columns that render a Target | Compliance pair. */
const INSP_TARGET_FIELDS: Record<string, keyof InspectionCounts> = {
  insp_bplo: "dailytargetbplo",
  insp_gov: "dailytargetgov",
  insp_peza: "dailytargetpeza",
  insp_tieza: "dailytargettieza",
};

const INSPECTION_COLSPAN = CATEGORY_FIELDS.INSPECTION.reduce(
  (n, f) => n + (INSP_TARGET_FIELDS[String(f.key)] ? 2 : 1),
  0,
);

type DayTotals = Partial<Record<keyof ComplianceDailyCounts, number>>;

interface DaySlice {
  day: number;
  label: string;
  key: string;
  inspection: InspectionCounts;
  manual: IssuanceCounts;
  fsis: IssuanceCounts;
  totals: DayTotals;
  remarks: string;
}

function toLocalKey(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function normalizeDateKey(v: string | Date | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return toLocalKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toLocalKey(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  return null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const emptyIssuance = (): IssuanceCounts => ({
  fsecbuildingcount: 0,
  fsecgovcount: 0,
  fsecpezacount: 0,
  fsectiezacount: 0,
  fsicoccupancycount: 0,
  fsicbplonewcount: 0,
  fsicbplorenewcount: 0,
  fsicgovcount: 0,
  fsicpezacount: 0,
  fsictiezacount: 0,
  nodcount: 0,
  ntccount: 0,
  ntcvcount: 0,
  abatementcount: 0,
  closurecount: 0,
});

function buildSlices(
  list:
    | Array<FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>>
    | null
    | undefined,
  year: number,
  month: number,
): DaySlice[] {
  const byDate = new Map<
    string,
    FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>
  >();
  if (Array.isArray(list)) {
    for (const item of list) {
      const key = normalizeDateKey(item?.dateinspected);
      if (key) byDate.set(key, item);
    }
  }

  const total = daysInMonth(year, month);
  const monthName = MONTHS[month - 1]?.name ?? "";
  const out: DaySlice[] = [];

  for (let d = 1; d <= total; d++) {
    const key = toLocalKey(year, month, d);
    const label = `${monthName} ${d}, ${year}`;
    const rec = byDate.get(key);

    const inspection: InspectionCounts = {
      remarks: (rec?.remarks ?? "").toString(),
      inspectduringcount: num(rec?.inspectduringcount),
      inspectaftercount: num(rec?.inspectaftercount),
      inspectbplocount: num(rec?.inspectbplocount),
      inspectgovcount: num(rec?.inspectgovcount),
      inspectpezacount: num(rec?.inspectpezacount),
      inspecttiezacount: num(rec?.inspecttiezacount),
      dailytargetbplo: num(rec?.dailytargetbplo),
      dailytargetgov: num(rec?.dailytargetgov),
      dailytargetpeza: num(rec?.dailytargetpeza),
      dailytargettieza: num(rec?.dailytargettieza),
    };

    let manual = emptyIssuance();
    let fsis = emptyIssuance();

    if (rec && Array.isArray(rec.issuancelist)) {
      for (const iss of rec.issuancelist) {
        const mode = num(iss?.fsicmode);
        const parsed: IssuanceCounts = {
          fsecbuildingcount: num(iss?.fsecbuildingcount),
          fsecgovcount: num(iss?.fsecgovcount),
          fsecpezacount: num(iss?.fsecpezacount),
          fsectiezacount: num(iss?.fsectiezacount),
          fsicoccupancycount: num(iss?.fsicoccupancycount),
          fsicbplonewcount: num(iss?.fsicbplonewcount),
          fsicbplorenewcount: num(iss?.fsicbplorenewcount),
          fsicgovcount: num(iss?.fsicgovcount),
          fsicpezacount: num(iss?.fsicpezacount),
          fsictiezacount: num(iss?.fsictiezacount),
          nodcount: num(iss?.nodcount),
          ntccount: num(iss?.ntccount),
          ntcvcount: num(iss?.ntcvcount),
          abatementcount: num(iss?.abatementcount),
          closurecount: num(iss?.closurecount),
        };
        if (mode === 96) manual = parsed;
        else if (mode === 97) fsis = parsed;
      }
    }

    const totals: DayTotals = {};
    for (const field of DETAIL_FIELDS) {
      const apiKey = FIELD_TO_API[String(field.key)];
      if (!apiKey) continue;
      if (String(field.key).startsWith("insp_")) {
        totals[field.key as keyof ComplianceDailyCounts] = num(
          (inspection as any)[apiKey],
        );
      } else {
        totals[field.key as keyof ComplianceDailyCounts] =
          num((manual as any)[apiKey]) + num((fsis as any)[apiKey]);
      }
    }

    out.push({
      day: d,
      label,
      key,
      inspection,
      manual,
      fsis,
      totals,
      remarks: inspection.remarks,
    });
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Inline Target vs. Compliance panel (no external panel component)    */
/* ------------------------------------------------------------------ */

const ACC_CATEGORIES: {
  label: string;
  targetKey: keyof InspectionCounts;
  countKey: keyof InspectionCounts;
}[] = [
  { label: "BPLO", targetKey: "dailytargetbplo", countKey: "inspectbplocount" },
  { label: "GOV", targetKey: "dailytargetgov", countKey: "inspectgovcount" },
  { label: "PEZA", targetKey: "dailytargetpeza", countKey: "inspectpezacount" },
  { label: "TIEZA", targetKey: "dailytargettieza", countKey: "inspecttiezacount" },
];

interface AccomplishmentRow {
  label: string;
  target: number;
  compliance: number;
  variance: number;
  positive: number;
  percentage: number;
}

const SERIES = {
  target: "var(--color-warning)",
  compliance: "var(--color-primary)",
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

function InlineAccomplishmentPanel({
  rows,
  periodLabel,
}: {
  rows: AccomplishmentRow[];
  periodLabel: string;
}) {
  const chartData = rows.map((r) => ({
    name: r.label,
    Target: r.target,
    Compliance: r.compliance,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.target += r.target;
      acc.compliance += r.compliance;
      acc.variance += r.variance;
      acc.positive += r.positive;
      return acc;
    },
    { target: 0, compliance: 0, variance: 0, positive: 0 },
  );
  const totalPct = totals.target > 0 ? (totals.compliance / totals.target) * 100 : 0;

  return (
    <Card className="overflow-hidden border-border/60 bg-card shadow-soft">
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Monthly Target vs. Compliance</div>
            <div className="text-[11px] text-muted-foreground">{periodLabel}</div>
          </div>
        </div>
      </div>

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
              <Bar dataKey="Compliance" fill={SERIES.compliance} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-right">
                <Dot color={SERIES.target} />Target
              </th>
              <th className="px-4 py-2 text-right">
                <Dot color={SERIES.compliance} />Compliance
              </th>
              <th className="px-4 py-2 text-right">
                <Dot color={SERIES.variance} />Variance
              </th>
              <th className="px-4 py-2 text-right">
                <Dot color={SERIES.positive} />Positive Listing
              </th>
              <th className="px-4 py-2 text-right">% Accomplishment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.label}
                className={cn("border-t border-border/50", i % 2 === 1 && "bg-muted/20")}
              >
                <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: SERIES.target }}>
                  {r.target.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right tabular-nums"
                  style={{ color: SERIES.compliance }}
                >
                  {r.compliance.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right font-medium tabular-nums"
                  style={r.variance > 0 ? { color: SERIES.variance } : undefined}
                >
                  {r.variance.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right font-medium tabular-nums"
                  style={r.positive > 0 ? { color: SERIES.positive } : undefined}
                >
                  {r.positive.toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-right font-medium tabular-nums"
                  style={{
                    color: r.percentage >= 100 ? SERIES.positive : SERIES.compliance,
                  }}
                >
                  {r.percentage.toFixed(2)}%
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-primary/5 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums" style={{ color: SERIES.target }}>
                {totals.target.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                style={{ color: SERIES.compliance }}
              >
                {totals.compliance.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                style={totals.variance > 0 ? { color: SERIES.variance } : undefined}
              >
                {totals.variance.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                style={totals.positive > 0 ? { color: SERIES.positive } : undefined}
              >
                {totals.positive.toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-right tabular-nums"
                style={{ color: totalPct >= 100 ? SERIES.positive : SERIES.compliance }}
              >
                {totalPct.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Read-only monthly overview mirroring the Edit table:
 *  - Two rows per day (MANUAL / FSIS) for FSEC, FSIC, and Other Notices.
 *  - Inspection, Total, and Remarks columns are merged across the two rows
 *    (rowSpan=2) so the day's values represent the combined MANUAL + FSIS
 *    output.
 */
function ComplianceViewBody({
  stationno,
  year,
  initialMonth,
}: {
  stationno: string;
  year: number;
  initialMonth?: number;
}) {
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    if (initialMonth && initialMonth >= 1 && initialMonth <= 12) return initialMonth;
    return new Date().getMonth() + 1;
  });
  const [loading, setLoading] = React.useState(true);
  const [station, setStation] = React.useState<FSISComplianceMonthlyLedgerModel | null>(
    null,
  );
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const sResp = await stationAPI.search({
        pageNumber: 1,
        pageSize: 1,
        searchKey: stationno,
      });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      if (cancelled) return;
      const seed = Array.isArray(sData) ? sData[0] : undefined;
      setProvinceno(seed?.provinceno ?? EMPTY_GUID);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno]);

  React.useEffect(() => {
    if (provinceno == null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await complianceAPI.getDetail(
        {
          stationno: stationno || EMPTY_GUID,
          reportyear: year,
          reportmonth: selectedMonth,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;

      const { ok, data, error } = unwrap<
        FSISComplianceDetailModel | FSISComplianceDetailModel[]
      >(resp);
      if (!ok) toast.error(error || "Failed to load daily details.");
      const first = ok
        ? Array.isArray(data)
          ? (data[0] ?? null)
          : (data ?? null)
        : null;
      setStation(first ? toMonthlyLedgerModel(first, year, selectedMonth) : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, year, selectedMonth]);

  const slices = React.useMemo<DaySlice[]>(
    () => buildSlices(station?.fsisInventoryLedgerList, year, selectedMonth),
    [station, year, selectedMonth],
  );

  /**
   * Target vs. Compliance per category — derived directly from the daily
   * `dailytarget*` and `inspect*count` values of the loaded month.
   */
  const accomplishmentRows = React.useMemo<AccomplishmentRow[]>(
    () =>
      ACC_CATEGORIES.map((c) => {
        const target = slices.reduce(
          (sum, s) => sum + num(s.inspection[c.targetKey]),
          0,
        );
        const compliance = slices.reduce(
          (sum, s) => sum + num(s.inspection[c.countKey]),
          0,
        );
        return {
          label: c.label,
          target,
          compliance,
          variance: Math.max(target - compliance, 0),
          positive: Math.max(compliance - target, 0),
          percentage: target > 0 ? (compliance / target) * 100 : 0,
        };
      }),
    [slices],
  );

  const columnTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const field of DETAIL_FIELDS) {
      totals[String(field.key)] = slices.reduce(
        (sum, s) => sum + num(s.totals[field.key as keyof ComplianceDailyCounts]),
        0,
      );
    }
    return totals;
  }, [slices]);

  const grandTotal = React.useMemo(
    () => Object.values(columnTotals).reduce((a, b) => a + b, 0),
    [columnTotals],
  );

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-4 shadow-soft">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Month
            </label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
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
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Year
            </label>
            <ReadOnlyField value={year} title="Year is locked to the selected ledger record" />
          </div>
        </div>

        <InlineAccomplishmentPanel
          rows={accomplishmentRows}
          periodLabel={`${MONTHS[selectedMonth - 1]?.name ?? ""} ${year}`}
        />
      </Card>

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="max-h-[65vh] w-full max-w-full overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-[11px] text-foreground">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={3}
                  className={`sticky left-0 top-0 z-40 min-w-[120px] border-b border-r px-3 py-2 text-center align-middle text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerPrimary}`}
                >
                  Date
                </th>
                <th
                  colSpan={INSPECTION_COLSPAN}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.INSPECTION}`}
                >
                  Inspection
                </th>
                <th
                  rowSpan={3}
                  className={`border-b border-r px-2 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[90px] ${MONITORING_THEME.headerSoft}`}
                >
                  Mode of<br />Issuance
                </th>
                <th
                  colSpan={4}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.FSEC}`}
                >
                  FSEC
                </th>
                <th
                  colSpan={6}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.FSIC}`}
                >
                  FSIC
                </th>
                <th
                  colSpan={5}
                  className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${GROUP_TONE.NOTICES}`}
                >
                  Other Notices
                </th>
                <th
                  rowSpan={3}
                  className={`border-b border-r px-3 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[70px] ${MONITORING_THEME.headerPrimary}`}
                >
                  Total
                </th>
                <th
                  rowSpan={3}
                  className={`border-b px-3 py-1.5 text-left align-middle text-[11px] font-bold uppercase tracking-wider min-w-[160px] ${MONITORING_THEME.headerSoft}`}
                >
                  Remarks
                </th>
              </tr>
              <tr>
                {DETAIL_FIELDS.map((field) => {
                  const key = String(field.key);
                  const cat = FIELD_CATEGORY.get(key) ?? "INSPECTION";
                  const split = Boolean(INSP_TARGET_FIELDS[key]);
                  return (
                    <th
                      key={key}
                      rowSpan={split ? 1 : 2}
                      colSpan={split ? 2 : 1}
                      className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[60px] ${SUB_TONE[cat]}`}
                    >
                      {field.label}
                    </th>
                  );
                })}
              </tr>
              <tr>
                {DETAIL_FIELDS.filter((f) => INSP_TARGET_FIELDS[String(f.key)]).flatMap(
                  (field) => {
                    const key = String(field.key);
                    return [
                      <th
                        key={`${key}__target`}
                        className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[56px] ${SUB_TONE.INSPECTION}`}
                      >
                        Target
                      </th>,
                      <th
                        key={`${key}__compliance`}
                        className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[70px] ${SUB_TONE.INSPECTION}`}
                      >
                        Compliance
                      </th>,
                    ];
                  },
                )}
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, dayIndex) => {
                const rowBg = dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd;
                const rowTotal = DETAIL_FIELDS.reduce(
                  (sum, f) => sum + num(slice.totals[f.key as keyof ComplianceDailyCounts]),
                  0,
                );
                return (
                  <React.Fragment key={slice.key}>
                    {/* MANUAL row */}
                    <tr className={rowBg}>
                      <td
                        rowSpan={2}
                        className={`sticky left-0 z-20 border-b border-r border-grid px-3 py-1.5 align-middle text-[11px] font-semibold ${rowBg}`}
                      >
                        <span className={rowTotal > 0 ? "text-primary-700 dark:text-primary-300" : ""}>
                          {slice.label}
                        </span>
                      </td>

                      {/* Inspection — merged across MANUAL/FSIS rows */}
                      {DETAIL_FIELDS.flatMap((field) => {
                        const key = String(field.key);
                        if (!key.startsWith("insp_")) return [];
                        const apiKey = FIELD_TO_API[key];
                        const v = num((slice.inspection as any)[apiKey]);
                        const targetKey = INSP_TARGET_FIELDS[key];
                        const cells = [] as React.ReactNode[];
                        if (targetKey) {
                          const t = num(slice.inspection[targetKey]);
                          cells.push(
                            <td
                              key={`${key}__target`}
                              rowSpan={2}
                              className="border-b border-r border-grid px-2 py-1.5 text-right align-middle tabular-nums text-muted-foreground"
                            >
                              {t.toLocaleString()}
                            </td>,
                          );
                        }
                        cells.push(
                          <td
                            key={key}
                            rowSpan={2}
                            className="border-b border-r border-grid px-2 py-1.5 text-right align-middle tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>,
                        );
                        return cells;
                      })}

                      <td className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}>
                        MANUAL
                      </td>

                      {/* FSEC (manual) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("fsec_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.manual as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}

                      {/* FSIC (manual) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("fsic_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.manual as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}

                      {/* NOTICES (manual) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("not_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.manual as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}

                      {/* Total — merged across MANUAL/FSIS rows */}
                      <td
                        rowSpan={2}
                        className="border-b border-r border-grid px-3 py-1.5 text-center align-middle font-semibold tabular-nums"
                      >
                        {rowTotal.toLocaleString()}
                      </td>
                      <td
                        rowSpan={2}
                        className="max-w-[280px] truncate border-b border-grid px-3 py-1.5 text-left align-middle text-muted-foreground text-[10px]"
                        title={slice.remarks || ""}
                      >
                        {slice.remarks || "—"}
                      </td>
                    </tr>

                    {/* FSIS row */}
                    <tr className={rowBg}>
                      {/* Inspection cells merged with MANUAL row above */}
                      <td className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}>
                        FSIS
                      </td>

                      {/* FSEC (fsis) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("fsec_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.fsis as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}

                      {/* FSIC (fsis) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("fsic_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.fsis as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}

                      {/* NOTICES (fsis) */}
                      {DETAIL_FIELDS.map((field) => {
                        if (!String(field.key).startsWith("not_")) return null;
                        const apiKey = FIELD_TO_API[String(field.key)];
                        const v = num((slice.fsis as any)[apiKey]);
                        return (
                          <td
                            key={String(field.key)}
                            className="border-b border-r border-grid px-2 py-1.5 text-right tabular-nums"
                          >
                            {v.toLocaleString()}
                          </td>
                        );
                      })}
                      {/* Total & Remarks merged with MANUAL row above */}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 z-20">
              <tr className="total-row font-bold text-foreground">
                <td className="sticky left-0 z-30 border-r border-t-2 border-grid-strong total-row px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide">
                  Total
                </td>
                {DETAIL_FIELDS.map((field, idx) => {
                  const key = String(field.key);
                  const columnTotal = columnTotals[key] ?? 0;
                  const cells: React.ReactNode[] = [];
                  // Mode-of-Issuance spacer cell between INSPECTION and FSEC.
                  if (idx === 6) {
                    cells.push(
                      <td
                        key="__mode_spacer__"
                        className="border-r border-t-2 border-grid-strong total-row px-2 py-2"
                      />,
                    );
                  }
                  const targetKey = INSP_TARGET_FIELDS[key];
                  if (targetKey) {
                    const targetTotal = slices.reduce(
                      (sum, s) => sum + num(s.inspection[targetKey]),
                      0,
                    );
                    cells.push(
                      <td
                        key={`${key}__target`}
                        className="border-r border-t-2 border-grid-strong total-row px-2 py-2 text-center text-[11px] font-bold tabular-nums"
                      >
                        {targetTotal.toLocaleString()}
                      </td>,
                    );
                  }
                  cells.push(
                    <td
                      key={key}
                      className="border-r border-t-2 border-grid-strong total-row px-2 py-2 text-center text-[11px] font-bold tabular-nums"
                    >
                      {columnTotal.toLocaleString()}
                    </td>,
                  );
                  return cells;
                })}
                <td className="border-r border-t-2 border-grid-strong total-row-strong px-3 py-2 text-center text-[11px] font-bold tabular-nums">
                  {grandTotal.toLocaleString()}
                </td>
                <td className="border-t-2 border-grid-strong total-row px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Route page — kept for deep-linking / bookmarks. */
export default function ComplianceViewPage() {
  const { stationno = "", year = "", month = "" } = useParams();
  const navigate = useNavigate();
  const m = Number(month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance — Daily Details</h1>
            <p className="text-sm text-muted-foreground">
              Read-only day-by-day breakdown for the selected station and month.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <ComplianceViewBody
        stationno={stationno}
        year={Number(year)}
        initialMonth={m >= 1 && m <= 12 ? m : undefined}
      />
    </div>
  );
}

/** Modal wrapper — used from the FSIS Compliance ledger. */
export function ComplianceViewModal({
  open,
  onOpenChange,
  stationno,
  year,
  month,
  stationName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stationno: string;
  year: number;
  month?: number;
  stationName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Eye className="h-5 w-5 text-primary" /> Fire Safety Compliance — Daily Details
          </DialogTitle>
          <DialogDescription>
            {stationName ? `${stationName} · ` : ""}
            {year} — read-only day-by-day breakdown for the selected month.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
          {open ? (
            <ComplianceViewBody stationno={stationno} year={year} initialMonth={month} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
