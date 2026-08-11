import * as React from "react";
import { Download, LayoutGrid, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ResetFiltersButton from "@/components/reset-filters-button";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { resolveTargetScope } from "@/pages/06_target-reference/helpers";
import { MATRIX_TONE } from "@/lib/theme";
import { MONTH_NAMES } from "@/lib/complianceHelpers";
import { buildYears } from "@/lib/utils";
import { MONTH_COLORS } from "@/pages/04_compliance/components/monthColors";
import {
  exportComplianceMatrix,
  type ComplianceExportStation,
} from "@/pages/04_compliance/components/matrixExport";
import { noticeAPI } from "@/services/noticeAPI";
import { unwrap } from "@/lib/api-envelope";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type {
  NoticeCategory,
  NoticeDetailModel,
  NoticeLedgerResultModel,
} from "@/types/noticeType";

/* -------------------------------------------------------------------------
 * Column identity — mirrors the Fire Safety Compliance matrix layout so both
 * modules share the same visual contract (Station + Mode of Issuance sticky
 * columns, Quarter → Month → Category headers, then quarter / semester /
 * annual roll-ups).
 * ---------------------------------------------------------------------- */

const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  quarter: MATRIX_TONE.quarter,
  month: MATRIX_TONE.month,
  cat: MATRIX_TONE.catNotice,
  catSub: MATRIX_TONE.catNoticeSub,
  semester: MATRIX_TONE.semester,
  annual: MATRIX_TONE.annual,
  totalRow: MATRIX_TONE.provTotalRow,
};

const QUARTERS = [
  { label: "Quarter 1", months: [1, 2, 3] },
  { label: "Quarter 2", months: [4, 5, 6] },
  { label: "Quarter 3", months: [7, 8, 9] },
  { label: "Quarter 4", months: [10, 11, 12] },
];

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

/** Category → `noticeaccomlist` count field returned by the Export endpoint. */
const ACCOM_FIELD: Record<NoticeCategory, string> = {
  NOD: "nodcount",
  NTC: "ntccount",
  NTCV: "ntcvcount",
  Abatement: "abatementcount",
  Closure: "closurecount",
};

type IssuanceMode = "MANUAL" | "FSIS";
const ISSUANCE_MODES: { key: IssuanceMode; label: string }[] = [
  { key: "MANUAL", label: "MANUAL" },
  { key: "FSIS", label: "FSIS" },
];

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const AGGREGATES = [
  { key: "q1", label: "Quarter 1 Total", months: [1, 2, 3], tone: STYLE.quarter },
  { key: "q2", label: "Quarter 2 Total", months: [4, 5, 6], tone: STYLE.quarter },
  { key: "q3", label: "Quarter 3 Total", months: [7, 8, 9], tone: STYLE.quarter },
  { key: "q4", label: "Quarter 4 Total", months: [10, 11, 12], tone: STYLE.quarter },
  { key: "sem1", label: "1st Semester", months: [1, 2, 3, 4, 5, 6], tone: STYLE.semester },
  { key: "sem2", label: "2nd Semester", months: [7, 8, 9, 10, 11, 12], tone: STYLE.semester },
  { key: "annual", label: "Annual", months: ALL_MONTHS, tone: STYLE.annual },
] as const;

type CategoryCounts = Record<NoticeCategory, number>;
type MonthBuckets = Record<number, CategoryCounts>;

function emptyCounts(): CategoryCounts {
  return NOTICE_CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {} as CategoryCounts);
}

function bucketAt(months: MonthBuckets, month: number): CategoryCounts {
  return (months[month] ??= emptyCounts());
}

/**
 * Resolve the calendar month a ledger line belongs to. Day lines are keyed by
 * `yyyy-mm-dd`, monthly lines by `yyyy-mm`; aggregated (quarter / semester /
 * annual) lines cannot be attributed to a single month and are skipped.
 */
function lineMonth(key: string): number {
  const match = /^\d{4}-(\d{2})(?:-\d{2})?$/.exec(key);
  if (!match) return 0;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : 0;
}

function sumMonthsOf(months: MonthBuckets, list: readonly number[]): CategoryCounts {
  const out = emptyCounts();
  for (const m of list) {
    const bucket = months[m];
    if (!bucket) continue;
    for (const category of NOTICE_CATEGORIES) out[category] += bucket[category] ?? 0;
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Excel export — POST /FSISNotice/Export, then plotted through the shared
 * compliance-matrix workbook writer so both modules produce the same layout
 * (Station Information | Mode of Issuance | Quarter → Month → Category …).
 * ---------------------------------------------------------------------- */

const EXPORT_FIELDS = NOTICE_CATEGORIES.map((c) => ({
  key: ACCOM_FIELD[c],
  label: CATEGORY_LABEL[c],
  category: "NOTICES",
}));

const FSIC_MODE_CODE: Record<IssuanceMode, number> = { MANUAL: 96, FSIS: 97 };

function emptyExportBucket(): Record<string, number> {
  return Object.fromEntries(NOTICE_CATEGORIES.map((c) => [ACCOM_FIELD[c], 0]));
}

function exportBucketAt(
  months: Record<number, Record<string, number>>,
  month: number,
): Record<string, number> {
  return (months[month] ??= emptyExportBucket());
}

/* -------------------------------------------------------------------------
 * Matrix data model — identical shape to the Compliance / Target matrices:
 * province → stations → per-issuance-mode month buckets.
 * ---------------------------------------------------------------------- */

interface NoticeStationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  cityname: string;
  logoUrl: string;
  /** Combined (MANUAL + FSIS) values — used for the station / province totals. */
  months: MonthBuckets;
  /** Per issuance mode values — one matrix row per mode. */
  modeMonths: Record<IssuanceMode, MonthBuckets>;
}

interface NoticeProvinceGroup {
  province: string;
  provinceno: string;
  stations: NoticeStationRow[];
  provincialTotal: MonthBuckets;
}

function emptyModeMonths(): Record<IssuanceMode, MonthBuckets> {
  return { MANUAL: {}, FSIS: {} };
}

function addCounts(dst: CategoryCounts, src: CategoryCounts) {
  for (const category of NOTICE_CATEGORIES) dst[category] += src[category] ?? 0;
}

/** Build province groups from the FSISNotice Ledger payload. */
function buildGroupsFromLedger(rows: NoticeDetailModel[]): NoticeProvinceGroup[] {
  const groups: NoticeProvinceGroup[] = [];
  const byProvince = new Map<string, NoticeProvinceGroup>();

  for (const station of rows ?? []) {
    const key = station.provinceno || station.provincename || "";
    let group = byProvince.get(key);
    if (!group) {
      group = {
        province: station.provincename ?? "",
        provinceno: station.provinceno ?? "",
        stations: [],
        provincialTotal: {},
      };
      byProvince.set(key, group);
      groups.push(group);
    }

    const months: MonthBuckets = {};
    const modeMonths = emptyModeMonths();

    for (const entry of station.noticedetallist ?? []) {
      const month = Number(String(entry.dateaccomplish ?? "").slice(5, 7));
      if (!(month >= 1 && month <= 12)) continue;
      // Ensure both mode rows exist for every encoded month.
      for (const mode of ISSUANCE_MODES) bucketAt(modeMonths[mode.key], month);
      const combinedBucket = bucketAt(months, month);
      for (const accom of entry.noticeaccomlist ?? []) {
        const mode = ISSUANCE_MODES.find(
          (m) => FSIC_MODE_CODE[m.key] === Number(accom.fsicmode),
        )?.key;
        if (!mode) continue;
        const modeBucket = bucketAt(modeMonths[mode], month);
        for (const category of NOTICE_CATEGORIES) {
          const value =
            Number((accom as unknown as Record<string, unknown>)[ACCOM_FIELD[category]] ?? 0) || 0;
          modeBucket[category] += value;
          combinedBucket[category] += value;
        }
      }
    }

    group.stations.push({
      stationno: station.stationno,
      stationcode: station.stationcode ?? "",
      stationname: station.stationname ?? "",
      provinceno: station.provinceno ?? "",
      province: station.provincename ?? "",
      cityname: station.cityname ?? "",
      logoUrl: station.logourl ?? "",
      months,
      modeMonths,
    });

    for (const monthKey of Object.keys(months)) {
      const month = Number(monthKey);
      addCounts(bucketAt(group.provincialTotal, month), months[month]);
    }
  }

  groups.forEach((g) =>
    g.stations.sort((a, b) => (a.stationcode || "").localeCompare(b.stationcode || "")),
  );
  groups.sort((a, b) => (a.province || "").localeCompare(b.province || ""));
  return groups;
}

interface NoticeMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
}

export function NoticeMatrixModal({ open, onOpenChange, record }: NoticeMatrixModalProps) {
  const { user, systemAccess } = useAuth();
  // Same roleno / stationno scoping rules as the Compliance and Target matrices.
  const scope = React.useMemo(
    () => resolveTargetScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const currentYear = new Date().getFullYear();
  const YEARS = React.useMemo(buildYears, []);
  const [year, setYear] = React.useState<number>(Number(record?.reportYear) || currentYear);
  const [exporting, setExporting] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [groups, setGroups] = React.useState<NoticeProvinceGroup[]>([]);

  // Province / Station filters follow the shared roleno + stationtype rules:
  // locked scopes render as read-only fields, free scopes render pickers.
  const [provinceFilters, setProvinceFilters] = React.useState<SelectedLocation[]>([]);
  const [stationFilters, setStationFilters] = React.useState<SelectedStation[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setYear(Number(record?.reportYear) || currentYear);
    setProvinceFilters(
      scope.provinceLocked
        ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
        : [],
    );
    setStationFilters(
      scope.stationLocked
        ? [
            {
              stationno: scope.stationno,
              stationname: scope.stationname,
              provinceno: scope.provinceno,
              provincename: scope.provincename,
            },
          ]
        : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.reportYear, scope.provinceLocked, scope.stationLocked]);

  // Province/Station cross-sync — identical rules to the Compliance matrix.
  const handleProvincesChange = (next: SelectedLocation[]) => {
    setProvinceFilters(next);
    if (next.length === 0) {
      setStationFilters((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    setStationFilters((prev) => {
      const filtered = prev.filter((s) => allowed.has(s.provinceno));
      return filtered.length === prev.length ? prev : filtered;
    });
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    setStationFilters(next);
    setProvinceFilters((prev) => {
      const merged = [...prev];
      const known = new Set(prev.map((p) => p.locationno));
      next.forEach((s) => {
        if (!s.provinceno || known.has(s.provinceno)) return;
        merged.push({ locationno: s.provinceno, locationname: s.provincename });
        known.add(s.provinceno);
      });
      return merged.length === prev.length ? prev : merged;
    });
  };

  // Fetch the full-year matrix for every station in one call, then bucket the
  // rows per province / station / month. Filtering happens client-side so the
  // multi-selects update the grid instantly (same as the Compliance matrix).
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const response = await noticeAPI.getLedger(
        {
          parameters: {
            searchkey: "",
            reportyear: Number(year),
            interval: 1,
            dateaccomplish: `${year}-01-01T00:00:00`,
            reportmonth: Array.from({ length: 12 }, (_, i) => i + 1),
            provinces: [],
          },
          pagenumber: 1,
          pagesize: 10000,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data, error } = unwrap<NoticeLedgerResultModel | NoticeDetailModel[]>(response);
      if (cancelled) return;
      if (!ok) {
        toast.error(error || "Unable to load the Complied Notices Matrix.");
        setGroups([]);
        setLoading(false);
        return;
      }
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as NoticeLedgerResultModel | null)?.items)
          ? (data as NoticeLedgerResultModel).items
          : [];
      setGroups(buildGroupsFromLedger(items));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, year]);

  // Client-side view filter driven by the multi-selects.
  const filteredGroups = React.useMemo<NoticeProvinceGroup[]>(() => {
    const provSet = new Set(provinceFilters.map((p) => p.locationno).filter(Boolean));
    const stnSet = new Set(stationFilters.map((s) => s.stationno).filter(Boolean));
    return groups
      .filter((g) => provSet.size === 0 || provSet.has(g.provinceno))
      .map((g) => {
        const stations =
          stnSet.size === 0 ? g.stations : g.stations.filter((s) => stnSet.has(s.stationno));
        const provincialTotal: MonthBuckets = {};
        for (const station of stations) {
          for (const monthKey of Object.keys(station.months)) {
            const month = Number(monthKey);
            addCounts(bucketAt(provincialTotal, month), station.months[month]);
          }
        }
        return { ...g, stations, provincialTotal };
      })
      .filter((g) => g.stations.length > 0);
  }, [groups, provinceFilters, stationFilters]);

  const scopedProvinceName = scope.provinceLocked
    ? scope.provincename
    : provinceFilters.length === 1
      ? provinceFilters[0].locationname
      : provinceFilters.length > 1
        ? `${provinceFilters.length} provinces`
        : "";
  const scopedStationName = scope.stationLocked
    ? scope.stationname
    : stationFilters.length === 1
      ? stationFilters[0].stationname
      : stationFilters.length > 1
        ? `${stationFilters.length} stations`
        : "";

  const handleExport = async () => {
    if (!year) {
      toast.error("Please select a year.");
      return;
    }
    setExporting(true);
    try {
      // Export exactly what the grid shows: derive the province/station payload
      // from the filtered groups (falling back to everything loaded).
      const sourceGroups = filteredGroups.length > 0 ? filteredGroups : groups;
      const provincesPayload = sourceGroups.map((g) => ({
        provinceno: g.provinceno,
        stationnos: g.stations.map((s) => s.stationno).filter(Boolean),
      }));

      const resp = await noticeAPI.export({
        searchkey: "",
        reportyear: Number(year),
        provinces: provincesPayload,
      });

      const { ok, data, error } = unwrap<NoticeDetailModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export Complied Notices Matrix.");
        return;
      }

      const stations = Array.isArray(data) ? data : [];
      if (stations.length === 0) {
        toast.info("No complied notices to export.");
        return;
      }

      // province → stations, each station carrying MANUAL + FSIS month rows.
      const byProvince = new Map<string, ComplianceExportStation[]>();
      for (const station of stations) {
        const combinedMonths: Record<number, Record<string, number>> = {};
        const perMode: Record<IssuanceMode, Record<number, Record<string, number>>> = {
          MANUAL: {},
          FSIS: {},
        };

        for (const entry of station.noticedetallist ?? []) {
          const month = Number(String(entry.dateaccomplish ?? "").slice(5, 7));
          if (!(month >= 1 && month <= 12)) continue;
          for (const accom of entry.noticeaccomlist ?? []) {
            const mode = ISSUANCE_MODES.find(
              (m) => FSIC_MODE_CODE[m.key] === Number(accom.fsicmode),
            )?.key;
            if (!mode) continue;
            const modeBucket = exportBucketAt(perMode[mode], month);
            const allBucket = exportBucketAt(combinedMonths, month);
            for (const category of NOTICE_CATEGORIES) {
              const field = ACCOM_FIELD[category];
              const value = Number((accom as unknown as Record<string, unknown>)[field] ?? 0) || 0;
              modeBucket[field] += value;
              allBucket[field] += value;
            }
          }
        }

        const provinceName = station.provincename || "Unknown Province";
        const bucket = byProvince.get(provinceName) ?? [];
        bucket.push({
          stationno: station.stationno,
          stationCode: station.stationcode ?? "",
          stationName: station.stationname ?? "",
          cityName: station.cityname ?? "",
          months: combinedMonths,
          modes: ISSUANCE_MODES.map((m) => ({ label: m.label, months: perMode[m.key] })),
        });
        byProvince.set(provinceName, bucket);
      }

      await exportComplianceMatrix({
        year: Number(year),
        groups: Array.from(byProvince.entries()).map(([province, list]) => ({
          province,
          stations: list.sort((a, b) => (a.stationCode || "").localeCompare(b.stationCode || "")),
        })),
        fields: EXPORT_FIELDS,
        categoryLabels: { NOTICES: "Complied Notices" },
        title: `COMPLIED NOTICES MATRIX — ${year}`,
        sheetName: `Notices Matrix ${year}`,
        signatory: {
          rank:
            (user as unknown as { rankcode?: string; rankname?: string })?.rankcode ??
            (user as unknown as { rankname?: string })?.rankname ??
            "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: (user as unknown as { designation?: string })?.designation ?? "",
        },
        filename: `CompliedNoticesMatrix_${year}.xlsx`,
      });
      toast.success("Complied Notices Matrix exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Complied Notices Matrix.");
    } finally {
      setExporting(false);
    }
  };

  const catSpan = NOTICE_CATEGORIES.length;
  const totalCols = 2 + 12 * catSpan + AGGREGATES.length * catSpan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Complied Notices Matrix</DialogTitle>
              <p className="text-xs text-muted-foreground">Manual and FSIS issuance — {year}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-2"
            >
              Close
            </Button>
          </div>
        </DialogHeader>

        {/* Filters — identical behaviour to the Compliance / Target matrices */}
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Year" />
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
              {scope.provinceLocked ? (
                <ReadOnlyField
                  value={scopedProvinceName}
                  placeholder="All provinces"
                  title="Restricted to your assigned province"
                />
              ) : (
                <LocationMultiSelect
                  mode="location"
                  value={provinceFilters}
                  locationtype="PROVINCE"
                  parentcode={MIMAROPA_REGION_CODE}
                  onChange={handleProvincesChange}
                  placeholder="All provinces"
                  hideCode
                  className="w-full"
                />
              )}
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Station
              </div>
              {scope.stationLocked ? (
                <ReadOnlyField
                  value={scopedStationName}
                  placeholder="All stations"
                  title="Restricted to your assigned station"
                />
              ) : (
                <StationMultiSelect
                  mode="station"
                  value={stationFilters}
                  provinces={
                    scope.provinceLocked
                      ? [{ provinceno: scope.provinceno }]
                      : provinceFilters.map((p) => ({ provinceno: p.locationno }))
                  }
                  reportyear={Number(year)}
                  onChange={handleStationsChange}
                  placeholder="All stations"
                  alwaysEnabled
                />
              )}
            </div>
            <div className="flex items-end justify-end md:col-span-2 lg:col-span-1">
              <ResetFiltersButton
                onReset={() => {
                  setYear(Number(record?.reportYear) || currentYear);
                  setProvinceFilters(
                    scope.provinceLocked
                      ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
                      : [],
                  );
                  setStationFilters(
                    scope.stationLocked
                      ? [
                          {
                            stationno: scope.stationno,
                            stationname: scope.stationname,
                            provinceno: scope.provinceno,
                            provincename: scope.provincename,
                          },
                        ]
                      : [],
                  );
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <MatrixHeader catSpan={catSpan} />
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
              {!loading && filteredGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="border-b bg-card px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No complied notices for {year}.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredGroups.map((group) => (
                  <ProvinceBlock
                    key={group.provinceno || group.province}
                    group={group}
                    totalCols={totalCols}
                  />
                ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatrixHeader({ catSpan }: { catSpan: number }) {
  return (
    <thead className="sticky top-0 z-30">
      <tr>
        <th
          rowSpan={3}
          className={`sticky left-0 top-0 z-40 min-w-[240px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Station
        </th>
        <th
          rowSpan={3}
          className={`sticky left-[240px] top-0 z-40 min-w-[120px] border-b border-r px-3 py-2 text-center uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Mode of Issuance
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
        {AGGREGATES.map((a) => (
          <th
            key={`agg-${a.key}`}
            rowSpan={2}
            colSpan={catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${a.tone}`}
          >
            {a.label}
          </th>
        ))}
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.map((mv, i) => {
            const color = MONTH_COLORS[mv - 1];
            return (
              <th
                key={`m-${mv}`}
                colSpan={catSpan}
                style={{ backgroundColor: color.bg, color: color.text }}
                className={`border-b px-2 py-1.5 text-center font-semibold uppercase ${
                  i === 2 ? "border-r-2 border-r-white/30" : "border-r"
                }`}
              >
                {MONTH_NAMES[mv - 1]}
              </th>
            );
          }),
        )}
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.flatMap((mv, monthIdx) =>
            NOTICE_CATEGORIES.map((category, ci) => (
              <th
                key={`c-${mv}-${category}`}
                className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                  ci === NOTICE_CATEGORIES.length - 1 && monthIdx === 2
                    ? "border-r-2 border-r-white/30"
                    : "border-r"
                } ${STYLE.catSub}`}
              >
                {CATEGORY_LABEL[category]}
              </th>
            )),
          ),
        )}
        {AGGREGATES.flatMap((a) =>
          NOTICE_CATEGORIES.map((category, ci) => (
            <th
              key={`c-${a.key}-${category}`}
              className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                ci === NOTICE_CATEGORIES.length - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${STYLE.catSub}`}
            >
              {CATEGORY_LABEL[category]}
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

function ValueCell({
  value,
  bold,
  boundary,
  rowClass,
}: {
  value: number;
  bold?: boolean;
  boundary?: boolean;
  rowClass?: string;
}) {
  return (
    <td
      className={`border-b px-2 py-1.5 text-center tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${value === 0 && !bold ? "text-muted-foreground/60" : ""} ${
        rowClass ?? ""
      }`}
    >
      {value.toLocaleString()}
    </td>
  );
}

function DataCells({ months, rowClass }: { months: MonthBuckets; rowClass?: string }) {
  return (
    <>
      {ALL_MONTHS.map((mv) => {
        const bucket = months[mv];
        const quarterEnd = mv % 3 === 0;
        return NOTICE_CATEGORIES.map((category, i) => (
          <ValueCell
            key={`m-${mv}-${category}`}
            value={bucket?.[category] ?? 0}
            boundary={i === NOTICE_CATEGORIES.length - 1 && quarterEnd}
            rowClass={rowClass}
          />
        ));
      })}
      {AGGREGATES.map((a) => {
        const totals = sumMonthsOf(months, a.months);
        return NOTICE_CATEGORIES.map((category, i) => (
          <ValueCell
            key={`a-${a.key}-${category}`}
            value={totals[category]}
            bold
            boundary={i === NOTICE_CATEGORIES.length - 1}
            rowClass={rowClass}
          />
        ));
      })}
    </>
  );
}

function StationBlock({ station, zebra }: { station: NoticeStationRow; zebra: boolean }) {
  const rowBg = zebra ? "bg-muted" : "bg-card";
  return (
    <>
      {ISSUANCE_MODES.map((mode, mi) => (
        <tr key={mode.key} className={rowBg}>
          {mi === 0 ? (
            <td
              rowSpan={ISSUANCE_MODES.length}
              className={`sticky left-0 z-20 min-w-[240px] border-b border-r px-3 py-2 ${rowBg}`}
            >
              <div className="flex items-center gap-2">
                <AvatarWithFallback
                  entity={{ name: station.stationname, logourl: station.logoUrl }}
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
          ) : null}
          <td
            className={`sticky left-[240px] z-20 min-w-[120px] border-b border-r px-3 py-2 text-center text-[11px] font-semibold uppercase ${rowBg}`}
          >
            {mode.label}
          </td>
          <DataCells months={station.modeMonths[mode.key] ?? {}} />
        </tr>
      ))}
    </>
  );
}

function ProvinceBlock({ group, totalCols }: { group: NoticeProvinceGroup; totalCols: number }) {
  return (
    <>
      <tr>
        <td
          colSpan={2}
          className={`sticky left-0 z-10 border-b border-t-2 border-t-slate-400/60 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] ${MATRIX_TONE.provHeaderRow}`}
        >
          {group.province || "Unknown Province"}
        </td>
        <td
          colSpan={totalCols - 2}
          aria-hidden="true"
          className="border-b border-t-2 border-grid-strong group-row"
        />
      </tr>
      {group.stations.map((station, idx) => (
        <StationBlock key={station.stationno} station={station} zebra={idx % 2 === 1} />
      ))}
      <ProvinceTotalRow province={group.province} months={group.provincialTotal} />
    </>
  );
}

function ProvinceTotalRow({ province, months }: { province: string; months: MonthBuckets }) {
  return (
    <tr>
      <td
        className={`sticky left-0 z-20 min-w-[240px] border-b border-r px-3 py-2 text-[11px] font-bold uppercase tracking-wider ${STYLE.totalRow}`}
      >
        {(province || "Province") + " Total"}
      </td>
      <td
        className={`sticky left-[240px] z-20 min-w-[120px] border-b border-r px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider ${STYLE.totalRow}`}
      >
        ALL
      </td>
      <DataCells months={months} rowClass={STYLE.totalRow} />
    </tr>
  );
}

export default NoticeMatrixModal;
