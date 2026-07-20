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
import { MONTH_NAMES, sumMonths } from "@/lib/inventoryHelpers";
import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { EMPTY_GUID } from "@/lib/utils";
import { buildYears } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import type { SearchStationModel } from "@/types/stationTypes";
import type {
  FSISInventoryLedgerModel,
  FSISInventoryLedgerClass,
} from "@/types/targetinventoryType";
import { exportComplianceMatrix } from "./components/matrixExport";

const STYLE = {
  stationHead: "bg-blue-700 text-white dark:bg-blue-800",
  quarter: "bg-emerald-800 text-white dark:bg-emerald-900",
  month: "bg-emerald-600 text-white dark:bg-emerald-700",
  cat: "bg-slate-100 text-slate-900 dark:bg-slate-800/70 dark:text-slate-100",
  catInsp: "bg-sky-600 text-white dark:bg-sky-700",
  catFsec: "bg-emerald-600 text-white dark:bg-emerald-700",
  catFsic: "bg-amber-500 text-slate-900 dark:bg-amber-600 dark:text-slate-950",
  catNotice: "bg-rose-500 text-white dark:bg-rose-600",
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

// ---------------------------------------------------------------------------
// Compliance fields — real backend DTO keys (FSISInventoryLedgerClass), no
// aliasing. Keeps 1:1 parity with `targetinventoryAPI.getInventoryLedger`
// and `monitoringEdit.tsx` so the on-screen matrix and the exported workbook
// share exactly the same column identity as the source of truth.
// ---------------------------------------------------------------------------
type ComplianceCategory = "INSPECTION" | "FSEC" | "FSIC" | "NOTICES";

const COMPLIANCE_FIELDS: { key: keyof FSISInventoryLedgerClass; label: string; category: ComplianceCategory }[] = [
  { key: "inspectduringcount", label: "During",     category: "INSPECTION" },
  { key: "inspectaftercount",  label: "After",      category: "INSPECTION" },
  { key: "inspectbplocount",   label: "1st BPLO",   category: "INSPECTION" },
  { key: "inspectgovcount",    label: "1st GOV",    category: "INSPECTION" },
  { key: "inspectpezacount",   label: "1st PEZA",   category: "INSPECTION" },
  { key: "inspecttiezacount",  label: "1st TIEZA",  category: "INSPECTION" },
  { key: "fsecbuildingcount",  label: "Building",   category: "FSEC" },
  { key: "fsecgovcount",       label: "Gov",        category: "FSEC" },
  { key: "fsecpezacount",      label: "PEZA",       category: "FSEC" },
  { key: "fsectiezacount",     label: "TIEZA",      category: "FSEC" },
  { key: "fsicoccupancycount", label: "Occupancy",  category: "FSIC" },
  { key: "fsicbplonewcount",   label: "BPLO New",   category: "FSIC" },
  { key: "fsicbplorenewcount", label: "BPLO Renew", category: "FSIC" },
  { key: "fsicgovcount",       label: "Gov",        category: "FSIC" },
  { key: "fsicpezacount",      label: "PEZA",       category: "FSIC" },
  { key: "fsictiezacount",     label: "TIEZA",      category: "FSIC" },
  { key: "nodcount",           label: "NOD",        category: "NOTICES" },
  { key: "ntccount",           label: "NTC",        category: "NOTICES" },
  { key: "ntcvcount",          label: "NTCV",      category: "NOTICES" },
  { key: "avatementcount",     label: "Avatement",  category: "NOTICES" },
  { key: "closurecount",       label: "Closure",    category: "NOTICES" },
];

const CATEGORY_STYLE: Record<ComplianceCategory, string> = {
  INSPECTION: STYLE.catInsp,
  FSEC: STYLE.catFsec,
  FSIC: STYLE.catFsic,
  NOTICES: STYLE.catNotice,
};

/** Contiguous [start,end] index runs per category — drives category banners. */
function computeCategoryRuns() {
  const runs: { category: ComplianceCategory; start: number; end: number }[] = [];
  COMPLIANCE_FIELDS.forEach((f, i) => {
    const last = runs[runs.length - 1];
    if (last && last.category === f.category) last.end = i;
    else runs.push({ category: f.category, start: i, end: i });
  });
  return runs;
}

// ---------------------------------------------------------------------------
// Client-side aggregation of the real ledger response into the province →
// station → month → { fieldKey → number } shape the matrix + export consume.
// ---------------------------------------------------------------------------
interface StationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  cityname: string;
  logoUrl: string;
  months: Record<number, Record<string, number>>;
}
interface ProvinceGroup {
  province: string;
  provinceno: string;
  stations: StationRow[];
  provincialTotal: Record<number, Record<string, number>>;
}

function monthOf(d: string | Date): number {
  if (!d) return 0;
  const s = typeof d === "string" ? d : new Date(d).toISOString();
  const m = Number(s.slice(5, 7));
  return Number.isFinite(m) ? m : 0;
}

function buildGroupsFromLedger(rows: FSISInventoryLedgerModel[]): ProvinceGroup[] {
  const keys = COMPLIANCE_FIELDS.map((f) => f.key as string);
  const groups: ProvinceGroup[] = [];
  const byProv = new Map<string, ProvinceGroup>();
  for (const st of rows ?? []) {
    const provkey = st.provinceno || st.provincename || "";
    let g = byProv.get(provkey);
    if (!g) {
      g = {
        province: st.provincename ?? "",
        provinceno: st.provinceno ?? "",
        stations: [],
        provincialTotal: {},
      };
      byProv.set(provkey, g);
      groups.push(g);
    }
    const months: Record<number, Record<string, number>> = {};
    for (const r of st.fsisInventoryLedgerList ?? []) {
      const m = monthOf(r.dateinspected);
      if (m < 1 || m > 12) continue;
      const bucket = (months[m] ??= Object.fromEntries(keys.map((k) => [k, 0])));
      for (const k of keys) {
        bucket[k] += Number((r as unknown as Record<string, unknown>)[k] ?? 0) || 0;
      }
    }
    g.stations.push({
      stationno: st.stationno,
      stationcode: st.stationcode,
      stationname: st.stationname,
      provinceno: st.provinceno,
      province: st.provincename,
      cityname: st.cityname ?? "",
      logoUrl: st.logourl ?? "",
      months,
    });
    // Accumulate provincial totals.
    for (const mn of Object.keys(months)) {
      const m = Number(mn);
      const dst = (g.provincialTotal[m] ??= Object.fromEntries(keys.map((k) => [k, 0])));
      for (const k of keys) dst[k] += months[m][k] ?? 0;
    }
  }
  // Sort stations by code for stable display.
  groups.forEach((g) =>
    g.stations.sort((a, b) => (a.stationcode || "").localeCompare(b.stationcode || "")),
  );
  groups.sort((a, b) => (a.province || "").localeCompare(b.province || ""));
  return groups;
}

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

  const [groups, setGroups] = React.useState<ProvinceGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  // Export-only "Report Month" filter (0 = All months).
  const [exportMonth, setExportMonth] = React.useState<number>(0);

  const fields = COMPLIANCE_FIELDS;
  const fieldKeys = React.useMemo(() => fields.map((f) => String(f.key)), [fields]);
  const catSpan = fields.length;
  const categoryRuns = React.useMemo(computeCategoryRuns, []);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Real API — pull the entire year's ledger so the matrix can group by
      // province → station → month client-side using the true DTO fields.
      const resp = await targetinventoryAPI.getInventoryLedger({
        searchkey: "",
        stationno: stationno || EMPTY_GUID,
        provinceno: provinceno || EMPTY_GUID,
        reportyear: Number(year),
        pagenumber: 1,
        pagesize: 10000,
      });
      const { ok, data, error } = unwrap<FSISInventoryLedgerModel[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load matrix.");
      setGroups(buildGroupsFromLedger(Array.isArray(data) ? data : []));
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
      // Fire the real export endpoint for server-side logging / audit. The
      // workbook itself is built client-side from the already-loaded ledger
      // groups (no re-fetch, no aliasing) so column identity matches the
      // FSISInventoryLedgerClass DTO exactly.
      void targetinventoryAPI
        .export({
          searchkey: "",
          reportyear: Number(year),
          reportmonth: Number(exportMonth) || 0,
          provinces: groups.map((g) => ({
            provinceno: g.provinceno || g.stations[0]?.provinceno || "",
            stationnos: g.stations.map((s) => s.stationno),
          })),
        })
        .catch(() => {
          /* non-blocking */
        });

      // Shape groups for the exporter — 1:1 with FSISInventoryLedgerClass keys.
      const merged = groups.map((g) => ({
        province: g.province,
        stations: g.stations.map((s) => ({
          stationno: s.stationno,
          stationCode: s.stationcode,
          stationName: s.stationname,
          cityName: s.cityname ?? "",
          months: (() => {
            // Deep-clone month buckets so the exportMonth filter below can
            // safely zero-out non-target months without mutating state.
            const out: Record<number, Record<string, number>> = {};
            for (let m = 1; m <= 12; m++) {
              const src = s.months[m];
              if (!src) continue;
              out[m] = { ...src };
            }
            return out;
          })(),
        })),
      }));

      const flatFields = COMPLIANCE_FIELDS.map((f) => ({
        key: String(f.key),
        label: f.label,
        category: f.category,
      }));

      // If a specific report month is selected, zero every other month so
      // the workbook still renders in the reference full-year layout but
      // only the chosen month carries values.
      if (exportMonth > 0) {
        merged.forEach((g) =>
          g.stations.forEach((s) => {
            for (let m = 1; m <= 12; m++) {
              if (m !== exportMonth) s.months[m] = {};
            }
          }),
        );
      }

      await exportComplianceMatrix({
        year,
        groups: merged,
        fields: flatFields,
        signatory: {
          rank: (user as unknown as { rankname?: string })?.rankname ?? user?.rankcode ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: (user as unknown as { designation?: string })?.designation ?? "",
        },
        filename:
          exportMonth > 0
            ? `ComplianceMatrix_${year}_${MONTH_NAMES[exportMonth - 1]}.xlsx`
            : `ComplianceMatrix_${year}.xlsx`,
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
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
                Month
              </div>
              <Select
                value={String(exportMonth)}
                onValueChange={(v) => setExportMonth(Number(v))}
              >
                <SelectTrigger aria-label="Report month for export">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All months</SelectItem>
                  {MONTH_NAMES.map((n, i) => (
                    <SelectItem key={n} value={String(i + 1)}>
                      {n}
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
  onDrill,
}: {
  group: ProvinceGroup;
  totalCols: number;
  fieldKeys: string[];
  year: number;
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
  onDrill,
}: {
  station: StationRow;
  zebra: boolean;
  fieldKeys: string[];
  year: number;
  onDrill: (stationno: string, year: number, month: number) => void;
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
void MIMAROPA_REGION_CODE;
