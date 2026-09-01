import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, LayoutGrid, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { MONTHS, MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { targetreferenceAPI } from "@/services/targetreferenceAPI";
import { unwrap } from "@/lib/api-envelope";
import type {
  TargetReferenceModel,
  TargetReferenceClassModel,
  ExportTargetReferenceRequestDTO,
  ProvinceStationSelectionClass,
  ProvinceExportModel,
} from "@/types/targetreferenceType";
import { resolveTargetScope } from "../helpers";
import { useAuth } from "@/lib/auth";
import { exportTargetMatrix } from "./matrixExport";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ResetFiltersButton from "@/components/reset-filters-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MATRIX_TONE } from "@/lib/theme";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  provinceno: string;
  stationno?: string;
  provinceName?: string;
  stationName?: string;
  lockFilters?: boolean;
}

const CATS = [
  { key: "bplo", label: "BPLO" },
  { key: "gov", label: "Gov" },
  { key: "peza", label: "PEZA" },
  { key: "tieza", label: "TIEZA" },
] as const;
type CatKey = (typeof CATS)[number]["key"];
type Bucket = Record<CatKey, number>;

const emptyBucket = (): Bucket => ({ bplo: 0, gov: 0, peza: 0, tieza: 0 });
const addBucket = (a: Bucket, b: Bucket): Bucket => ({
  bplo: a.bplo + b.bplo,
  gov: a.gov + b.gov,
  peza: a.peza + b.peza,
  tieza: a.tieza + b.tieza,
});

interface StationRow {
  stationno: string;
  stationCode: string;
  stationName: string;
  cityName: string;
  province: string;
  logoUrl: string;
  months: Record<number, Bucket>;
}

interface ProvinceGroup {
  province: string;
  stations: StationRow[];
  provincialTotal: {
    months: Record<number, Bucket>;
  };
}

function resolveTargetMonth(it: { reportmonth?: number; targetdate?: string }): number | null {
  if (it.reportmonth != null) {
    const mv = Number(it.reportmonth);
    if (mv >= 1 && mv <= 12) return mv;
  }
  if (it.targetdate) {
    const targetdate = String(it.targetdate).trim();
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(targetdate);
    if (isoMatch) {
      const mv = Number(isoMatch[2]);
      if (mv >= 1 && mv <= 12) return mv;
    }
    const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(targetdate);
    if (slashMatch) {
      const mv = Number(slashMatch[1]);
      if (mv >= 1 && mv <= 12) return mv;
    }
    const parsed = new Date(targetdate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getMonth() + 1;
    }
  }
  return null;
}

function buildStationRow(m: TargetReferenceModel): StationRow {
  const months: Record<number, Bucket> = {};
  for (let i = 1; i <= 12; i++) months[i] = emptyBucket();
  (Array.isArray(m.targetreferencelist) ? m.targetreferencelist : []).forEach((it) => {
    const mv = resolveTargetMonth(it);
    if (!mv) return;
    months[mv] = {
      bplo: months[mv].bplo + (Number(it.bplototal) || 0),
      gov: months[mv].gov + (Number(it.govtotal) || 0),
      peza: months[mv].peza + (Number(it.pezatotal) || 0),
      tieza: months[mv].tieza + (Number(it.tiezatotal) || 0),
    };
  });
  return {
    stationno: m.stationno,
    stationCode: m.stationcode ?? (m as any).stationCode ?? "",
    stationName: m.stationname ?? (m as any).stationName ?? "",
    cityName:
      (m as any).cityname ??
      (m as any).cityName ??
      (m as any).cityname ??
      (m as any).cityName ??
      "",
    province: m.provincename ?? (m as any).province ?? (m as any).province ?? "—",
    logoUrl: m.logourl ?? (m as any).logoUrl ?? (m as any).logoUrl ?? "",
    months,
  };
}

function normalizeTargetReferenceRow(item: any): TargetReferenceClassModel | null {
  const targetdate = item.targetdate ?? item.Targetdate ?? item.targetDate;
  const reportmonth = item.reportmonth ?? item.Reportmonth ?? item.reportMonth;
  const bplototal = Number(item.bplototal ?? item.BPLOtotal ?? item.bploTotal ?? 0);
  const govtotal = Number(item.govtotal ?? item.Govtotal ?? item.govTotal ?? 0);
  const pezatotal = Number(item.pezatotal ?? item.PEZAtotal ?? item.pezaTotal ?? 0);
  const tiezatotal = Number(item.tiezatotal ?? item.TIEZAtotal ?? item.tiezaTotal ?? 0);

  if (
    targetdate == null &&
    reportmonth == null &&
    bplototal === 0 &&
    govtotal === 0 &&
    pezatotal === 0 &&
    tiezatotal === 0
  ) {
    return null;
  }

    return {
    targetno: String(item.targetno ?? item.Targetno ?? ""),
    targetdate: targetdate == null ? undefined : String(targetdate),
    reportyear: item.reportyear ?? item.Reportyear,
    reportmonth: reportmonth == null ? undefined : Number(reportmonth),
    reportday: item.reportday || item.Reportday,
    remarks: item.remarks ?? item.Remarks,
    bplototal,
    govtotal,
    pezatotal,
    tiezatotal,
  };
}

function normalizeExportStation(item: any): TargetReferenceModel {
  const targetreferencelist = Array.isArray(item.targetreferencelist)
    ? item.targetreferencelist
    : Array.isArray(item.targetreferenceList)
      ? item.targetreferenceList
      : Array.isArray(item.TargetReferenceList)
        ? item.TargetReferenceList
        : null;

  const rows = Array.isArray(targetreferencelist)
    ? targetreferencelist
        .map(normalizeTargetReferenceRow)
        .filter((row): row is TargetReferenceClassModel => row != null)
    : [];

  const singleRow = normalizeTargetReferenceRow(item);
  const targetreferencelistRows = rows.length > 0 ? rows : singleRow ? [singleRow] : [];

  return {
    stationno: String(item.stationno ?? item.Stationno ?? ""),
    stationcode: String(item.stationcode ?? item.stationCode ?? item.Stationcode ?? ""),
    stationname: String(item.stationname ?? item.stationName ?? item.Stationname ?? ""),
    provinceno: String(item.provinceno ?? item.Provinceno ?? item.provinceNo ?? ""),
    provincename: String(
      item.provincename ?? item.province ?? item.provinceName ?? item.Provincename ?? "—",
    ),
    logourl: String(item.logourl ?? item.logoUrl ?? item.Logourl ?? ""),
    targetreferencelist: targetreferencelistRows,
  };
}

function buildGroupsFromExport(provinces: unknown): ProvinceGroup[] {
  const normalizedProvinces: ProvinceExportModel[] = [];
  const payload = Array.isArray(provinces)
    ? provinces
    : ((provinces as any)?.data ?? (provinces as any)?.provinces ?? []);

  if (!Array.isArray(payload) || payload.length === 0) {
    return [];
  }

  const first = payload[0] as any;
  if (Array.isArray(first.stations) || Array.isArray(first.stationlist)) {
    for (const rawProv of payload as any[]) {
      const stations = Array.isArray(rawProv.stations)
        ? rawProv.stations
        : Array.isArray(rawProv.stationlist)
          ? rawProv.stationlist
          : [];
      normalizedProvinces.push({
        provinceno: String(rawProv.provinceno ?? rawProv.provinceNo ?? rawProv.Provinceno ?? ""),
        provincename: String(
          rawProv.provincename ??
            rawProv.province ??
            rawProv.provinceName ??
            rawProv.Provincename ??
            "—",
        ),
        stations: stations.map(normalizeExportStation),
      });
    }
  } else {
    const groupsByProvince = new Map<
      string,
      {
        provinceno: string;
        provincename: string;
        stations: Map<string, TargetReferenceModel>;
      }
    >();

    for (const rawStation of payload as any[]) {
      const station = normalizeExportStation(rawStation);
      const stationKey = station.stationno || station.stationname || "__unknown";
      const provinceKey = station.provinceno || station.provincename || "__unknown";
      let province = groupsByProvince.get(provinceKey);
      if (!province) {
        province = {
          provinceno: station.provinceno ?? "",
          provincename: station.provincename ?? "—",
          stations: new Map<string, TargetReferenceModel>(),
        };
        groupsByProvince.set(provinceKey, province);
      }

      const existingStation = province.stations.get(stationKey);
      if (existingStation) {
        existingStation.targetreferencelist = [
          ...existingStation.targetreferencelist,
          ...station.targetreferencelist,
        ];
      } else {
        province.stations.set(stationKey, station);
      }
    }

    for (const province of groupsByProvince.values()) {
      normalizedProvinces.push({
        provinceno: province.provinceno,
        provincename: province.provincename,
        stations: Array.from(province.stations.values()),
      });
    }
  }

  return normalizedProvinces
    .filter((p) => p && Array.isArray(p.stations))
    .map<ProvinceGroup>((p) => {
      const provinceName = p.provincename ?? "—";
      const stations = p.stations
        .map((s) =>
          buildStationRow({
            ...s,
            // Ensure the station row carries the province name from the group
            // even if the station payload omits it.
            provincename: s.provincename ?? provinceName,
          } as TargetReferenceModel),
        )
        .sort((a, b) => a.stationName.localeCompare(b.stationName));

      const totalMonths: Record<number, Bucket> = {};
      for (let m = 1; m <= 12; m++) totalMonths[m] = emptyBucket();
      stations.forEach((s) => {
        for (let m = 1; m <= 12; m++) {
          totalMonths[m] = addBucket(totalMonths[m], s.months[m]);
        }
      });

      return {
        province: provinceName,
        stations,
        provincialTotal: { months: totalMonths },
      };
    })
    .sort((a, b) => a.province.localeCompare(b.province));
}

/**
 * Build the province→stations selection used by both the station search and
 * the export API. Empty selection === ALL provinces / ALL stations.
 */
function buildProvinceSelections(
  provinces: SelectedLocation[],
  stations: SelectedStation[],
): ProvinceStationSelectionClass[] {
  // Group selected stations by their provinceno.
  const byProv = new Map<string, string[]>();
  stations.forEach((s) => {
    const arr = byProv.get(s.provinceno) ?? [];
    arr.push(s.stationno);
    byProv.set(s.provinceno, arr);
  });

  // Ensure every explicitly selected province is present, even with no stations.
  provinces.forEach((p) => {
    if (!byProv.has(p.locationno)) byProv.set(p.locationno, []);
  });

  return Array.from(byProv.entries()).map(([provinceno, stationnos]) => ({
    provinceno,
    stationnos,
  }));
}

export default function TargetMatrixModal({
  open,
  onOpenChange,
  year,
  provinceno,
  provinceName,
  stationno,
  stationName,
  lockFilters = false,
}: Props) {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveTargetScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const YEARS = React.useMemo(buildYears, []);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [groups, setGroups] = React.useState<ProvinceGroup[]>([]);
  const [yearFilter, setYearFilter] = React.useState<number>(year);

  // Seed initial multi-select state from the (optional) single-value props
  // coming from a card click. Empty array === ALL.
  const seedProvinces = React.useCallback((): SelectedLocation[] => {
    if (scope.provinceLocked) {
      return [{ locationno: scope.provinceno, locationname: user?.provincename ?? "" }];
    }
    if (provinceno && provinceno !== "" && provinceno !== "00000000-0000-0000-0000-000000000000") {
      return [{ locationno: provinceno, locationname: provinceName ?? "" }];
    }
    return [];
  }, [scope.provinceLocked, scope.provinceno, provinceno, provinceName, user?.provincename]);

  const seedStations = React.useCallback((): SelectedStation[] => {
    if (scope.stationLocked) {
      return [
        {
          stationno: scope.stationno,
          stationname: user?.stationname ?? "",
          provinceno: scope.provinceno,
          provincename: user?.provincename ?? "",
        },
      ];
    }
    if (stationno && stationno !== "" && stationno !== "00000000-0000-0000-0000-000000000000") {
      return [
        {
          stationno,
          stationname: stationName ?? "",
          provinceno: provinceno ?? "",
          provincename: provinceName ?? "",
        },
      ];
    }
    return [];
  }, [
    scope.stationLocked,
    scope.stationno,
    scope.provinceno,
    stationno,
    stationName,
    provinceno,
    provinceName,
    user?.stationname,
    user?.provincename,
  ]);

  const [provinceFilters, setProvinceFilters] = React.useState<SelectedLocation[]>(seedProvinces);
  const [stationFilters, setStationFilters] = React.useState<SelectedStation[]>(seedStations);

  const provinceSelections = React.useMemo(
    () => buildProvinceSelections(provinceFilters, stationFilters),
    [provinceFilters, stationFilters],
  );

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const body: ExportTargetReferenceRequestDTO = {
        searchkey: "",
        reportyear: Number(yearFilter),
        provinces: provinceSelections,
      };
      const resp = await targetreferenceAPI.export(body, { suppressGlobalLoading: true });
      const { ok, data, error } = unwrap<ProvinceExportModel[]>(resp);
      if (cancelled) return;
      if (!ok) {
        toast.error(error || "Unable to load target matrix.");
        setGroups([]);
      } else {
        setGroups(buildGroupsFromExport(Array.isArray(data) ? data : []));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, yearFilter, provinceSelections]);

  const handleExport = async () => {
    if (groups.length === 0) {
      toast.info("No data available to export.");
      return;
    }
    setExporting(true);
    try {
      await exportTargetMatrix({
        year,
        groups: groups.map((g) => ({
          province: g.province,
          stations: g.stations.map((s) => ({
            stationno: s.stationno,
            stationCode: s.stationCode,
            stationName: s.stationName,
            cityName: s.cityName,
            months: s.months,
          })),
        })),
        signatory: {
          rank: user?.rankcode ?? user?.rankname ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: user?.designation ?? "",
        },
      });
      toast.success("Target Matrix exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Target Matrix.");
    } finally {
      setExporting(false);
    }
  };

  const totalCols = 1 + 12 * 4 + 4 * 4 + 4 + 4 + 4;

  // Province → Station sync. Empty provinces clear stations (Rule 6);
  // otherwise drop stations that fall outside the remaining provinces.
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

  // Station → Province sync. Derive the unique province set directly from
  // the selected station objects (no extra API request).
  const handleStationsChange = (next: SelectedStation[]) => {
    setStationFilters(next);
    const seen = new Map<string, SelectedLocation>();
    next.forEach((s) => {
      if (!s.provinceno || seen.has(s.provinceno)) return;
      seen.set(s.provinceno, { locationno: s.provinceno, locationname: s.provincename });
    });
    const derived = Array.from(seen.values());
    setProvinceFilters((prev) => {
      if (prev.length === derived.length) {
        const prevKey = prev
          .map((p) => p.locationno)
          .sort()
          .join(",");
        const nextKey = derived
          .map((p) => p.locationno)
          .sort()
          .join(",");
        if (prevKey === nextKey) return prev;
      }
      return derived;
    });
  };

  // Sync when the modal is (re)opened for a specific card.
  React.useEffect(() => {
    if (!open) return;
    setYearFilter(year);
    setProvinceFilters(seedProvinces());
    setStationFilters(seedStations());
  }, [open, year, seedProvinces, seedStations]);

  const handleResetFilters = () => {
    setYearFilter(new Date().getFullYear());
    setProvinceFilters(
      scope.provinceLocked
        ? [{ locationno: scope.provinceno, locationname: user?.provincename ?? "" }]
        : [],
    );
    setStationFilters(
      scope.stationLocked
        ? [
            {
              stationno: scope.stationno,
              stationname: user?.stationname ?? "",
              provinceno: scope.provinceno,
              provincename: user?.provincename ?? "",
            },
          ]
        : [],
    );
  };

  const provinceLabel =
    provinceFilters.length === 0
      ? "ALL"
      : provinceFilters.length === 1
        ? provinceFilters[0].locationname
        : `${provinceFilters.length} selected`;
  const stationLabel =
    stationFilters.length === 0
      ? "ALL"
      : stationFilters.length === 1
        ? stationFilters[0].stationname
        : `${stationFilters.length} selected`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-card px-5 py-3">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Fire Safety Inspection Target Matrix
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Stations grouped by Province — {yearFilter}
              </p>
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

        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              {lockFilters ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {yearFilter}
                </div>
              ) : (
                <Select
                  value={String(yearFilter)}
                  onValueChange={(value) => setYearFilter(Number(value))}
                >
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
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              {scope.provinceLocked || lockFilters ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {provinceLabel || user?.provincename || ""}
                </div>
              ) : (
                <LocationMultiSelect
                  mode="location"
                  value={provinceFilters}
                  locationtype="PROVINCE"
                  parentcode={MIMAROPA_REGION_CODE}
                  onChange={handleProvincesChange}
                  placeholder="Select province"
                  hideCode
                  className="w-full"
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Station
              </div>
              {scope.stationLocked || lockFilters ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {stationLabel || user?.stationname || ""}
                </div>
              ) : (
                <StationMultiSelect
                  mode="station"
                  value={stationFilters}
                  provinces={
                    provinceFilters.length > 0
                      ? provinceFilters.map((p) => ({ provinceno: p.locationno }))
                      : scope.provinceLocked
                        ? [{ provinceno: scope.provinceno }]
                        : []
                  }
                  reportyear={yearFilter}
                  onChange={handleStationsChange}
                  placeholder="Select station"
                  alwaysEnabled
                />
              )}
            </div>

            {!lockFilters && (
              <div className="flex items-end justify-end md:justify-start lg:justify-end">
                <ResetFiltersButton onReset={handleResetFilters} />
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <MatrixHeader />

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
                    No target data available for {year}.
                  </td>
                </tr>
              )}

              {!loading &&
                groups.map((g) => (
                  <ProvinceBlock key={g.province} group={g} totalCols={totalCols} />
                ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Header ============================== */

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

function MatrixHeader() {
  const quarters: { label: string; months: number[] }[] = [
    { label: "Target First Quarter", months: [1, 2, 3] },
    { label: "Target Second Quarter", months: [4, 5, 6] },
    { label: "Target Third Quarter", months: [7, 8, 9] },
    { label: "Target Fourth Quarter", months: [10, 11, 12] },
  ];

  return (
    <thead className="sticky top-0 z-30">
      <tr>
        <th
          rowSpan={3}
          className={`sticky left-0 top-0 z-40 min-w-[260px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Station Information
        </th>
        {quarters.map((q) => (
          <th
            key={q.label}
            colSpan={12}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            {q.label}
          </th>
        ))}
        {quarters.map((q) => (
          <th
            key={`total-${q.label}`}
            rowSpan={2}
            colSpan={4}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            {q.label}
          </th>
        ))}
        <th
          rowSpan={2}
          colSpan={4}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          Target First Semester
        </th>
        <th
          rowSpan={2}
          colSpan={4}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.semester}`}
        >
          Target Second Semester
        </th>
        <th
          rowSpan={2}
          colSpan={4}
          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.annual}`}
        >
          Annual Total
        </th>
      </tr>

      <tr>
        {quarters.flatMap((q) =>
          q.months.map((mv, i) => {
            const m = MONTHS.find((mo) => mo.value === mv)!;
            return (
              <th
                key={`m-${mv}`}
                colSpan={4}
                className={`border-b px-2 py-1.5 text-center font-semibold uppercase ${
                  i === 2 ? "border-r-2 border-r-white/30" : "border-r"
                } ${STYLE.month}`}
              >
                {m.name}
              </th>
            );
          }),
        )}
      </tr>

      <tr>
        {quarters.flatMap((q) =>
          q.months.flatMap((mv, monthIdx) =>
            CATS.map((c, i) => (
              <th
                key={`c-${mv}-${c.key}`}
                className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                  i === 3 && monthIdx === 2 ? "border-r-2 border-r-emerald-800/60" : "border-r"
                } ${STYLE.cat}`}
              >
                {c.label}
              </th>
            )),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          CATS.map((c, i) => (
            <th
              key={`c-final-${grpIdx}-${c.key}`}
              className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                i === 3 ? "border-r-2 border-r-white/40" : "border-r"
              } ${grpIdx <= 3 ? STYLE.quarter : grpIdx === 6 ? STYLE.annual : STYLE.semester}`}
            >
              {c.label}
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

/* ============================== Body ============================== */

function ProvinceBlock({ group, totalCols }: { group: ProvinceGroup; totalCols: number }) {
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
        <StationDataRow key={s.stationno} station={s} zebra={idx % 2 === 1} />
      ))}

      <ProvincialTotalRow province={group.province} months={group.provincialTotal.months} />
    </>
  );
}

function computeAggregates(months: Record<number, Bucket>) {
  const sumMonths = (mm: number[]) =>
    mm.reduce((acc, m) => addBucket(acc, months[m] ?? emptyBucket()), emptyBucket());
  return {
    q1: sumMonths([1, 2, 3]),
    q2: sumMonths([4, 5, 6]),
    q3: sumMonths([7, 8, 9]),
    q4: sumMonths([10, 11, 12]),
    sem1: sumMonths([1, 2, 3, 4, 5, 6]),
    sem2: sumMonths([7, 8, 9, 10, 11, 12]),
    annual: sumMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  };
}

function NumCell({
  value,
  bold,
  rowClass,
  boundary,
}: {
  value: number;
  bold?: boolean;
  rowClass?: string;
  boundary?: boolean;
}) {
  return (
    <td
      className={`border-b px-2 py-1.5 text-center tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${
        value === 0 && !bold ? "text-muted-foreground/60" : ""
      } ${rowClass ?? ""}`}
    >
      {value.toLocaleString()}
    </td>
  );
}

function StationDataRow({ station, zebra }: { station: StationRow; zebra: boolean }) {
  const agg = computeAggregates(station.months);
  const rowBg = zebra ? "bg-muted" : "bg-card";
  return (
    <tr className={rowBg}>
      <td className={`sticky left-0 z-10 border-b border-r px-3 py-2 ${rowBg}`}>
        <div className="flex items-center gap-2">
          <AvatarWithFallback
            entity={{ name: station.stationName }}
            src={station.logoUrl || undefined}
            name={station.stationName}
            className="h-8 w-8 shrink-0 rounded-full ring-1 ring-primary/20"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {station.stationCode}
              </span>
            </div>
            <div className="truncate text-[11px] font-semibold">{station.stationName}</div>
          </div>
        </div>
      </td>

      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
        const b = station.months[mv] ?? emptyBucket();
        const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
        return CATS.map((c, i) => (
          <NumCell
            key={`${station.stationno}-${mv}-${c.key}`}
            value={b[c.key]}
            boundary={i === 3 && quarterEnd}
          />
        ));
      })}

      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        CATS.map((c, i) => (
          <NumCell
            key={`${station.stationno}-${grp}-${c.key}`}
            value={agg[grp][c.key]}
            bold
            boundary={i === 3}
          />
        )),
      )}
    </tr>
  );
}

function ProvincialTotalRow({
  province,
  months,
}: {
  province: string;
  months: Record<number, Bucket>;
}) {
  const agg = computeAggregates(months);
  return (
    <tr>
      <td
        className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-[11px] uppercase tracking-wider ${STYLE.provTotalRow}`}
      >
        Provincial Total — {province}
      </td>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
        const b = months[mv] ?? emptyBucket();
        const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
        return CATS.map((c, i) => (
          <NumCell
            key={`pt-${province}-${mv}-${c.key}`}
            value={b[c.key]}
            bold
            boundary={i === 3 && quarterEnd}
            rowClass={STYLE.provTotalRow}
          />
        ));
      })}
      {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
        CATS.map((c, i) => (
          <NumCell
            key={`pt-${province}-${grp}-${c.key}`}
            value={agg[grp][c.key]}
            bold
            boundary={i === 3}
            rowClass={STYLE.provTotalRow}
          />
        )),
      )}
    </tr>
  );
}
