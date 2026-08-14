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
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { stationAPI } from "@/services/stationAPI";
import StationInfoCard from "@/components/station-info-card";
import { complianceAPI } from "@/services/complianceAPI";
import { MONITORING_THEME } from "./complianceTheme";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import type {
  FSISComplianceDetailModel,
  FSISComplianceDetailClassModel,
  TargetAccomplishmentModel,
} from "@/types/complianceType";
import type { SearchStationModel } from "@/types/stationTypes";
import { useAuth } from "@/lib/auth";
import { canShowEditAction } from "@/lib/permissions";

/* ========================================================================== */
/*  Column definitions — keyed by the EXACT API property names               */
/*  (mirrors complianceEdit.tsx so both screens share one presentation)      */
/* ========================================================================== */

type InspectionField =
  | "inspectduringcount"
  | "inspectaftercount"
  | "inspectbplocount"
  | "inspectgovcount"
  | "inspectpezacount"
  | "inspecttiezacount"
  | "reinspectoccupancycount"
  | "reinspectbplocount"
  | "reinspectgovcount"
  | "reinspectpezacount"
  | "reinspecttiezacount";

type TargetField = "dailytargetbplo" | "dailytargetgov" | "dailytargetpeza" | "dailytargettieza";

type IssuanceField =
  | "fsecbuildingcount"
  | "fsecgovcount"
  | "fsecpezacount"
  | "fsectiezacount"
  | "fsicoccupancycount"
  | "fsicbplonewcount"
  | "fsicbplorenewcount"
  | "fsicgovcount"
  | "fsicpezacount"
  | "fsictiezacount"
  | "nodcount"
  | "ntccount"
  | "ntcvcount"
  | "abatementcount"
  | "closurecount"
  | "refsicoccupancycount"
  | "refsicbplonewcount"
  | "refsicbplorenewcount"
  | "refsicgovcount"
  | "refsicpezacount"
  | "refsictiezacount"
  | "rentcvcount"
  | "reabatementcount"
  | "reclosurecount";

interface InspectionCol {
  api: InspectionField;
  label: string;
  target?: TargetField;
}
interface IssuanceCol {
  api: IssuanceField;
  label: string;
}

/* -- Daily Inspection & Issuance ------------------------------------------ */
const INSPECT_COLS: InspectionCol[] = [
  { api: "inspectduringcount", label: "During" },
  { api: "inspectaftercount", label: "After" },
  { api: "inspectbplocount", label: "BPLO", target: "dailytargetbplo" },
  { api: "inspectgovcount", label: "GOV", target: "dailytargetgov" },
  { api: "inspectpezacount", label: "PEZA", target: "dailytargetpeza" },
  { api: "inspecttiezacount", label: "TIEZA", target: "dailytargettieza" },
];

const FSEC_COLS: IssuanceCol[] = [
  { api: "fsecbuildingcount", label: "Building" },
  { api: "fsecgovcount", label: "Gov" },
  { api: "fsecpezacount", label: "PEZA" },
  { api: "fsectiezacount", label: "TIEZA" },
];

const FSIC_COLS: IssuanceCol[] = [
  { api: "fsicoccupancycount", label: "Occupancy" },
  { api: "fsicbplonewcount", label: "BPLO New" },
  { api: "fsicbplorenewcount", label: "BPLO Renew" },
  { api: "fsicgovcount", label: "Gov" },
  { api: "fsicpezacount", label: "PEZA" },
  { api: "fsictiezacount", label: "TIEZA" },
];

const NOTICE_COLS: IssuanceCol[] = [
  { api: "nodcount", label: "NOD" },
  { api: "ntccount", label: "NTC" },
  { api: "ntcvcount", label: "NTCV" },
  { api: "abatementcount", label: "Abatement" },
  { api: "closurecount", label: "Closure" },
];

/* -- Daily Reinspection ---------------------------------------------------- */
const REINSPECT_COLS: InspectionCol[] = [
  { api: "reinspectoccupancycount", label: "Occupancy" },
  { api: "reinspectbplocount", label: "BPLO" },
  { api: "reinspectgovcount", label: "GOV" },
  { api: "reinspectpezacount", label: "PEZA" },
  { api: "reinspecttiezacount", label: "TIEZA" },
];

const REFSIC_COLS: IssuanceCol[] = [
  { api: "refsicoccupancycount", label: "Occupancy" },
  { api: "refsicbplonewcount", label: "BPLO New" },
  { api: "refsicbplorenewcount", label: "BPLO Renew" },
  { api: "refsicgovcount", label: "Gov" },
  { api: "refsicpezacount", label: "PEZA" },
  { api: "refsictiezacount", label: "TIEZA" },
];

const RENOTICE_COLS: IssuanceCol[] = [
  { api: "rentcvcount", label: "NTCV" },
  { api: "reabatementcount", label: "Abatement" },
  { api: "reclosurecount", label: "Closure" },
];

const ALL_INSPECTION_FIELDS: InspectionField[] = [
  ...INSPECT_COLS.map((c) => c.api),
  ...REINSPECT_COLS.map((c) => c.api),
];

const ALL_ISSUANCE_FIELDS: IssuanceField[] = [
  ...FSEC_COLS.map((c) => c.api),
  ...FSIC_COLS.map((c) => c.api),
  ...NOTICE_COLS.map((c) => c.api),
  ...REFSIC_COLS.map((c) => c.api),
  ...RENOTICE_COLS.map((c) => c.api),
];

/* ========================================================================== */
/*  Read-only model                                                          */
/* ========================================================================== */

type ViewInspection = Record<InspectionField, number> &
  Record<TargetField, number> & {
    fsisno: string;
    dateinspected: string;
  };

type ViewIssuance = Record<IssuanceField, number> & {
  issuanceno: string;
  fsicmode: number;
};

interface ViewDay {
  day: number;
  label: string;
  key: string;
  inspection: ViewInspection;
  /** fsicmode 96 */
  manual: ViewIssuance;
  /** fsicmode 97 */
  fsis: ViewIssuance;
}

const FSIC_MODE_MANUAL = 96;
const FSIC_MODE_FSIS = 97;

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(accomplished: number, target: number): number {
  return target > 0 ? (accomplished / target) * 100 : 0;
}

function getInspectionPct(
  accomplished: number,
  target: number,
): { text: string; className: string } {
  if (target > 0 && accomplished === 0) {
    return { text: "-100.00%", className: "text-destructive" };
  }
  if (target === 0 && accomplished > 0) {
    return { text: "100.00%", className: "text-success" };
  }
  const value = pct(accomplished, target);
  return {
    text: `${value.toFixed(2)}%`,
    className: value > 0 ? "text-success" : "",
  };
}

function toLocalKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
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

function emptyIssuance(fsicmode: number): ViewIssuance {
  const base = Object.fromEntries(ALL_ISSUANCE_FIELDS.map((f) => [f, 0])) as Record<
    IssuanceField,
    number
  >;
  return { ...base, issuanceno: EMPTY_GUID, fsicmode };
}

function emptyInspection(dateKey: string): ViewInspection {
  const counts = Object.fromEntries(ALL_INSPECTION_FIELDS.map((f) => [f, 0])) as Record<
    InspectionField,
    number
  >;
  return {
    ...counts,
    dailytargetbplo: 0,
    dailytargetgov: 0,
    dailytargetpeza: 0,
    dailytargettieza: 0,
    fsisno: EMPTY_GUID,
    dateinspected: dateKey,
  };
}

/**
 * Build one entry per calendar day straight from the Detail API's
 * `compliancelist`. Days the API did not return stay empty; issuance records
 * are kept separate per `fsicmode` (96 = MANUAL, 97 = FSIS).
 */
function buildViewDays(
  list: FSISComplianceDetailClassModel[] | null | undefined,
  year: number,
  month: number,
): ViewDay[] {
  const dataByDate = new Map<string, FSISComplianceDetailClassModel>();
  for (const item of Array.isArray(list) ? list : []) {
    const key = normalizeDateKey(item?.dateinspected);
    if (key) dataByDate.set(key, item);
  }

  const total = daysInMonth(year, month);
  const monthName = MONTHS[month - 1]?.name ?? "";
  const out: ViewDay[] = [];

  for (let d = 1; d <= total; d++) {
    const key = toLocalKey(year, month, d);
    const rec = dataByDate.get(key);

    const inspection = emptyInspection(key);
    let manual = emptyIssuance(FSIC_MODE_MANUAL);
    let fsis = emptyIssuance(FSIC_MODE_FSIS);

    if (rec) {
      inspection.fsisno = String(rec.fsisno ?? EMPTY_GUID);
      inspection.dateinspected = String(rec.dateinspected ?? key);
      inspection.dailytargetbplo = num(rec.dailytargetbplo);
      inspection.dailytargetgov = num(rec.dailytargetgov);
      inspection.dailytargetpeza = num(rec.dailytargetpeza);
      inspection.dailytargettieza = num(rec.dailytargettieza);
      for (const f of ALL_INSPECTION_FIELDS) {
        inspection[f] = num((rec as unknown as Record<string, unknown>)[f]);
      }

      for (const iss of Array.isArray(rec.issuancelist) ? rec.issuancelist : []) {
        const mode = num(iss?.fsicmode);
        if (mode !== FSIC_MODE_MANUAL && mode !== FSIC_MODE_FSIS) continue;
        const target = emptyIssuance(mode);
        target.issuanceno = String(iss?.issuanceno ?? EMPTY_GUID);
        for (const f of ALL_ISSUANCE_FIELDS) {
          target[f] = num((iss as unknown as Record<string, unknown>)[f]);
        }
        if (mode === FSIC_MODE_MANUAL) manual = target;
        else fsis = target;
      }
    }

    out.push({ day: d, label: `${monthName} ${d}, ${year}`, key, inspection, manual, fsis });
  }

  return out;
}

/** Header info taken from the Detail API payload. */
interface StationHeader {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  logourl: string;
}

/* ========================================================================== */
/*  Per-day totals                                                           */
/* ========================================================================== */

const sumIssuance = (day: ViewDay, cols: IssuanceCol[]) =>
  cols.reduce((sum, c) => sum + num(day.manual[c.api]) + num(day.fsis[c.api]), 0);

const sumInspection = (day: ViewDay, cols: InspectionCol[]) =>
  cols.reduce((sum, c) => sum + num(day.inspection[c.api]), 0);

const inspectionRowTotal = (day: ViewDay) =>
  sumInspection(day, INSPECT_COLS) +
  sumIssuance(day, FSEC_COLS) +
  sumIssuance(day, FSIC_COLS) +
  sumIssuance(day, NOTICE_COLS);

const reinspectionRowTotal = (day: ViewDay) =>
  sumInspection(day, REINSPECT_COLS) +
  sumIssuance(day, REFSIC_COLS) +
  sumIssuance(day, RENOTICE_COLS);

/* ========================================================================== */
/*  View body                                                                */
/* ========================================================================== */

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
  const [station, setStation] = React.useState<StationHeader | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);
  const [days, setDays] = React.useState<ViewDay[]>([]);

  // Collapsible state for the three daily cards (display only — data is kept).
  const [dashboardExpanded, setDashboardExpanded] = React.useState(false);
  const [issuanceExpanded, setIssuanceExpanded] = React.useState(false);
  const [reinspectionExpanded, setReinspectionExpanded] = React.useState(false);

  const YEAR_OPTIONS = React.useMemo(buildYears, []);
  const baseMonth =
    initialMonth && initialMonth >= 1 && initialMonth <= 12
      ? initialMonth
      : new Date().getMonth() + 1;
  const isPeriodChanged = selectedMonth !== baseMonth || selectedYear !== year;
  const monthName = MONTHS[selectedMonth - 1]?.name ?? String(selectedMonth);

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

  // GET /api/v1/FSISCompliance/Detail?Stationno=&Reportyear=&Reportmonth=
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
      const detail = ok ? (Array.isArray(data) ? (data[0] ?? null) : (data ?? null)) : null;

      setStation(
        detail
          ? {
              stationno: String(detail.stationno ?? ""),
              stationcode: String(detail.stationcode ?? ""),
              stationname: String(detail.stationname ?? ""),
              provinceno: String(detail.provinceno ?? ""),
              provincename: String(detail.provincename ?? ""),
              cityname: String(detail.cityname ?? ""),
              logourl: String(detail.logourl ?? ""),
            }
          : null,
      );
      setDays(buildViewDays(detail?.compliancelist, selectedYear, selectedMonth));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, selectedYear, selectedMonth]);

  /** Monthly target vs. accomplishment, derived from the Detail API values. */
  const monthlySummary: TargetAccomplishmentModel | null = React.useMemo(() => {
    if (!station) return null;
    return days.reduce<TargetAccomplishmentModel>(
      (acc, d) => {
        acc.totaltargetbplo += num(d.inspection.dailytargetbplo);
        acc.totaltargetgov += num(d.inspection.dailytargetgov);
        acc.totaltargetpeza += num(d.inspection.dailytargetpeza);
        acc.totaltargettieza += num(d.inspection.dailytargettieza);
        acc.totalAccomplishmentbplo += num(d.inspection.inspectbplocount);
        acc.totalAccomplishmentgov += num(d.inspection.inspectgovcount);
        acc.totalAccomplishmentpeza += num(d.inspection.inspectpezacount);
        acc.totalAccomplishmenttieza += num(d.inspection.inspecttiezacount);
        return acc;
      },
      {
        stationno: station.stationno,
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
      },
    );
  }, [days, station, selectedMonth, selectedYear]);

  if (loading && days.length === 0) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-8 pb-4 md:space-y-8">
      {/* Reporting Period ---------------------------------------------------- */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
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
              <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
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
              <SelectTrigger className="h-10 w-full [&>span]:flex-1 [&>span]:text-left">
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

      {/* Station Information ------------------------------------------------- */}
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

      {/* Monthly Dashboard ------------------------------------------------------ */}
      <Card className="space-y-4 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Monthly Dashboard"
          subtitle={`Reporting month · ${monthName} ${selectedYear}`}
          expanded={dashboardExpanded}
          onToggle={() => setDashboardExpanded((v) => !v)}
        />

        {dashboardExpanded && (
          <TargetAccomplishmentPanel
            stationno={stationno}
            year={selectedYear}
            month={selectedMonth}
            data={monthlySummary}
          />
        )}
      </Card>

      {/* Daily Inspection & Issuance ------------------------------------------ */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Inspection & Issuance Activities"
          subtitle="Recorded issuances shown separately for MANUAL and FSIS"
          expanded={issuanceExpanded}
          onToggle={() => setIssuanceExpanded((v) => !v)}
        />

        {issuanceExpanded && (
          <ActivityTable
            days={days}
            inspectionLabel="Inspection"
            inspectionCols={INSPECT_COLS}
            targetBreakdown
            groups={[
              { label: "FSEC", cols: FSEC_COLS },
              { label: "FSIC", cols: FSIC_COLS },
              { label: "Issued Notices", cols: NOTICE_COLS },
            ]}
            rowTotal={inspectionRowTotal}
          />
        )}
      </Card>

      {/* Daily Reinspection ---------------------------------------------------- */}
      <Card className="space-y-5 border-border/60 bg-card p-5 shadow-soft">
        <SectionTitle
          title="Daily Reinspection Activities"
          subtitle="Reinspection, RE-FSIC and re-issued notices"
          expanded={reinspectionExpanded}
          onToggle={() => setReinspectionExpanded((v) => !v)}
        />

        {reinspectionExpanded && (
          <ActivityTable
            days={days}
            inspectionLabel="Reinspection"
            inspectionCols={REINSPECT_COLS}
            groups={[
              { label: "RE-FSIC", cols: REFSIC_COLS },
              { label: "Re-Issued Notices", cols: RENOTICE_COLS },
            ]}
            rowTotal={reinspectionRowTotal}
          />
        )}
      </Card>
    </div>
  );
}

/* ========================================================================== */
/*  Day table (read-only twin of the editor table)                           */
/* ========================================================================== */

function ActivityTable({
  days,
  inspectionLabel,
  inspectionCols,
  groups,
  rowTotal,
  targetBreakdown = false,
}: {
  days: ViewDay[];
  inspectionLabel: string;
  inspectionCols: InspectionCol[];
  groups: { label: string; cols: IssuanceCol[] }[];
  rowTotal: (day: ViewDay) => number;
  targetBreakdown?: boolean;
}) {
  const inspectionColspan = inspectionCols.reduce(
    (n, c) => n + (c.target ? (targetBreakdown ? 5 : 2) : 1),
    0,
  );
  const issuanceCols = groups.flatMap((g) => g.cols);

  const issuanceCells = (day: ViewDay, mode: "manual" | "fsis") =>
    issuanceCols.map((col) => (
      <td
        key={col.api}
        className="min-w-[72px] w-[72px] border-b border-r px-2 py-1.5 text-center tabular-nums"
      >
        {num(day[mode][col.api]).toLocaleString()}
      </td>
    ));

  return (
    <div
      className="w-full max-w-full overflow-auto rounded-lg border border-grid shadow-soft"
      style={{ maxHeight: "74vh" }}
    >
      <table className="min-w-max border-separate border-spacing-0 text-[11px] text-foreground">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              rowSpan={3}
              className={`sticky left-0 top-0 z-40 min-w-[180px] border-b border-r px-3 py-2 text-center align-middle text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerPrimary}`}
            >
              Date
            </th>
            <th
              colSpan={inspectionColspan}
              className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerSoft}`}
            >
              {inspectionLabel}
            </th>
            <th
              rowSpan={3}
              className={`sticky top-0 z-30 border-b border-r px-2 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[90px] ${MONITORING_THEME.headerSoft}`}
            >
              Mode of
              <br />
              Issuance
            </th>
            {groups.map((g) => (
              <th
                key={g.label}
                colSpan={g.cols.length}
                className={`border-b border-r border-grid px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider ${MONITORING_THEME.headerSoft}`}
              >
                {g.label}
              </th>
            ))}
            <th
              rowSpan={3}
              className={`sticky top-0 z-30 border-b border-r px-3 py-1.5 text-center align-middle text-[11px] font-bold uppercase tracking-wider min-w-[70px] ${MONITORING_THEME.headerPrimary}`}
            >
              Total
            </th>
          </tr>
          <tr>
            {inspectionCols.map((col) => {
              const isTarget = col.target != null;
              return (
                <th
                  key={col.api}
                  rowSpan={isTarget ? 1 : 2}
                  colSpan={isTarget ? (targetBreakdown ? 5 : 2) : 1}
                  className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[72px] ${MONITORING_THEME.headerSofter}`}
                >
                  {col.label}
                </th>
              );
            })}
            {issuanceCols.map((col) => (
              <th
                key={col.api}
                rowSpan={2}
                className={`border-b border-r px-1.5 py-1 text-center align-middle text-[10px] font-semibold uppercase min-w-[72px] ${MONITORING_THEME.headerSofter}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
          <tr>
            {inspectionCols
              .filter((col) => col.target)
              .flatMap((col) => {
                const base = `${col.api}__`;
                if (targetBreakdown) {
                  return [
                    <th
                      key={`${base}target`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                    >
                      Target
                    </th>,
                    <th
                      key={`${base}accomplished`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                    >
                      <span className="block leading-[1.1]">Accomplished</span>
                    </th>,
                    <th
                      key={`${base}variance`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                    >
                      Variance
                    </th>,
                    <th
                      key={`${base}positive`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                    >
                      <span className="block leading-[1.1]">Positive</span>
                      <span className="block leading-[1.1]">Listing</span>
                    </th>,
                    <th
                      key={`${base}pct`}
                      className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                    >
                      %
                    </th>,
                  ];
                }
                return [
                  <th
                    key={`${base}target`}
                    className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                  >
                    Target
                  </th>,
                  <th
                    key={`${base}accomplished`}
                    className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-semibold uppercase min-w-[72px] w-[72px] ${MONITORING_THEME.headerSofter}`}
                  >
                    <span className="block leading-[1.1]">accomplished</span>
                  </th>,
                ];
              })}
          </tr>
        </thead>
        <tbody>
          {days.map((day, dayIndex) => {
            const zebra = dayIndex % 2 === 0 ? MONITORING_THEME.rowEven : MONITORING_THEME.rowOdd;
            const total = rowTotal(day);

            return (
              <React.Fragment key={day.key}>
                <tr className={zebra}>
                  <td
                    rowSpan={2}
                    className={`sticky left-0 z-20 border-b border-r px-3 py-1.5 align-middle text-[11px] font-semibold ${zebra}`}
                  >
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span
                        className={
                          total > 0 ? "text-primary-700 dark:text-primary-300 font-semibold" : ""
                        }
                      >
                        {day.label}
                      </span>
                    </div>
                  </td>

                  {inspectionCols.flatMap((col) => {
                    const cells: React.ReactNode[] = [];
                    if (col.target) {
                      const target = num(day.inspection[col.target]);
                      const accomplished = num(day.inspection[col.api]);
                      cells.push(
                        <td
                          key={`${col.api}__target`}
                          rowSpan={2}
                          className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums text-muted-foreground"
                        >
                          {target.toLocaleString()}
                        </td>,
                        <td
                          key={`${col.api}__accomplished`}
                          rowSpan={2}
                          className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums"
                        >
                          {accomplished.toLocaleString()}
                        </td>,
                      );
                      if (targetBreakdown) {
                        const variance = Math.max(target - accomplished, 0);
                        const positive = Math.max(accomplished - target, 0);
                        const { text: pctText, className: pctClass } = getInspectionPct(
                          accomplished,
                          target,
                        );
                        cells.push(
                          <td
                            key={`${col.api}__variance`}
                            rowSpan={2}
                            className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums"
                          >
                            {variance.toLocaleString()}
                          </td>,
                          <td
                            key={`${col.api}__positive`}
                            rowSpan={2}
                            className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums"
                          >
                            {positive.toLocaleString()}
                          </td>,
                          <td
                            key={`${col.api}__pct`}
                            rowSpan={2}
                            className={`min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums ${pctClass}`}
                          >
                            {pctText}
                          </td>,
                        );
                      }
                    } else {
                      cells.push(
                        <td
                          key={col.api}
                          rowSpan={2}
                          className="min-w-[72px] w-[72px] border-b border-r px-1.5 py-1.5 text-center align-middle tabular-nums"
                        >
                          {num(day.inspection[col.api]).toLocaleString()}
                        </td>,
                      );
                    }
                    return cells;
                  })}

                  <td
                    className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}
                  >
                    MANUAL
                  </td>
                  {issuanceCells(day, "manual")}

                  <td
                    rowSpan={2}
                    className="border-b border-r px-3 py-1.5 text-center align-middle font-semibold tabular-nums"
                  >
                    {total.toLocaleString()}
                  </td>
                </tr>

                <tr className={zebra}>
                  <td
                    className={`border-b border-r px-3 py-1.5 text-center text-[11px] font-bold uppercase ${MONITORING_THEME.headerSoft}`}
                  >
                    FSIS
                  </td>
                  {issuanceCells(day, "fsis")}
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
            {inspectionCols.flatMap((col) => {
              const cells: React.ReactNode[] = [];
              if (col.target) {
                const targetField = col.target;
                const totalTarget = days.reduce(
                  (sum, d) => sum + num(d.inspection[targetField]),
                  0,
                );
                const totalAccomplished = days.reduce(
                  (sum, d) => sum + num(d.inspection[col.api]),
                  0,
                );
                const totalVariance = days.reduce(
                  (sum, d) =>
                    sum + Math.max(num(d.inspection[targetField]) - num(d.inspection[col.api]), 0),
                  0,
                );
                const totalPositive = days.reduce(
                  (sum, d) =>
                    sum + Math.max(num(d.inspection[col.api]) - num(d.inspection[targetField]), 0),
                  0,
                );
                const { text: totalPctText, className: totalPctClass } = getInspectionPct(
                  totalAccomplished,
                  totalTarget,
                );
                cells.push(
                  <td
                    key={`${col.api}__target`}
                    className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums text-muted-foreground"
                  >
                    {totalTarget.toLocaleString()}
                  </td>,
                  <td
                    key={`${col.api}__accomplished`}
                    className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                  >
                    {totalAccomplished.toLocaleString()}
                  </td>,
                  ...(targetBreakdown
                    ? [
                        <td
                          key={`${col.api}__variance`}
                          className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                        >
                          {totalVariance.toLocaleString()}
                        </td>,
                        <td
                          key={`${col.api}__positive`}
                          className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                        >
                          {totalPositive.toLocaleString()}
                        </td>,
                        <td
                          key={`${col.api}__pct`}
                          className={`min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums ${totalPctClass}`}
                        >
                          {totalPctText}
                        </td>,
                      ]
                    : []),
                );
              } else {
                cells.push(
                  <td
                    key={col.api}
                    className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
                  >
                    {days.reduce((sum, d) => sum + num(d.inspection[col.api]), 0).toLocaleString()}
                  </td>,
                );
              }
              return cells;
            })}
            <td className="border-r border-t-2 border-grid-strong total-row px-2 py-2" />
            {issuanceCols.map((col) => (
              <td
                key={col.api}
                className="min-w-[72px] w-[72px] border-r border-t-2 border-grid-strong total-row px-1.5 py-2 text-center text-[11px] font-bold tabular-nums"
              >
                {days
                  .reduce((sum, d) => sum + num(d.manual[col.api]) + num(d.fsis[col.api]), 0)
                  .toLocaleString()}
              </td>
            ))}
            <td className="border-r border-t-2 border-grid-strong total-row-strong px-3 py-2 text-center text-[11px] font-bold tabular-nums">
              {days.reduce((sum, d) => sum + rowTotal(d), 0).toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Presentational helpers                                                     */
/* -------------------------------------------------------------------------- */

function SectionTitle({
  title,
  subtitle,
  icon,
  expanded,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;

  return (
    <div
      className={
        onToggle
          ? "flex items-center justify-between gap-3 cursor-pointer select-none"
          : "flex items-center justify-between gap-3"
      }
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      aria-expanded={onToggle ? expanded : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        {onToggle && (
          <ToggleIcon className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Route + Modal exports                                                     */
/* -------------------------------------------------------------------------- */

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
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
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
