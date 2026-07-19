import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Download, LayoutGrid, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import ResetFiltersButton from "@/components/reset-filters-button";
import { unwrap } from "@/lib/api-envelope";
import { inventoryAPI } from "@/services/inventoryAPI";
import { CATEGORY_FIELDS, MONTH_NAMES, bucketScalar, sumMonths } from "@/lib/inventoryHelpers";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  InventoryCategory,
  MatrixProvinceGroup,
  MatrixStationRow,
} from "@/types/inventoryType";
import { exportComplianceMatrix } from "./components/matrixExport";

const STYLE = {
  stationHead: "bg-blue-700 text-white dark:bg-blue-800",
  quarter: "bg-emerald-800 text-white dark:bg-emerald-900",
  month: "bg-emerald-600 text-white dark:bg-emerald-700",
  cat: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
  semester: "bg-orange-500 text-white dark:bg-orange-600",
  annual: "bg-blue-900 text-white dark:bg-blue-950",
  provTotalRow: "bg-yellow-100 text-yellow-950 font-bold dark:bg-yellow-900/40 dark:text-yellow-50",
  provHeaderRow: "bg-slate-200 text-slate-900 font-bold dark:bg-slate-800 dark:text-slate-100",
};

const QUARTERS = [
  { label: "Quarter 1", months: [1, 2, 3] },
  { label: "Quarter 2", months: [4, 5, 6] },
  { label: "Quarter 3", months: [7, 8, 9] },
  { label: "Quarter 4", months: [10, 11, 12] },
];

export interface MatrixInitialFilters {
  year?: number;
  stationno?: string;
  stationName?: string;
  provinceno?: string;
  provinceName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters?: MatrixInitialFilters;
  readOnly?: boolean;
}

export default function InventoryMatrix({
  open,
  onOpenChange,
  initialFilters,
  readOnly = false,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const YEARS = React.useMemo(buildYears, []);
  const category: InventoryCategory = "OVERALL";

  const [year, setYear] = React.useState<number>(initialFilters?.year ?? currentYear);
  const [provinceno, setProvinceno] = React.useState<string>(initialFilters?.provinceno ?? "");
  const [provincename, setProvincename] = React.useState<string>(
    initialFilters?.provinceName ?? "ALL",
  );
  const [stationno, setStationno] = React.useState<string>(initialFilters?.stationno ?? "");
  const [stationname, setStationname] = React.useState<string>(
    initialFilters?.stationName ?? "ALL",
  );

  React.useEffect(() => {
    if (!open) return;
    setYear(initialFilters?.year ?? currentYear);
    setProvinceno(initialFilters?.provinceno ?? "");
    setProvincename(initialFilters?.provinceName ?? "ALL");
    setStationno(initialFilters?.stationno ?? "");
    setStationname(initialFilters?.stationName ?? "ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    initialFilters?.year,
    initialFilters?.provinceno,
    initialFilters?.stationno,
  ]);

  const [groups, setGroups] = React.useState<MatrixProvinceGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const fields = CATEGORY_FIELDS[category];
  const fieldKeys = fields.map((f) => String(f.key));
  const catSpan = fields.length;

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await inventoryAPI.getInventoryMatrix(
        {
          year,
          provinceno: provinceno || undefined,
          stationno: stationno || undefined,
          searchkey: "",
        },
        category,
      );
      const { ok, data, error } = unwrap<MatrixProvinceGroup[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load matrix.");
      setGroups(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, year, provinceno, stationno]);

  const handleExport = async () => {
    if (groups.length === 0) {
      toast.info("No data available to export.");
      return;
    }
    setExporting(true);
    try {
      await exportComplianceMatrix({
        year,
        groups: groups.map((g) => ({
          province: g.province,
          stations: g.stations.map((s) => ({
            stationno: s.stationno,
            stationCode: s.stationcode,
            stationName: s.stationname,
            cityName: "",
            months: s.months,
          })),
        })),
        fields: fields.map((f) => ({ key: String(f.key), label: f.label })),
        signatory: {
          rank: (user as unknown as { rankname?: string })?.rankname ?? user?.rankcode ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: (user as unknown as { designation?: string })?.designation ?? "",
        },
      });
      toast.success("Compliance Matrix exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Compliance Matrix.");
    } finally {
      setExporting(false);
    }
  };

  const handleProvinceSelect = (no: string, name: string) => {
    setProvinceno(no === "all" || !no ? "" : no);
    setProvincename(name || "ALL");
    setStationno("");
    setStationname("ALL");
  };

  const handleStationSelect = (
    no: string,
    name: string,
    _province?: string,
    station?: SearchStationModel,
  ) => {
    setStationno(no === "all" || !no ? "" : no);
    setStationname(name || "ALL");
    if (station?.provinceno && !provinceno) {
      setProvinceno(station.provinceno);
      setProvincename(station.provincename || "");
    }
  };

  const totalCols = 1 + 12 * catSpan + 4 * catSpan + catSpan + catSpan + catSpan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Fire Safety Compliance Matrix
                {readOnly && (
                  <span className="ml-2 rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    View only
                  </span>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">Stations grouped by Province — {year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || loading}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-2">
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Filters — mirrors the ledger filter bar */}
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))} disabled={readOnly}>
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
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              {readOnly ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {provincename || "ALL"}
                </div>
              ) : (
                <LocationSearchSelect
                  value={provinceno}
                  valueName={provincename}
                  locationtype="PROVINCE"
                  parentcode={MIMAROPA_REGION_CODE}
                  onChange={handleProvinceSelect}
                  placeholder="All provinces"
                  showAllOption
                  hideCode
                  className="w-full"
                />
              )}
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Station
              </div>
              {readOnly ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {stationname || "ALL"}
                </div>
              ) : (
                <StationSearchSelect
                  value={stationno}
                  valueName={stationname}
                  provinceno={provinceno || undefined}
                  onChange={handleStationSelect}
                  placeholder="All stations"
                  showAllOption
                />
              )}
            </div>
            {!readOnly && (
              <div className="flex items-end justify-end md:col-span-2 lg:col-span-1">
                <ResetFiltersButton
                  onReset={() => {
                    setYear(initialFilters?.year ?? currentYear);
                    setProvinceno(initialFilters?.provinceno ?? "");
                    setProvincename(initialFilters?.provinceName ?? "ALL");
                    setStationno(initialFilters?.stationno ?? "");
                    setStationname(initialFilters?.stationName ?? "ALL");
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
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
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
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
                    No inventory data for {year}.
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
                    year={Number(year)}
                    category={category}
                    onDrill={
                      readOnly
                        ? () => {}
                        : (stationno, y, m) => {
                            onOpenChange(false);
                            navigate(`/monitoring/view/${stationno}/${y}/${m}`);
                          }
                    }
                  />
                ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}



function MatrixHeader({
  fields,
  catSpan,
}: {
  fields: { key: string; label: string }[] | { key: string | number; label: string }[];
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
                className={`border-b px-1.5 py-1 text-right text-[10px] font-bold uppercase ${
                  i === catSpan - 1 && monthIdx === 2
                    ? "border-r-2 border-r-emerald-800/60"
                    : "border-r"
                } ${STYLE.cat}`}
              >
                {f.label}
              </th>
            )),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          fields.map((f, i) => (
            <th
              key={`c-final-${grpIdx}-${String(f.key)}`}
              className={`border-b px-1.5 py-1 text-right text-[10px] font-bold uppercase ${
                i === catSpan - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${grpIdx <= 3 ? STYLE.quarter : grpIdx === 6 ? STYLE.annual : STYLE.semester}`}
            >
              {f.label}
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

function ProvinceBlock({
  group,
  totalCols,
  fieldKeys,
  year,
  category,
  onDrill,
}: {
  group: MatrixProvinceGroup;
  totalCols: number;
  fieldKeys: string[];
  year: number;
  category: InventoryCategory;
  onDrill: (stationno: string, year: number, month: number) => void;
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
          className="border-b border-t-2 border-t-slate-400/60 bg-slate-200"
        />
      </tr>
      {group.stations.map((s, idx) => (
        <StationDataRow
          key={s.stationno}
          station={s}
          zebra={idx % 2 === 1}
          fieldKeys={fieldKeys}
          year={year}
          category={category}
          onDrill={onDrill}
        />
      ))}
      <ProvincialTotalRow
        months={group.provincialTotal}
        province={group.province}
        fieldKeys={fieldKeys}
      />
    </>
  );
}

function computeAgg(months: Record<number, Record<string, number>>, fieldKeys: string[]) {
  return {
    q1: sumMonths(months, [1, 2, 3], fieldKeys),
    q2: sumMonths(months, [4, 5, 6], fieldKeys),
    q3: sumMonths(months, [7, 8, 9], fieldKeys),
    q4: sumMonths(months, [10, 11, 12], fieldKeys),
    sem1: sumMonths(months, [1, 2, 3, 4, 5, 6], fieldKeys),
    sem2: sumMonths(months, [7, 8, 9, 10, 11, 12], fieldKeys),
    annual: sumMonths(months, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], fieldKeys),
  };
}

function DrillCell({
  value,
  onClick,
  bold,
  boundary,
  rowClass,
}: {
  value: number;
  onClick?: () => void;
  bold?: boolean;
  boundary?: boolean;
  rowClass?: string;
}) {
  const base = `border-b px-2 py-1.5 text-right tabular-nums ${
    boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
  } ${bold ? "font-bold" : ""} ${value === 0 && !bold ? "text-muted-foreground/60" : ""} ${rowClass ?? ""}`;
  if (onClick) {
    return (
      <td
        className={`${base} cursor-pointer hover:bg-primary/10`}
        onClick={onClick}
        title="Open monthly details"
      >
        {value.toLocaleString()}
      </td>
    );
  }
  return <td className={base}>{value.toLocaleString()}</td>;
}

function StationDataRow({
  station,
  zebra,
  fieldKeys,
  year,
  category,
  onDrill,
}: {
  station: MatrixStationRow;
  zebra: boolean;
  fieldKeys: string[];
  year: number;
  category: InventoryCategory;
  onDrill: (stationno: string, year: number, month: number) => void;
}) {
  void category;
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
          <DrillCell
            key={`${station.stationno}-${mv}-${k}`}
            value={bucket?.[k] ?? 0}
            boundary={i === fieldKeys.length - 1 && quarterEnd}
            onClick={() => onDrill(station.stationno, year, mv)}
          />
        ));
      })}
      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        fieldKeys.map((k, i) => (
          <DrillCell
            key={`${station.stationno}-${grp}-${k}`}
            value={agg[grp][k] ?? 0}
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
  months: Record<number, Record<string, number>>;
  province: string;
  fieldKeys: string[];
}) {
  const agg = computeAgg(months, fieldKeys);
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
          <DrillCell
            key={`pt-${province}-${mv}-${k}`}
            value={b[k] ?? 0}
            bold
            boundary={i === fieldKeys.length - 1 && quarterEnd}
            rowClass={STYLE.provTotalRow}
          />
        ));
      })}
      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        fieldKeys.map((k, i) => (
          <DrillCell
            key={`pt-${province}-${grp}-${k}`}
            value={agg[grp][k] ?? 0}
            bold
            boundary={i === fieldKeys.length - 1}
            rowClass={STYLE.provTotalRow}
          />
        )),
      )}
    </tr>
  );
}

// keep imports referenced when strict TS is on
void bucketScalar;
