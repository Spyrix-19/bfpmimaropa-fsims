import * as React from "react";
import { Banner } from "@/components/shared";
import { Card } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileBarChart2, Loader2, LayoutGrid, AlertTriangle } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { toast } from "@/lib/toast";

import AvatarWithFallback from "@/components/avatar-with-fallback";
import SearchKey from "@/components/search-key";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MONTHS, REGION_NAME } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { unwrap } from "@/lib/api-envelope";
import { complianceAPI } from "@/services/complianceAPI";
import FilterField from "@/components/filter-field";
import {
  CATEGORY_FIELDS,
  MONTH_NAMES,
  sumReportMonths,
  buildReportMatrix,
  type ReportMatrixProvinceGroup,
  type TargetActualCell,
} from "@/lib/complianceHelpers";
import type {
  ComplianceCategoryKey,
  ComplianceDailyCounts,
  FSISComplianceModel,
} from "@/types/complianceType";
import { MATRIX_TONE } from "@/lib/theme";

/**
 * Flattens the FSISCompliance Ledger response (station wrapper +
 * `compliancelist` + nested `issuancelist`) into the UI-key daily rows the
 * matrix builder consumes. Compliance is the only data source here.
 */
function toDailyCounts(stations: FSISComplianceModel[]): ComplianceDailyCounts[] {
  const out: ComplianceDailyCounts[] = [];
  for (const st of stations) {
    const list = Array.isArray(st?.compliancelist) ? st.compliancelist : [];
    for (const rec of list) {
      const flat = {
        fsisno: String((rec as { fsisno?: string }).fsisno ?? ""),
        inspectduringcount:
          Number((rec as { inspectduringcount?: number }).inspectduringcount ?? 0) || 0,
        inspectaftercount:
          Number((rec as { inspectaftercount?: number }).inspectaftercount ?? 0) || 0,
        inspectbplocount: Number((rec as { inspectbplocount?: number }).inspectbplocount ?? 0) || 0,
        inspectgovcount: Number((rec as { inspectgovcount?: number }).inspectgovcount ?? 0) || 0,
        inspectpezacount: Number((rec as { inspectpezacount?: number }).inspectpezacount ?? 0) || 0,
        inspecttiezacount:
          Number((rec as { inspecttiezacount?: number }).inspecttiezacount ?? 0) || 0,
        dailytargetbplo: Number((rec as { dailytargetbplo?: number }).dailytargetbplo ?? 0) || 0,
        dailytargetgov: Number((rec as { dailytargetgov?: number }).dailytargetgov ?? 0) || 0,
        dailytargetpeza: Number((rec as { dailytargetpeza?: number }).dailytargetpeza ?? 0) || 0,
        dailytargettieza: Number((rec as { dailytargettieza?: number }).dailytargettieza ?? 0) || 0,
        remarks: String((rec as { remarks?: string }).remarks ?? ""),
        dateinspected: String((rec as { dateinspected?: string }).dateinspected ?? ""),
        fsecbuildingcount:
          Number((rec as { fsecbuildingcount?: number }).fsecbuildingcount ?? 0) || 0,
        fsecgovcount: Number((rec as { fsecgovcount?: number }).fsecgovcount ?? 0) || 0,
        fsecpezacount: Number((rec as { fsecpezacount?: number }).fsecpezacount ?? 0) || 0,
        fsectiezacount: Number((rec as { fsectiezacount?: number }).fsectiezacount ?? 0) || 0,
        fsicoccupancycount:
          Number((rec as { fsicoccupancycount?: number }).fsicoccupancycount ?? 0) || 0,
        fsicbplonewcount: Number((rec as { fsicbplonewcount?: number }).fsicbplonewcount ?? 0) || 0,
        fsicbplorenewcount:
          Number((rec as { fsicbplorenewcount?: number }).fsicbplorenewcount ?? 0) || 0,
        fsicgovcount: Number((rec as { fsicgovcount?: number }).fsicgovcount ?? 0) || 0,
        fsicpezacount: Number((rec as { fsicpezacount?: number }).fsicpezacount ?? 0) || 0,
        fsictiezacount: Number((rec as { fsictiezacount?: number }).fsictiezacount ?? 0) || 0,
        nodcount: Number((rec as { nodcount?: number }).nodcount ?? 0) || 0,
        ntccount: Number((rec as { ntccount?: number }).ntccount ?? 0) || 0,
        ntcvcount: Number((rec as { ntcvcount?: number }).ntcvcount ?? 0) || 0,
        abatementcount: Number((rec as { abatementcount?: number }).abatementcount ?? 0) || 0,
        closurecount: Number((rec as { closurecount?: number }).closurecount ?? 0) || 0,
      } as unknown as Record<string, unknown>;
      const num = (k: string) => Number(flat[k] ?? 0) || 0;
      const iso = String(flat.dateinspected ?? "").slice(0, 10);
      if (!iso || iso.startsWith("1900")) continue;
      out.push({
        fsisno: String(flat.fsisno ?? ""),
        stationno: st.stationno,
        stationcode: st.stationcode ?? "",
        stationname: st.stationname ?? "",
        cityno: "",
        cityname: "",
        provinceno: st.provinceno ?? "",
        provincename: st.provincename ?? "",
        dateinspected: iso,
        insp_during: num("inspectduringcount"),
        insp_after: num("inspectaftercount"),
        insp_bplo: num("inspectbplocount"),
        insp_gov: num("inspectgovcount"),
        insp_peza: num("inspectpezacount"),
        insp_tieza: num("inspecttiezacount"),
        fsec_building: num("fsecbuildingcount"),
        fsec_gov: num("fsecgovcount"),
        fsec_peza: num("fsecpezacount"),
        fsec_tieza: num("fsectiezacount"),
        fsic_occupancy: num("fsicoccupancycount"),
        fsic_bplo_new: num("fsicbplonewcount"),
        fsic_bplo_renewal: num("fsicbplorenewcount"),
        fsic_gov: num("fsicgovcount"),
        fsic_peza: num("fsicpezacount"),
        fsic_tieza: num("fsictiezacount"),
        not_nod: num("nodcount"),
        not_ntc: num("ntccount"),
        not_ntcv: num("ntcvcount"),
        not_abatement: num("abatementcount"),
        not_closure: num("closurecount"),
        remarks: String(flat.remarks ?? ""),
        encodedby: "",
        encodedbyname: "",
        lastupdated: iso,
        deletedat: null,
      });
    }
  }
  return out;
}

const CAT_OPTIONS: { value: ComplianceCategoryKey; label: string }[] = [
  { value: "INSPECTION", label: "Inspection" },
  { value: "FSEC", label: "FSEC" },
  { value: "FSIC", label: "FSIC" },
  { value: "NOTICES", label: "Issued Notices" },
  { value: "OVERALL", label: "Overall Summary" },
];

// Palette mirrors TargetMatrix so this report is visually indistinguishable
// from the reference module.
const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  quarter: MATRIX_TONE.quarter,
  month: MATRIX_TONE.month,
  cat: MATRIX_TONE.cat,
  semester: MATRIX_TONE.semester,
  annual: MATRIX_TONE.annual,
  provTotalRow: MATRIX_TONE.provTotalRow,
  provHeaderRow: MATRIX_TONE.provHeaderRow,
};

const QUARTERS = [
  { label: "Quarter 1", months: [1, 2, 3] },
  { label: "Quarter 2", months: [4, 5, 6] },
  { label: "Quarter 3", months: [7, 8, 9] },
  { label: "Quarter 4", months: [10, 11, 12] },
];

export default function Reports() {
  const { user, systemAccess, isPersonnel } = useAuth();
  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const restricted = !user || isPersonnel();
  const currentYear = new Date().getFullYear();
  const YEARS = React.useMemo(buildYears, []);

  const [year, setYear] = React.useState<string>(String(currentYear));
  const [province, setProvince] = React.useState<string>(
    scope.provinceLocked ? scope.provincename || "ALL" : "ALL",
  );
  const [category, setCategory] = React.useState<ComplianceCategoryKey>("INSPECTION");
  const [search, setSearch] = React.useState("");
  const [groups, setGroups] = React.useState<ReportMatrixProvinceGroup[]>([]);
  const [provinceOptions, setProvinceOptions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Feature flag: put Matrix Reports on hold and show the existing "on hold"
  // notice (same wording used by Forgot Password). Toggle to `false` to
  // re-enable the report UI.
  const REPORTS_ON_HOLD = true;

  const fields = CATEGORY_FIELDS[category];
  const fieldKeys = fields.map((f) => String(f.key));
  const catSpan = fields.length;

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await complianceAPI.getLedger(
        {
          parameters: {
            searchkey: search,
            reportyear: Number(year),
            interval: 1,
            targetdate: `${year}-01-01T00:00:00`,
            dateinspected: `${year}-01-01T00:00:00`,
            reportmonth: Array.from({ length: 12 }, (_, i) => i + 1),
            provinces: [],
          },
          pagenumber: 1,
          pagesize: 10000,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data, error } = unwrap<FSISComplianceModel[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load matrix report.");
      const stations = Array.isArray(data) ? data : [];
      const list = buildReportMatrix(toDailyCounts(stations), category);
      setProvinceOptions(Array.from(new Set(list.map((g) => g.province))).sort());
      const effectiveProvince = scope.provinceLocked ? scope.provincename : province;
      const filtered =
        effectiveProvince === "ALL" ? list : list.filter((g) => g.province === effectiveProvince);
      setGroups(filtered);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, category, search, province, scope.provinceLocked, scope.provincename, user]);

  // If reports are on hold, show the existing 'on hold' notice to everyone
  // regardless of role.
  const [holdOpen, setHoldOpen] = React.useState(REPORTS_ON_HOLD);

  if (REPORTS_ON_HOLD) {
    return (
      <ConfirmDialog
        open={holdOpen}
        onOpenChange={setHoldOpen}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-danger-soft"
        contentIconColorClass="text-destructive"
        title="Report generation temporarily unavailable"
        description="Report generation is currently on hold. Please contact your system administrator for assistance. This feature will be available soon."
        confirmLabel="OK"
        cancelClassName="hidden"
        onConfirm={() => {}}
      />
    );
  }

  if (restricted) {
    return (
      <Banner
        icon={FileBarChart2}
        title="Reports are restricted"
        description="Sign in as an administrator to generate reports."
      />
    );
  }

  const totalCols = 1 + 12 * catSpan + 4 * catSpan + catSpan + catSpan + catSpan;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FileBarChart2 className="h-5 w-5 text-primary" />
            Matrix Report
          </h1>
          <p className="text-xs text-muted-foreground">
            Target vs Actual across every reporting period — {REGION_NAME}.
          </p>
        </div>
      </div>

      {/* Filters — mirror TargetReference filter card */}
      <Card className="grid gap-3 border-border/60 p-4 md:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Search">
          <SearchKey
            value={search}
            onChange={setSearch}
            placeholder="Search station, city, province…"
            widthClass="w-full"
          />
        </FilterField>
        <FilterField label="Year">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
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
              if (scope.provinceLocked) return;
              setProvince(v);
            }}
            disabled={scope.provinceLocked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All provinces</SelectItem>
              {provinceOptions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Category">
          <Select value={category} onValueChange={(v) => setCategory(v as ComplianceCategoryKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAT_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </Card>

      <Card className="overflow-hidden border-border/60 p-0 shadow-soft">
        <div className="flex items-center gap-2 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-2 text-xs uppercase tracking-[0.2em] text-primary">
          <LayoutGrid className="h-3.5 w-3.5" />
          <span className="font-bold">Target | Actual Matrix — {year}</span>
        </div>

        <div className="relative max-h-[70vh] overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <MatrixHeader fields={fields} catSpan={catSpan} />
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="border-b bg-card px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading matrix report…
                    </span>
                  </td>
                </tr>
              )}
              {!loading && groups.length === 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="border-b bg-card px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No data for {year}.
                  </td>
                </tr>
              )}
              {!loading &&
                groups.map((g) => (
                  <ProvinceBlock
                    key={g.province}
                    group={g}
                    totalCols={totalCols}
                    fieldKeys={fieldKeys}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============================== Header ============================== */

function MatrixHeader({
  fields,
  catSpan,
}: {
  fields: { key: string | number; label: string }[];
  catSpan: number;
}) {
  return (
    <thead className="sticky top-0 z-30">
      <tr>
        <th
          rowSpan={3}
          className={`sticky left-0 top-0 z-40 min-w-[240px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Station
        </th>
        {QUARTERS.map((q) => (
          <th
            key={q.label}
            colSpan={3 * catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
                Quarter
              </span>
              <span className="text-[10px] font-semibold leading-none">{q.label}</span>
            </div>
          </th>
        ))}
        {QUARTERS.map((q) => (
          <th
            key={`t-${q.label}`}
            rowSpan={2}
            colSpan={catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
                Quarter
              </span>
              <span className="text-[10px] font-semibold leading-none">{q.label} Total</span>
            </div>
          </th>
        ))}
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
              Semester
            </span>
            <span className="text-[10px] font-semibold leading-none">1st</span>
          </div>
        </th>
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
              Semester
            </span>
            <span className="text-[10px] font-semibold leading-none">2nd</span>
          </div>
        </th>
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.annual}`}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
              Annual
            </span>
            <span className="text-[10px] font-semibold leading-none">Total</span>
          </div>
        </th>
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.map((mv, i) => (
            <th
              key={`m-${mv}`}
              colSpan={catSpan}
              className={`border-b px-2 py-1.5 text-center font-semibold uppercase ${
                i === 2 ? "border-r-2 border-r-white/30" : "border-r"
              } ${STYLE.month}`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-semibold uppercase tracking-[0.2em] opacity-80">
                  Month
                </span>
                <span className="text-[10px] font-semibold leading-none">
                  {MONTH_NAMES[mv - 1]}
                </span>
              </div>
            </th>
          )),
        )}
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.flatMap((mv, monthIdx) =>
            fields.map((f, i) => (
              <th
                key={`c-${mv}-${String(f.key)}`}
                className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                  i === catSpan - 1 && monthIdx === 2
                    ? "border-r-2 border-r-emerald-800/60"
                    : "border-r"
                } ${STYLE.cat}`}
              >
                {f.label}
                <div className="mt-0.5 flex justify-center gap-1 text-[8px] font-semibold tracking-wider text-muted-foreground">
                  <span>TGT</span>
                  <span>|</span>
                  <span>ACT</span>
                </div>
              </th>
            )),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          fields.map((f, i) => (
            <th
              key={`c-final-${grpIdx}-${String(f.key)}`}
              className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                i === catSpan - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${grpIdx <= 3 ? STYLE.quarter : grpIdx === 6 ? STYLE.annual : STYLE.semester}`}
            >
              {f.label}
              <div className="mt-0.5 flex justify-center gap-1 text-[8px] font-semibold tracking-wider opacity-80">
                <span>TGT</span>
                <span>|</span>
                <span>ACT</span>
              </div>
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

/* ============================== Body ============================== */

function ProvinceBlock({
  group,
  totalCols,
  fieldKeys,
}: {
  group: ReportMatrixProvinceGroup;
  totalCols: number;
  fieldKeys: string[];
}) {
  return (
    <>
      <tr>
        <td
          className={`sticky left-0 z-10 border-b border-t-2 border-t-slate-400/60 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] ${STYLE.provHeaderRow}`}
        >
          {group.province}
        </td>
        <td
          colSpan={totalCols - 1}
          aria-hidden="true"
          className="border-b border-t-2 border-grid-strong group-row"
        />
      </tr>
      {group.stations.map((s, idx) => (
        <StationDataRow key={s.stationno} station={s} zebra={idx % 2 === 1} fieldKeys={fieldKeys} />
      ))}
      <ProvincialTotalRow
        months={group.provincialTotal}
        province={group.province}
        fieldKeys={fieldKeys}
      />
    </>
  );
}

function computeAgg(months: Record<number, Record<string, TargetActualCell>>, fieldKeys: string[]) {
  return {
    q1: sumReportMonths(months, [1, 2, 3], fieldKeys),
    q2: sumReportMonths(months, [4, 5, 6], fieldKeys),
    q3: sumReportMonths(months, [7, 8, 9], fieldKeys),
    q4: sumReportMonths(months, [10, 11, 12], fieldKeys),
    sem1: sumReportMonths(months, [1, 2, 3, 4, 5, 6], fieldKeys),
    sem2: sumReportMonths(months, [7, 8, 9, 10, 11, 12], fieldKeys),
    annual: sumReportMonths(months, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fieldKeys),
  };
}

function TgtActCell({
  cell,
  bold,
  boundary,
  rowClass,
}: {
  cell: TargetActualCell;
  bold?: boolean;
  boundary?: boolean;
  rowClass?: string;
}) {
  const zero = cell.target === 0 && cell.actual === 0;
  const under = cell.target > 0 && cell.actual < cell.target;
  const meetOrOver = cell.target > 0 && cell.actual >= cell.target;
  return (
    <td
      className={`border-b px-2 py-1.5 text-center tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${zero ? "text-muted-foreground/60" : ""} ${rowClass ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        <span className="text-foreground">{cell.target.toLocaleString()}</span>
        <span className="text-muted-foreground/60">|</span>
        <span className={meetOrOver ? "text-success" : under ? "text-destructive" : ""}>
          {cell.actual.toLocaleString()}
        </span>
      </span>
    </td>
  );
}

function StationDataRow({
  station,
  zebra,
  fieldKeys,
}: {
  station: ReportMatrixProvinceGroup["stations"][number];
  zebra: boolean;
  fieldKeys: string[];
}) {
  const agg = computeAgg(station.months, fieldKeys);
  const rowBg = zebra ? "bg-muted" : "bg-card";
  return (
    <tr className={rowBg}>
      <td className={`sticky left-0 z-10 border-b border-r px-3 py-2 ${rowBg}`}>
        <div className="flex items-center gap-2">
          <AvatarWithFallback
            entity={{ name: station.stationname }}
            name={station.stationname}
            className="h-8 w-8 shrink-0 rounded-full ring-1 ring-primary/20"
          />
          <div className="min-w-0">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              {station.stationcode}
            </span>
            <div className="truncate text-[11px] font-semibold">{station.stationname}</div>
          </div>
        </div>
      </td>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
        const bucket = station.months[mv];
        const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
        return fieldKeys.map((k, i) => (
          <TgtActCell
            key={`${station.stationno}-${mv}-${k}`}
            cell={bucket?.[k] ?? { target: 0, actual: 0 }}
            boundary={i === fieldKeys.length - 1 && quarterEnd}
          />
        ));
      })}
      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        fieldKeys.map((k, i) => (
          <TgtActCell
            key={`${station.stationno}-${grp}-${k}`}
            cell={agg[grp][k] ?? { target: 0, actual: 0 }}
            bold
            boundary={i === fieldKeys.length - 1}
          />
        )),
      )}
    </tr>
  );
}

function ProvincialTotalRow({
  months,
  province,
  fieldKeys,
}: {
  months: Record<number, Record<string, TargetActualCell>>;
  province: string;
  fieldKeys: string[];
}) {
  const agg = computeAgg(months, fieldKeys);
  void MONTHS; // keep constant referenced for potential label reuse
  return (
    <tr>
      <td
        className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-[11px] uppercase tracking-wider ${STYLE.provTotalRow}`}
      >
        Provincial Total — {province}
      </td>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
        const b = months[mv] ?? {};
        const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
        return fieldKeys.map((k, i) => (
          <TgtActCell
            key={`pt-${province}-${mv}-${k}`}
            cell={b[k] ?? { target: 0, actual: 0 }}
            bold
            boundary={i === fieldKeys.length - 1 && quarterEnd}
            rowClass={STYLE.provTotalRow}
          />
        ));
      })}
      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        fieldKeys.map((k, i) => (
          <TgtActCell
            key={`pt-${province}-${grp}-${k}`}
            cell={agg[grp][k] ?? { target: 0, actual: 0 }}
            bold
            boundary={i === fieldKeys.length - 1}
            rowClass={STYLE.provTotalRow}
          />
        )),
      )}
    </tr>
  );
}
