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
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Eye,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Target,
} from "lucide-react";
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
import StationInfoCard from "@/components/station-info-card";
import { complianceAPI } from "@/services/complianceAPI";
import { MONITORING_THEME } from "./complianceTheme";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { CATEGORY_FIELDS } from "@/lib/complianceHelpers";
import { cn, buildYears, displayNumber } from "@/lib/utils";
import { tooltipStyle, axisProps } from "@/pages/02_dashboard/charts/shared";
import type { ComplianceDailyCounts } from "@/types/complianceType";
import type {
  FSISComplianceMonthlyLedgerModel,
  FSISComplianceDailyClass,
  FSISIssuanceClassModel,
  FSISComplianceDetailModel,
} from "@/types/complianceType";
import type { SearchStationModel } from "@/types/stationTypes";
import { useAuth } from "@/lib/auth";
import { canShowEditAction } from "@/lib/permissions";

/** Re-inspection columns are encoding-screen only (mirrors complianceEdit). */
const EXTRA_CATEGORY_FIELDS = {
  REINSPECTION: [
    { key: "reinsp_bplo", label: "BPLO" },
    { key: "reinsp_gov", label: "GOV" },
    { key: "reinsp_peza", label: "PEZA" },
    { key: "reinsp_tieza", label: "TIEZA" },
  ],
  REFSIC: [
    { key: "refsic_occupancy", label: "Occupancy" },
    { key: "refsic_bplo_new", label: "BPLO New" },
    { key: "refsic_bplo_renewal", label: "BPLO Renew" },
    { key: "refsic_gov", label: "Gov" },
    { key: "refsic_peza", label: "PEZA" },
    { key: "refsic_tieza", label: "TIEZA" },
  ],
  RENOTICES: [
    { key: "renot_ntcv", label: "NTCV" },
    { key: "renot_abatement", label: "Abatement" },
    { key: "renot_closure", label: "Closure" },
  ],
} as const;

const CATEGORY_ORDER = [
  "INSPECTION",
  "REINSPECTION",
  "FSEC",
  "FSIC",
  "NOTICES",
  "REFSIC",
  "RENOTICES",
] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: (category in EXTRA_CATEGORY_FIELDS
    ? EXTRA_CATEGORY_FIELDS[category as keyof typeof EXTRA_CATEGORY_FIELDS]
    : CATEGORY_FIELDS[category as keyof typeof CATEGORY_FIELDS]) as unknown as {
    key: string;
    label: string;
  }[],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

// Unified palette — every group/sub-group shares the same color family
// (see monitoringTheme.ts). Grouping is preserved by labels, not by hue.
const GROUP_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSoft,
  REINSPECTION: MONITORING_THEME.headerSoft,
  FSEC: MONITORING_THEME.headerSoft,
  FSIC: MONITORING_THEME.headerSoft,
  NOTICES: MONITORING_THEME.headerSoft,
  REFSIC: MONITORING_THEME.headerSoft,
  RENOTICES: MONITORING_THEME.headerSoft,
};

const SUB_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: MONITORING_THEME.headerSofter,
  REINSPECTION: MONITORING_THEME.headerSofter,
  FSEC: MONITORING_THEME.headerSofter,
  FSIC: MONITORING_THEME.headerSofter,
  NOTICES: MONITORING_THEME.headerSofter,
  REFSIC: MONITORING_THEME.headerSofter,
  RENOTICES: MONITORING_THEME.headerSofter,
};

const FIELD_CATEGORY = new Map<string, (typeof CATEGORY_ORDER)[number]>(
  FIELD_GROUPS.flatMap((g) => g.fields.map((f) => [String(f.key), g.category] as const)),
);

const INSPECTION_PLAIN_COLS = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
] as const;

const INSPECTION_TARGET_COLS = [
  {
    key: "inspectbplocount",
    label: "BPLO",
    targetKey: "dailytargetbplo",
    reKey: "reinspectbplocount",
  },
  {
    key: "inspectgovcount",
    label: "GOV",
    targetKey: "dailytargetgov",
    reKey: "reinspectgovcount",
  },
  {
    key: "inspectpezacount",
    label: "PEZA",
    targetKey: "dailytargetpeza",
    reKey: "reinspectpezacount",
  },
  {
    key: "inspecttiezacount",
    label: "TIEZA",
    targetKey: "dailytargettieza",
    reKey: "reinspecttiezacount",
  },
] as const;

const ISSUANCE_GROUPS: ReadonlyArray<{
  title: string;
  cols: ReadonlyArray<{ key: string; label: string }>;
}> = [
  {
    title: "FSEC",
    cols: [
      { key: "fsecbuildingcount", label: "Building" },
      { key: "fsecgovcount", label: "GOV" },
      { key: "fsecpezacount", label: "PEZA" },
      { key: "fsectiezacount", label: "TIEZA" },
    ],
  },
  {
    title: "FSIC",
    cols: [
      { key: "fsicoccupancycount", label: "Occupancy" },
      { key: "fsicbplonewcount", label: "BPLO New" },
      { key: "fsicbplorenewcount", label: "BPLO Renew" },
      { key: "fsicgovcount", label: "GOV" },
      { key: "fsicpezacount", label: "PEZA" },
      { key: "fsictiezacount", label: "TIEZA" },
    ],
  },
  {
    title: "Issued Notices",
    cols: [
      { key: "nodcount", label: "NOD" },
      { key: "ntccount", label: "NTC" },
      { key: "ntcvcount", label: "NTCV" },
      { key: "abatementcount", label: "Abatement" },
      { key: "closurecount", label: "Closure" },
    ],
  },
];

const FSIC_SECTORS: ReadonlyArray<{ key: string; reKey: string; label: string }> = [
  { key: "fsicoccupancycount", reKey: "refsicoccupancycount", label: "Occupancy" },
  { key: "fsicbplonewcount", reKey: "refsicbplonewcount", label: "BPLO New" },
  { key: "fsicbplorenewcount", reKey: "refsicbplorenewcount", label: "BPLO Renew" },
  { key: "fsicgovcount", reKey: "refsicgovcount", label: "GOV" },
  { key: "fsicpezacount", reKey: "refsicpezacount", label: "PEZA" },
  { key: "fsictiezacount", reKey: "refsictiezacount", label: "TIEZA" },
];

const NOTICE_GROUPS: ReadonlyArray<{ key: string; reKey: string; label: string }> = [
  { key: "ntcvcount", reKey: "rentcvcount", label: "NTCV" },
  { key: "abatementcount", reKey: "reabatementcount", label: "Abatement" },
  { key: "closurecount", reKey: "reclosurecount", label: "Closure" },
];

const ISSUANCE_COLS: Array<{ key: string; label: string }> = ISSUANCE_GROUPS.flatMap((g) =>
  Array.from(g.cols),
);

const STRONG_RIGHT_BORDER_KEYS = new Set([
  ...INSPECTION_PLAIN_COLS.slice(-1).map((c) => c.key),
  ...INSPECTION_TARGET_COLS.slice(-1).map((c) => c.key),
  ...ISSUANCE_GROUPS.flatMap((g) => g.cols.slice(-1).map((c) => c.key)),
  "fsectiezacount",
  "fsicoccupancycount",
  "nodcount",
  "ntccount",
  "ntcvcount",
]);

const headCell =
  "border-b border-border/40 bg-blue-50/90 dark:bg-slate-800/95 backdrop-blur-sm px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-blue-700/90 dark:text-blue-300/90 whitespace-nowrap text-center";
const bodyCell =
  "border-b border-border/25 px-2.5 py-1.5 text-xs tabular-nums text-center text-foreground/90";
const footCell =
  "border-t border-border/50 bg-blue-100/90 dark:bg-slate-800/95 backdrop-blur-sm px-2.5 py-2 text-xs font-bold tabular-nums text-center text-blue-800 dark:text-blue-200";

/** Flat inspection record extracted from a Monthly ledger row. */
interface InspectionCounts {
  remarks: string;
  inspectduringcount: number;
  inspectaftercount: number;
  inspectbplocount: number;
  inspectgovcount: number;
  inspectpezacount: number;
  inspecttiezacount: number;
  reinspectbplocount: number;
  reinspectgovcount: number;
  reinspectpezacount: number;
  reinspecttiezacount: number;
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
  refsicoccupancycount: number;
  refsicbplonewcount: number;
  refsicbplorenewcount: number;
  refsicgovcount: number;
  refsicpezacount: number;
  refsictiezacount: number;
  rentcvcount: number;
  reabatementcount: number;
  reclosurecount: number;
}

/** Map ComplianceDailyCounts keys to the flat API count keys. */
const FIELD_TO_API: Record<string, string> = {
  insp_during: "inspectduringcount",
  insp_after: "inspectaftercount",
  insp_bplo: "inspectbplocount",
  insp_gov: "inspectgovcount",
  insp_peza: "inspectpezacount",
  insp_tieza: "inspecttiezacount",
  reinsp_bplo: "reinspectbplocount",
  reinsp_gov: "reinspectgovcount",
  reinsp_peza: "reinspectpezacount",
  reinsp_tieza: "reinspecttiezacount",
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
  refsic_occupancy: "refsicoccupancycount",
  refsic_bplo_new: "refsicbplonewcount",
  refsic_bplo_renewal: "refsicbplorenewcount",
  refsic_gov: "refsicgovcount",
  refsic_peza: "refsicpezacount",
  refsic_tieza: "refsictiezacount",
  renot_ntcv: "rentcvcount",
  renot_abatement: "reabatementcount",
  renot_closure: "reclosurecount",
};

/** True when a UI field key belongs to the (re)inspection block. */
const isInspectionKey = (key: string) => key.startsWith("insp_") || key.startsWith("reinsp_");

/** Inspection columns that render a Target | Compliance pair. */
const INSP_TARGET_FIELDS: Record<string, keyof InspectionCounts> = {
  insp_bplo: "dailytargetbplo",
  insp_gov: "dailytargetgov",
  insp_peza: "dailytargetpeza",
  insp_tieza: "dailytargettieza",
};

const INSPECTION_COLSPAN = INSPECTION_PLAIN_COLS.length + INSPECTION_TARGET_COLS.length * 3;

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
  refsicoccupancycount: 0,
  refsicbplonewcount: 0,
  refsicbplorenewcount: 0,
  refsicgovcount: 0,
  refsicpezacount: 0,
  refsictiezacount: 0,
  rentcvcount: 0,
  reabatementcount: 0,
  reclosurecount: 0,
});

function buildSlices(
  list: Array<FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>> | null | undefined,
  year: number,
  month: number,
): DaySlice[] {
  const byDate = new Map<string, FSISComplianceDailyClass & Partial<FSISIssuanceClassModel>>();
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
      reinspectbplocount: num((rec as { reinspectbplocount?: number })?.reinspectbplocount),
      reinspectgovcount: num((rec as { reinspectgovcount?: number })?.reinspectgovcount),
      reinspectpezacount: num((rec as { reinspectpezacount?: number })?.reinspectpezacount),
      reinspecttiezacount: num((rec as { reinspecttiezacount?: number })?.reinspecttiezacount),
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
          refsicoccupancycount: num(
            (iss as { refsicoccupancycount?: number })?.refsicoccupancycount,
          ),
          refsicbplonewcount: num((iss as { refsicbplonewcount?: number })?.refsicbplonewcount),
          refsicbplorenewcount: num(
            (iss as { refsicbplorenewcount?: number })?.refsicbplorenewcount,
          ),
          refsicgovcount: num((iss as { refsicgovcount?: number })?.refsicgovcount),
          refsicpezacount: num((iss as { refsicpezacount?: number })?.refsicpezacount),
          refsictiezacount: num((iss as { refsictiezacount?: number })?.refsictiezacount),
          rentcvcount: num((iss as { rentcvcount?: number })?.rentcvcount),
          reabatementcount: num((iss as { reabatementcount?: number })?.reabatementcount),
          reclosurecount: num((iss as { reclosurecount?: number })?.reclosurecount),
        };
        if (mode === 96) manual = parsed;
        else if (mode === 97) fsis = parsed;
      }
    }

    const totals: DayTotals = {};
    for (const field of DETAIL_FIELDS) {
      const apiKey = FIELD_TO_API[String(field.key)];
      if (!apiKey) continue;
      if (isInspectionKey(String(field.key))) {
        totals[field.key as keyof ComplianceDailyCounts] = num((inspection as any)[apiKey]);
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
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.target} />
                Target
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.compliance} />
                Compliance
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.variance} />
                Variance
              </th>
              <th className="px-4 py-2 text-center">
                <Dot color={SERIES.positive} />
                Positive Listing
              </th>
              <th className="px-4 py-2 text-center">% Accomplishment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.label}
                className={cn("border-t border-border/50", i % 2 === 1 && "bg-muted/20")}
              >
                <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                <td className="px-4 py-2 text-center tabular-nums" style={{ color: SERIES.target }}>
                  {displayNumber(r.target).toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center tabular-nums"
                  style={{ color: SERIES.compliance }}
                >
                  {displayNumber(r.compliance).toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={r.variance > 0 ? { color: SERIES.variance } : undefined}
                >
                  {displayNumber(r.variance).toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={r.positive > 0 ? { color: SERIES.positive } : undefined}
                >
                  {displayNumber(r.positive).toLocaleString()}
                </td>
                <td
                  className="px-4 py-2 text-center font-medium tabular-nums"
                  style={{
                    color: r.percentage >= 100 ? SERIES.positive : SERIES.compliance,
                  }}
                >
                  {displayNumber(r.percentage).toFixed(2)}%
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-primary/5 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-center tabular-nums" style={{ color: SERIES.target }}>
                {displayNumber(totals.target).toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={{ color: SERIES.compliance }}
              >
                {displayNumber(totals.compliance).toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={totals.variance > 0 ? { color: SERIES.variance } : undefined}
              >
                {displayNumber(totals.variance).toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={totals.positive > 0 ? { color: SERIES.positive } : undefined}
              >
                {displayNumber(totals.positive).toLocaleString()}
              </td>
              <td
                className="px-4 py-2 text-center tabular-nums"
                style={{ color: totalPct >= 100 ? SERIES.positive : SERIES.compliance }}
              >
                {displayNumber(totalPct).toFixed(2)}%
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
 *  - Two rows per day (MANUAL / FSIS) for FSEC, FSIC, and Issued Notices.
 *  - Inspection, Total, and Remarks columns are merged across the two rows
 *    (rowSpan=2) so the day's values represent the combined MANUAL + FSIS
 *    output.
 */
function ComplianceViewBody({
  stationno,
  year,
  initialMonth,
  onPeriodChange,
}: {
  stationno: string;
  year: number;
  initialMonth?: number;
  onPeriodChange?: (year: number, month: number) => void;
}) {
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    if (initialMonth && initialMonth >= 1 && initialMonth <= 12) return initialMonth;
    return new Date().getMonth() + 1;
  });
  const [selectedYear, setSelectedYear] = React.useState<number>(year || new Date().getFullYear());
  const [loading, setLoading] = React.useState(true);
  const [station, setStation] = React.useState<FSISComplianceMonthlyLedgerModel | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  const YEAR_OPTIONS = React.useMemo(buildYears, []);
  const baseMonth =
    initialMonth && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : new Date().getMonth() + 1;
  const isPeriodChanged = selectedMonth !== baseMonth || selectedYear !== year;

  React.useEffect(() => {
    setSelectedMonth(baseMonth);
    setSelectedYear(year || new Date().getFullYear());
  }, [baseMonth, year]);

  React.useEffect(() => {
    onPeriodChange?.(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, onPeriodChange]);

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
          reportyear: selectedYear,
          reportmonth: selectedMonth,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;

      const { ok, data, error } = unwrap<FSISComplianceDetailModel | FSISComplianceDetailModel[]>(
        resp,
      );
      if (!ok) toast.error(error || "Failed to load daily details.");
      const first = ok ? (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) : null;
      setStation(
        first
          ? ({
              stationno: String(first?.stationno ?? ""),
              stationcode: String(first?.stationcode ?? ""),
              stationname: String(first?.stationname ?? ""),
              regionno: "",
              regioncode: "",
              regionname: "",
              provinceno: String(first?.provinceno ?? ""),
              provincename: String(first?.provincename ?? ""),
              cityno: "",
              zipcode: "",
              cityname: String(first?.cityname ?? ""),
              barangayno: "",
              barangayname: "",
              streetaddress: "",
              logourl: String(first?.logourl ?? ""),
              month: selectedMonth,
              year: selectedYear,
              totaltargetbplo: 0,
              totaltargetgov: 0,
              totaltargetpeza: 0,
              totaltargettieza: 0,
              totalAccomplishmentbplo: 0,
              totalAccomplishmentgov: 0,
              totalAccomplishmentpeza: 0,
              totalAccomplishmenttieza: 0,
              updatedby: "",
              encodedby: "",
              complianceLedgerList: (Array.isArray(first?.compliancelist)
                ? first.compliancelist
                : []
              ).map((rec) => ({
                ...rec,
                fsisno: String((rec as { fsisno?: string }).fsisno ?? ""),
                dailytargetbplo:
                  Number((rec as { dailytargetbplo?: number }).dailytargetbplo ?? 0) || 0,
                dailytargetgov:
                  Number((rec as { dailytargetgov?: number }).dailytargetgov ?? 0) || 0,
                dailytargetpeza:
                  Number((rec as { dailytargetpeza?: number }).dailytargetpeza ?? 0) || 0,
                dailytargettieza:
                  Number((rec as { dailytargettieza?: number }).dailytargettieza ?? 0) || 0,
                inspectduringcount:
                  Number((rec as { inspectduringcount?: number }).inspectduringcount ?? 0) || 0,
                inspectaftercount:
                  Number((rec as { inspectaftercount?: number }).inspectaftercount ?? 0) || 0,
                inspectbplocount:
                  Number((rec as { inspectbplocount?: number }).inspectbplocount ?? 0) || 0,
                inspectgovcount:
                  Number((rec as { inspectgovcount?: number }).inspectgovcount ?? 0) || 0,
                inspectpezacount:
                  Number((rec as { inspectpezacount?: number }).inspectpezacount ?? 0) || 0,
                inspecttiezacount:
                  Number((rec as { inspecttiezacount?: number }).inspecttiezacount ?? 0) || 0,
                remarks: String((rec as { remarks?: string }).remarks ?? ""),
                dateinspected: String((rec as { dateinspected?: string }).dateinspected ?? ""),
                issuancelist: Array.isArray((rec as { issuancelist?: unknown[] }).issuancelist)
                  ? ((rec as { issuancelist?: unknown[] }).issuancelist as unknown[])
                  : [],
              })) as FSISComplianceMonthlyLedgerModel["complianceLedgerList"],
            } as FSISComplianceMonthlyLedgerModel)
          : null,
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, selectedYear, selectedMonth]);

  const slices = React.useMemo<DaySlice[]>(
    () => buildSlices(station?.complianceLedgerList, selectedYear, selectedMonth),
    [station, selectedYear, selectedMonth],
  );

  /**
   * Target vs. Compliance per category — derived directly from the daily
   * `dailytarget*` and `inspect*count` values of the loaded month.
   */
  const accomplishmentRows = React.useMemo<AccomplishmentRow[]>(
    () =>
      ACC_CATEGORIES.map((c) => {
        const target = slices.reduce((sum, s) => sum + num(s.inspection[c.targetKey]), 0);
        const compliance = slices.reduce((sum, s) => sum + num(s.inspection[c.countKey]), 0);
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

  if (loading && !station) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reporting Period ------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
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
                setSelectedYear(year || new Date().getFullYear());
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to {MONTHS[baseMonth - 1]?.name} {year}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Month</span>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
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
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-10 w-full">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Station Information ---------------------------------------------- */}
      <StationInfoCard
        stationName={station?.stationname || ""}
        unitCode={station?.stationcode || ""}
        logoUrl={station?.logourl || null}
        fields={[
          { label: "Station Code", value: station?.stationcode ?? "" },
          { label: "City / Municipality", value: station?.cityname ?? "" },
          { label: "Province", value: station?.provincename ?? "" },
        ]}
      />

      {/* Target vs. Compliance -------------------------------------------- */}
      <InlineAccomplishmentPanel
        rows={accomplishmentRows}
        periodLabel={`${MONTHS[selectedMonth - 1]?.name ?? ""} ${selectedYear}`}
      />

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="max-h-[65vh] w-full max-w-full overflow-auto">
          <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={3}
                  className={`${headCell} sticky left-0 top-0 z-40 min-w-[120px] h-[34px] border-r border-r-border/50 text-left shadow-[2px_0_6px_-4px_hsl(var(--foreground)/0.35)] ${MONITORING_THEME.headerPrimary}`}
                >
                  Date
                </th>
                <th
                  colSpan={INSPECTION_COLSPAN}
                  className={`${headCell} sticky top-0 z-30 h-[34px] border-r-2 border-r-border/80 ${GROUP_TONE.INSPECTION}`}
                >
                  Inspection
                </th>
                <th
                  rowSpan={3}
                  className={`${headCell} sticky top-0 z-30 h-[34px] min-w-[90px] border-r-2 border-r-border/80 ${MONITORING_THEME.headerSoft}`}
                >
                  Mode of
                  <br />
                  Issuance
                </th>
                {ISSUANCE_GROUPS.map((g, idx) => {
                  const colSpan =
                    g.title === "FSIC"
                      ? g.cols.length * 2
                      : g.title === "Issued Notices"
                      ? 2 + NOTICE_GROUPS.length * 2
                      : g.cols.length;
                  return (
                    <th
                      key={g.title}
                      colSpan={colSpan}
                      className={`${headCell} sticky top-0 z-30 ${idx < ISSUANCE_GROUPS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      {g.title}
                    </th>
                  );
                })}
                <th
                  rowSpan={3}
                  className={`${headCell} sticky top-0 z-30 h-[34px] min-w-[70px] ${MONITORING_THEME.headerPrimary}`}
                >
                  Total
                </th>
                <th
                  rowSpan={3}
                  className={`${headCell} sticky top-0 z-30 h-[34px] min-w-[160px] ${MONITORING_THEME.headerSoft} text-left`}
                >
                  Remarks
                </th>
              </tr>
              <tr>
                {INSPECTION_PLAIN_COLS.map((c, idx) => (
                  <th
                    key={c.key}
                    rowSpan={2}
                    className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] ${idx === 0 || idx === INSPECTION_PLAIN_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                {INSPECTION_TARGET_COLS.map((c, idx) => (
                  <th
                    key={c.key}
                    colSpan={3}
                    className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[10rem] ${idx < INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
                {ISSUANCE_GROUPS.map((group) => {
                  if (group.title === "FSIC") {
                    return FSIC_SECTORS.map((sector) => (
                      <th
                        key={sector.key}
                        colSpan={2}
                        className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[7rem] border-r-2 border-r-border/80`}
                      >
                        {sector.label}
                      </th>
                    ));
                  }

                  if (group.title === "Issued Notices") {
                    return [
                      <th
                        key="nodcount"
                        rowSpan={2}
                        className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] border-r-2 border-r-border/80`}
                      >
                        NOD
                      </th>,
                      <th
                        key="ntccount"
                        rowSpan={2}
                        className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] border-r-2 border-r-border/80`}
                      >
                        NTC
                      </th>,
                      ...NOTICE_GROUPS.map((groupItem) => (
                        <th
                          key={groupItem.key}
                          colSpan={2}
                          className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[7rem] border-r-2 border-r-border/80`}
                        >
                          {groupItem.label}
                        </th>
                      )),
                    ];
                  }

                  return group.cols.map((c) => (
                    <th
                      key={c.key}
                      rowSpan={2}
                      className={`${headCell} sticky top-[34px] z-30 h-[34px] min-w-[5rem] ${STRONG_RIGHT_BORDER_KEYS.has(c.key) ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      {c.label}
                    </th>
                  ));
                })}
              </tr>
              <tr>
                {INSPECTION_TARGET_COLS.map((c, idx) => (
                  <React.Fragment key={c.key}>
                    <th
                      title="Target"
                      className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                    >
                      <span className="block leading-[1.1]">TARGET</span>
                    </th>
                    <th
                      title="1st Inspection"
                      className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                    >
                      <span className="block leading-[1.1]">1ST</span>
                      <span className="block leading-[1.1]">INSPECTION</span>
                    </th>
                    <th
                      title="Re-inspection"
                      className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center ${idx === INSPECTION_TARGET_COLS.length - 1 ? "border-r-2 border-r-border/80" : ""}`}
                    >
                      <span className="block leading-[1.1]">RE-</span>
                      <span className="block leading-[1.1]">INSPECTION</span>
                    </th>
                  </React.Fragment>
                ))}
                {ISSUANCE_GROUPS.map((group) => {
                  if (group.title === "FSIC") {
                    return FSIC_SECTORS.flatMap((sector) => [
                      <th
                        key={`${sector.key}-first`}
                        title="1st Inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                      >
                        <span className="block leading-[1.1]">1ST</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>,
                      <th
                        key={`${sector.key}-re`}
                        title="Re-inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center border-r-2 border-r-border/80`}
                      >
                        <span className="block leading-[1.1]">RE-</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>,
                    ]);
                  }

                  if (group.title === "Issued Notices") {
                    return NOTICE_GROUPS.flatMap((groupItem) => [
                      <th
                        key={`${groupItem.key}-first`}
                        title="1st Inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center`}
                      >
                        <span className="block leading-[1.1]">1ST</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>,
                      <th
                        key={`${groupItem.key}-re`}
                        title="Re-inspection"
                        className={`${headCell} sticky top-[68px] z-30 h-auto min-w-[5rem] px-1 py-1 text-center border-r-2 border-r-border/80`}
                      >
                        <span className="block leading-[1.1]">RE-</span>
                        <span className="block leading-[1.1]">INSPECTION</span>
                      </th>,
                    ]);
                  }

                  return null;
                })}
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, dayIndex) => {
                const rowBg =
                  dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd;
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
                        className={`sticky left-0 z-20 ${bodyCell} border-r ${rowBg} text-left font-semibold`}
                      >
                        <span
                          className={rowTotal > 0 ? "text-primary-700 dark:text-primary-300" : ""}
                        >
                          {slice.label}
                        </span>
                      </td>

                      {/* Inspection — merged across MANUAL/FSIS rows */}
                      {DETAIL_FIELDS.flatMap((field) => {
                        const key = String(field.key);
                        if (!isInspectionKey(key)) return [];
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
                              className={`${bodyCell} border-r text-muted-foreground`}
                            >
                              {displayNumber(t).toLocaleString()}
                            </td>,
                          );
                        }
                        cells.push(
                          <td
                            key={key}
                            rowSpan={2}
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
                          </td>,
                        );
                        return cells;
                      })}

                      <td
                        className={`${headCell} border-r ${MONITORING_THEME.headerSoft} text-[11px] font-bold uppercase`}
                      >
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
                          </td>
                        );
                      })}

                      {/* Re-FSIC + Re-Notices (manual) */}
                      {DETAIL_FIELDS.map((field) => {
                        const k = String(field.key);
                        if (!k.startsWith("refsic_") && !k.startsWith("renot_")) return null;
                        const apiKey = FIELD_TO_API[k];
                        const v = num((slice.manual as unknown as Record<string, number>)[apiKey]);
                        return (
                          <td
                            key={k}
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
                          </td>
                        );
                      })}

                      {/* Total — merged across MANUAL/FSIS rows */}
                      <td
                        rowSpan={2}
                        className={`${bodyCell} border-r font-semibold`}
                      >
                        {displayNumber(rowTotal).toLocaleString()}
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
                      <td
                        className={`${headCell} border-r ${MONITORING_THEME.headerSoft} text-[11px] font-bold uppercase`}
                      >
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
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
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
                          </td>
                        );
                      })}

                      {/* Re-FSIC + Re-Notices (fsis) */}
                      {DETAIL_FIELDS.map((field) => {
                        const k = String(field.key);
                        if (!k.startsWith("refsic_") && !k.startsWith("renot_")) return null;
                        const apiKey = FIELD_TO_API[k];
                        const v = num((slice.fsis as unknown as Record<string, number>)[apiKey]);
                        return (
                          <td
                            key={k}
                            className={`${bodyCell} border-r`}
                          >
                            {displayNumber(v).toLocaleString()}
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
                <td className={`${footCell} sticky left-0 z-30 border-r border-t-2 border-grid-strong text-left uppercase tracking-wide`}>
                  Total
                </td>
                {DETAIL_FIELDS.map((field, idx) => {
                  const key = String(field.key);
                  const columnTotal = columnTotals[key] ?? 0;
                  const cells: React.ReactNode[] = [];
                  // Mode-of-Issuance spacer cell between INSPECTION and FSEC.
                  if (idx === 10) {
                    cells.push(
                      <td
                        key="__mode_spacer__"
                        className={`${footCell} border-r border-t-2 border-grid-strong`}
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
                        className={`${footCell} border-r border-t-2 border-grid-strong`}
                      >
                        {displayNumber(targetTotal).toLocaleString()}
                      </td>,
                    );
                  }
                  cells.push(
                    <td
                      key={key}
                      className={`${footCell} border-r border-t-2 border-grid-strong`}
                    >
                      {displayNumber(columnTotal).toLocaleString()}
                    </td>,
                  );
                  return cells;
                })}
                <td className={`${footCell} border-r border-t-2 border-grid-strong`}> 
                  {displayNumber(grandTotal).toLocaleString()}
                </td>
                <td className={`${footCell} border-t-2 border-grid-strong`} />
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
            <h1 className="text-2xl font-bold tracking-tight">
              Fire Safety Compliance — Daily Details
            </h1>
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
  onEdit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stationno: string;
  year: number;
  month?: number;
  stationName?: string;
  /** Opens the edit modal for the period currently shown in this view. */
  onEdit?: (year: number, month: number) => void;
}) {
  const { user, systemAccess } = useAuth();
  const canEdit = canShowEditAction(user, systemAccess);
  const [viewPeriod, setViewPeriod] = React.useState<{ year: number; month: number }>({
    year,
    month: month ?? new Date().getMonth() + 1,
  });
  const handlePeriodChange = React.useCallback(
    (y: number, m: number) => setViewPeriod({ year: y, month: m }),
    [],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3 text-left">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Fire Safety Compliance — Daily Details
              </DialogTitle>
              <DialogDescription>
                {stationName ? `${stationName} · ` : ""}
                {month ? `${MONTHS[month - 1]?.name ?? ""} ` : ""}
                {year}
              </DialogDescription>
              <p className="mt-1 text-[11px] text-muted-foreground/90">
                <Lock className="mr-1 inline h-3 w-3 text-warning" aria-hidden="true" />
                View only — values are displayed as recorded and cannot be modified here.
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden bg-muted/20 px-5 py-5">
          {open ? (
            <ComplianceViewBody
              stationno={stationno}
              year={year}
              initialMonth={month}
              onPeriodChange={handlePeriodChange}
            />
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t bg-background px-5 py-3">
          {onEdit && canEdit && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onEdit(viewPeriod.year, viewPeriod.month);
              }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
