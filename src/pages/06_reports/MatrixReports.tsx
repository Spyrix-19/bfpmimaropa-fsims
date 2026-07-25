import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileBarChart2, Loader2, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import AvatarWithFallback from "@/components/avatar-with-fallback";
import SearchKey from "@/components/search-key";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import { MONTHS, REGION_NAME } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { unwrap } from "@/lib/api-envelope";
import { inventoryAPI } from "@/services/inventoryAPI";
import {
  CATEGORY_FIELDS,
  MONTH_NAMES,
  sumReportMonths,
  type ReportMatrixProvinceGroup,
  type TargetActualCell,
} from "@/lib/inventoryHelpers";
import { INVENTORY_STATIONS } from "@/mock/inventoryMock";
import type { InventoryCategory } from "@/types/inventoryType";
import { MATRIX_TONE } from "@/lib/theme";

const PROVINCE_OPTIONS = Array.from(new Set(INVENTORY_STATIONS.map((s) => s.provincename))).sort();

const CAT_OPTIONS: { value: InventoryCategory; label: string }[] = [
  { value: "INSPECTION", label: "Inspection" },
  { value: "FSEC", label: "FSEC" },
  { value: "FSIC", label: "FSIC" },
  { value: "NOTICES", label: "Notices" },
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
  const [category, setCategory] = React.useState<InventoryCategory>("INSPECTION");
  const [search, setSearch] = React.useState("");
  const [groups, setGroups] = React.useState<ReportMatrixProvinceGroup[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fields = CATEGORY_FIELDS[category];
  const fieldKeys = fields.map((f) => String(f.key));
  const catSpan = fields.length;

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await inventoryAPI.getInventoryReportMatrix(
        { year: Number(year), searchkey: search },
        category,
      );
      const { ok, data, error } = unwrap<ReportMatrixProvinceGroup[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load matrix report.");
      const list = Array.isArray(data) ? data : [];
      const effectiveProvince = scope.provinceLocked ? scope.provincename : province;
      const filtered = effectiveProvince === "ALL" ? list : list.filter((g) => g.province === effectiveProvince);
      setGroups(filtered);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, category, search, province, scope.provinceLocked, scope.provincename, user]);

  if (restricted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <FileBarChart2 className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="text-xl font-semibold">Reports are restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in as an administrator to generate reports.
          </p>
        </Card>
      </div>
    );
  }

  const totalCols = 1 + 12 * catSpan + 4 * catSpan + catSpan + catSpan + catSpan;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <FileBarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Matrix Report</h1>
            <p className="text-sm text-muted-foreground">
              Target vs Actual across every reporting period — {REGION_NAME}.
            </p>
          </div>
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
              {PROVINCE_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Category">
          <Select value={category} onValueChange={(v) => setCategory(v as InventoryCategory)}>
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

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      {children}
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
            {q.label}
          </th>
        ))}
        {QUARTERS.map((q) => (
          <th
            key={`t-${q.label}`}
            rowSpan={2}
            colSpan={catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            {q.label} Total
          </th>
        ))}
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          1st Semester
        </th>
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          2nd Semester
        </th>
        <th
          rowSpan={2}
          colSpan={catSpan}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.annual}`}
        >
          Annual
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
              {MONTH_NAMES[mv - 1]}
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
      className={`border-b px-2 py-1.5 text-right tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${zero ? "text-muted-foreground/60" : ""} ${rowClass ?? ""}`}
    >
      <span className="inline-flex items-center gap-1">
        <span className="text-foreground">{cell.target.toLocaleString()}</span>
        <span className="text-muted-foreground/60">|</span>
        <span
          className={
            meetOrOver
              ? "text-success"
              : under
                ? "text-destructive"
                : ""
          }
        >
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
