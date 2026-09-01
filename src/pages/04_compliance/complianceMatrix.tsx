import * as React from "react";

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
import { toast } from "@/lib/toast";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import ResetFiltersButton from "@/components/reset-filters-button";
import { unwrap } from "@/lib/api-envelope";
import { sumMonths, MONTH_NAMES } from "@/lib/complianceHelpers";
import { complianceAPI } from "@/services/complianceAPI";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { EMPTY_GUID } from "@/lib/fsims-constants";
import { buildYears } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { resolveTargetScope } from "@/pages/06_target-reference/helpers";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import type {
  FSISComplianceLedgerClass,
  FSISComplianceModel,
  ProvinceIssuanceExportModel,
} from "@/types/complianceType";
import { exportComplianceMatrix, type ComplianceExportStation } from "./components/matrixExport";
import { MONTH_COLORS } from "./components/monthColors";
import { MATRIX_TONE } from "@/lib/theme";

const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  quarter: MATRIX_TONE.quarter,
  month: MATRIX_TONE.month,
  cat: MATRIX_TONE.cat,
  catInsp: MATRIX_TONE.catInsp,
  catFsec: MATRIX_TONE.catFsec,
  catFsic: MATRIX_TONE.catFsic,
  catNotice: MATRIX_TONE.catNotice,
  catInspSub: MATRIX_TONE.catInspSub,
  catFsecSub: MATRIX_TONE.catFsecSub,
  catFsicSub: MATRIX_TONE.catFsicSub,
  catNoticeSub: MATRIX_TONE.catNoticeSub,
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

// ---------------------------------------------------------------------------
// Compliance fields — real backend DTO keys (FSISComplianceLedgerClass), no
// Keeps the matrix aligned with the compliance ledger fields from the API.
// and `monitoringEdit.tsx` so the on-screen matrix and the exported workbook
// share exactly the same column identity as the source of truth.
// ---------------------------------------------------------------------------
type ComplianceCategory = "INSPECTION" | "FSEC" | "FSIC" | "NOTICES";

/**
 * Column tree — mirrors the official matrix layout:
 *   INSPECTION → During | After | 1st BPLO (Target/Issuance) | 1st GOV | 1st PEZA | 1st TIEZA
 *   FSEC / FSIC / NOTICES → flat leaf columns
 */
/** Derived (computed) leaf kinds — never stored, always calculated. */
type DerivedKind = "variance" | "positive" | "pct";
interface DerivedDef {
  kind: DerivedKind;
  targetKey: string;
  accKey: string;
}

interface ColumnKey {
  key: string;
  label: string;
  /** Present → the column is computed from its target/accomplished pair. */
  derived?: DerivedDef;
}

interface ColumnGroup {
  category: ComplianceCategory;
  label: string;
  /** true → the group renders a Target/Accomplished/… sub-header row. */
  grouped: boolean;
  keys: ColumnKey[];
}

/**
 * Sector group (BPLO / GOV / PEZA / TIEZA) — five leaves:
 *   TARGET | ACCOMPLISHED | VARIANCE | POSITIVE LISTING | %
 * Variance / Positive Listing / % follow the same rules used across compliance:
 *   VARIANCE         = MAX(target - accomplished, 0)
 *   POSITIVE LISTING = MAX(accomplished - target, 0)
 *   %                = (accomplished - target) / target  (0 target & 0 acc -> 0%)
 */
function sectorGroup(label: string, targetKey: string, accKey: string): ColumnGroup {
  const slug = label.toLowerCase();
  const derived = (kind: DerivedKind): DerivedDef => ({ kind, targetKey, accKey });
  return {
    category: "INSPECTION",
    label,
    grouped: true,
    keys: [
      { key: targetKey, label: "Target" },
      { key: accKey, label: "Accomplished" },
      { key: `__variance_${slug}`, label: "Variance", derived: derived("variance") },
      { key: `__positive_${slug}`, label: "Positive Listing", derived: derived("positive") },
      { key: `__pct_${slug}`, label: "%", derived: derived("pct") },
    ],
  };
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    category: "INSPECTION",
    label: "During",
    grouped: false,
    keys: [{ key: "inspectduringcount", label: "During" }],
  },
  {
    category: "INSPECTION",
    label: "After",
    grouped: false,
    keys: [{ key: "inspectaftercount", label: "After" }],
  },
  sectorGroup("BPLO", "monthlytargetbplo", "inspectbplocount"),
  sectorGroup("GOV", "monthlytargetgov", "inspectgovcount"),
  sectorGroup("PEZA", "monthlytargetpeza", "inspectpezacount"),
  sectorGroup("TIEZA", "monthlytargettieza", "inspecttiezacount"),

  {
    category: "FSEC",
    label: "Building",
    grouped: false,
    keys: [{ key: "fsecbuildingcount", label: "Building" }],
  },
  { category: "FSEC", label: "Gov", grouped: false, keys: [{ key: "fsecgovcount", label: "Gov" }] },
  {
    category: "FSEC",
    label: "PEZA",
    grouped: false,
    keys: [{ key: "fsecpezacount", label: "PEZA" }],
  },
  {
    category: "FSEC",
    label: "TIEZA",
    grouped: false,
    keys: [{ key: "fsectiezacount", label: "TIEZA" }],
  },

  {
    category: "FSIC",
    label: "Occupancy",
    grouped: false,
    keys: [{ key: "fsicoccupancycount", label: "Occupancy" }],
  },
  {
    category: "FSIC",
    label: "BPLO New",
    grouped: false,
    keys: [{ key: "fsicbplonewcount", label: "BPLO New" }],
  },
  {
    category: "FSIC",
    label: "BPLO Renew",
    grouped: false,
    keys: [{ key: "fsicbplorenewcount", label: "BPLO Renew" }],
  },
  { category: "FSIC", label: "Gov", grouped: false, keys: [{ key: "fsicgovcount", label: "Gov" }] },
  {
    category: "FSIC",
    label: "PEZA",
    grouped: false,
    keys: [{ key: "fsicpezacount", label: "PEZA" }],
  },
  {
    category: "FSIC",
    label: "TIEZA",
    grouped: false,
    keys: [{ key: "fsictiezacount", label: "TIEZA" }],
  },

  { category: "NOTICES", label: "NOD", grouped: false, keys: [{ key: "nodcount", label: "NOD" }] },
  { category: "NOTICES", label: "NTC", grouped: false, keys: [{ key: "ntccount", label: "NTC" }] },
  {
    category: "NOTICES",
    label: "NON OPERATIONAL",
    grouped: false,
    keys: [{ key: "closedcount", label: "NON OPERATIONAL" }],
  },
  // NTCV / Abatement / Closure are reinspection-only categories and are not
  // part of the inspection & issuance matrix.
];

const COMPLIANCE_FIELDS: {
  key: string;
  label: string;
  category: ComplianceCategory;
  group?: string;
  leafLabel?: string;
  derived?: DerivedDef;
}[] = COLUMN_GROUPS.flatMap((g) =>
  g.keys.map((k) => ({
    key: k.key,
    label: g.grouped ? `${g.label} ${k.label}` : g.label,
    category: g.category,
    group: g.grouped ? g.label : undefined,
    leafLabel: g.grouped ? k.label : undefined,
    derived: k.derived,
  })),
);

/** Derived columns keyed by field key — used by both the modal and the export. */
const DERIVED_BY_KEY = new Map<string, DerivedDef>(
  COMPLIANCE_FIELDS.filter((f) => f.derived).map((f) => [String(f.key), f.derived as DerivedDef]),
);

/** Stored (non-derived) fields — the only keys ever bucketed/aggregated. */
const DATA_FIELDS = COMPLIANCE_FIELDS.filter((f) => !f.derived);

/** Variance / Positive Listing / % — one shared rule set. */
function derivedValue(def: DerivedDef, bucket: Record<string, number> | undefined) {
  const t = num(bucket?.[def.targetKey]);
  const a = num(bucket?.[def.accKey]);
  if (def.kind === "variance") return Math.max(t - a, 0);
  if (def.kind === "positive") return Math.max(a - t, 0);
  return t > 0 ? ((a - t) / t) * 100 : a > 0 ? 100 : 0;
}

/** Value of any leaf (stored or derived) for a given bucket. */
function leafValue(key: string, bucket: Record<string, number> | undefined) {
  const def = DERIVED_BY_KEY.get(key);
  return def ? derivedValue(def, bucket) : num(bucket?.[key]);
}
const isPctKey = (key: string) => DERIVED_BY_KEY.get(key)?.kind === "pct";

const CATEGORY_STYLE: Record<ComplianceCategory, string> = {
  INSPECTION: STYLE.catInsp,
  FSEC: STYLE.catFsec,
  FSIC: STYLE.catFsic,
  NOTICES: STYLE.catNotice,
};

const CATEGORY_SUB_STYLE: Record<ComplianceCategory, string> = {
  INSPECTION: STYLE.catInspSub,
  FSEC: STYLE.catFsecSub,
  FSIC: STYLE.catFsicSub,
  NOTICES: STYLE.catNoticeSub,
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
/** Issuance modes — the API identifies each issuance record by `fsicmode`. */
type IssuanceMode = "MANUAL" | "FSIS";
const ISSUANCE_MODES: { key: IssuanceMode; label: string; fsicmode: number }[] = [
  { key: "MANUAL", label: "MANUAL", fsicmode: 96 },
  { key: "FSIS", label: "FSIS", fsicmode: 97 },
];

/** Inspection fields live on the compliance (month) record, not on issuances. */
const INSPECTION_KEYS = COMPLIANCE_FIELDS.filter((f) => f.category === "INSPECTION").map((f) =>
  String(f.key),
);
/** Every other field comes from an issuance record inside `issuancelist`. */
const ISSUANCE_KEYS = COMPLIANCE_FIELDS.filter((f) => f.category !== "INSPECTION").map((f) =>
  String(f.key),
);
const INSPECTION_KEY_SET = new Set(INSPECTION_KEYS);

type MonthBuckets = Record<number, Record<string, number>>;

interface StationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  cityname: string;
  logoUrl: string;
  /** Combined (MANUAL + FSIS) values — used for provincial totals. */
  months: MonthBuckets;
  /** Per issuance mode values — one matrix row per mode. */
  modeMonths: Record<IssuanceMode, MonthBuckets>;
}
interface ProvinceGroup {
  province: string;
  provinceno: string;
  stations: StationRow[];
  provincialTotal: Record<number, Record<string, number>>;
  /** Provincial totals split per issuance mode — one total row per mode. */
  provincialModeTotal: Record<IssuanceMode, MonthBuckets>;
}

function monthOf(d: string | Date): number {
  if (!d) return 0;
  const s = typeof d === "string" ? d : new Date(d).toISOString();
  const m = Number(s.slice(5, 7));
  return Number.isFinite(m) ? m : 0;
}

const ALL_FIELD_KEYS = COMPLIANCE_FIELDS.map((f) => String(f.key));

function emptyFieldBucket(): Record<string, number> {
  return Object.fromEntries(ALL_FIELD_KEYS.map((k) => [k, 0]));
}

function bucketAt(months: MonthBuckets, month: number): Record<string, number> {
  return (months[month] ??= emptyFieldBucket());
}

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

/**
 * The Export endpoint exposes monthly targets (`monthlytarget*`) while the
 * Ledger endpoint returns per-day targets (`dailytarget*`). The matrix columns
 * are keyed on the monthly names, so fall back to the daily field (summed per
 * month) whenever the monthly one is absent — this keeps the on-screen modal
 * and the Excel export showing identical numbers.
 */
const FIELD_ALIASES: Record<string, string> = {
  monthlytargetbplo: "dailytargetbplo",
  monthlytargetgov: "dailytargetgov",
  monthlytargetpeza: "dailytargetpeza",
  monthlytargettieza: "dailytargettieza",
};

/**
 * Resolve the month of a compliance record. The Export endpoint returns
 * `reportmonth` directly; the Ledger endpoint returns a `dateinspected`.
 */
function complianceMonth(rec: unknown): number {
  const r = rec as { reportmonth?: number; dateinspected?: string | Date };
  const rm = Number(r?.reportmonth ?? 0);
  if (rm >= 1 && rm <= 12) return rm;
  return monthOf(r?.dateinspected ?? "");
}

/**
 * Plot a single compliance (month) record into the per-mode + combined buckets.
 *
 * Inspection counts belong to the month itself, so they are plotted on the
 * MANUAL row. Issuance counts are always located by `fsicmode` — never by
 * array index — so a missing MANUAL or FSIS record simply yields zeros while
 * the row itself is preserved.
 */
function plotComplianceRecord(
  rec: unknown,
  combined: MonthBuckets,
  modeMonths: Record<IssuanceMode, MonthBuckets>,
) {
  const month = complianceMonth(rec);
  if (month < 1 || month > 12) return;

  const source = rec as Record<string, unknown> & { issuancelist?: unknown[] };

  // Ensure the buckets exist for every mode so both rows always render.
  const combinedBucket = bucketAt(combined, month);
  const modeBuckets = ISSUANCE_MODES.map((m) => ({
    mode: m,
    bucket: bucketAt(modeMonths[m.key], month),
  }));

  // Inspection counts — month level, plotted on the MANUAL row.
  const manualBucket = modeBuckets[0].bucket;
  for (const k of INSPECTION_KEYS) {
    const v = num(source[k] ?? source[FIELD_ALIASES[k] ?? ""]);
    manualBucket[k] += v;
    combinedBucket[k] += v;
  }

  const issuances = Array.isArray(source.issuancelist) ? source.issuancelist : [];
  for (const { mode, bucket } of modeBuckets) {
    const issuance = issuances.find(
      (x) => Number((x as { fsicmode?: number })?.fsicmode ?? 0) === mode.fsicmode,
    ) as Record<string, unknown> | undefined;
    for (const k of ISSUANCE_KEYS) {
      const v = issuance ? num(issuance[k]) : 0;
      bucket[k] += v;
      combinedBucket[k] += v;
    }
  }
}

function emptyModeMonths(): Record<IssuanceMode, MonthBuckets> {
  return { MANUAL: {}, FSIS: {} };
}

function buildGroupsFromLedger(rows: FSISComplianceModel[]): ProvinceGroup[] {
  const keys = ALL_FIELD_KEYS;
  const groups: ProvinceGroup[] = [];
  const byProv = new Map<string, ProvinceGroup>();
  for (const st of rows ?? []) {
    const provkey = st.provinceno || st.provincename || "";
    let g = byProv.get(provkey);
    if (!g) {
      const created: ProvinceGroup = {
        province: st.provincename ?? "",
        provinceno: st.provinceno ?? "",
        stations: [],
        provincialTotal: {},
        provincialModeTotal: emptyModeMonths(),
      };
      g = created;
      byProv.set(provkey, created);
      groups.push(created);
    }
    const months: MonthBuckets = {};
    const modeMonths = emptyModeMonths();
    for (const rec of st.compliancelist ?? []) {
      plotComplianceRecord(rec, months, modeMonths);
    }
    g.stations.push({
      stationno: st.stationno,
      stationcode: st.stationcode,
      stationname: st.stationname,
      provinceno: st.provinceno,
      province: st.provincename,
      cityname: (st as unknown as { cityname?: string }).cityname ?? "",
      logoUrl: st.logourl ?? "",
      months,
      modeMonths,
    });
    // Accumulate provincial totals.
    for (const mn of Object.keys(months)) {
      const m = Number(mn);
      const dst = (g.provincialTotal[m] ??= Object.fromEntries(keys.map((k) => [k, 0])));
      for (const k of keys) dst[k] += months[m][k] ?? 0;
    }
    for (const mode of ISSUANCE_MODES) {
      const src = modeMonths[mode.key];
      const dstMonths = g.provincialModeTotal[mode.key];
      for (const mn of Object.keys(src)) {
        const m = Number(mn);
        const dst = (dstMonths[m] ??= Object.fromEntries(keys.map((k) => [k, 0])));
        for (const k of keys) dst[k] += src[m][k] ?? 0;
      }
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

export default function ComplianceMatrixTable({
  open,
  onOpenChange,
  initialFilters,
  readOnly = false,
}: Props) {
  const { user, systemAccess } = useAuth();
  const scope = React.useMemo(
    () => resolveTargetScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );
  const currentYear = new Date().getFullYear();
  const YEARS = React.useMemo(buildYears, []);

  const [year, setYear] = React.useState<number>(initialFilters?.year ?? currentYear);
  const [provinceFilters, setProvinceFilters] = React.useState<SelectedLocation[]>(
    scope.provinceLocked
      ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
      : initialFilters?.provinceno
        ? [
            {
              locationno: initialFilters.provinceno,
              locationname: initialFilters.provinceName ?? "",
            },
          ]
        : [],
  );
  const [stationFilters, setStationFilters] = React.useState<SelectedStation[]>(
    scope.stationLocked
      ? [
          {
            stationno: scope.stationno,
            stationname: scope.stationname,
            provinceno: scope.provinceno,
            provincename: scope.provincename,
          },
        ]
      : initialFilters?.stationno
        ? [
            {
              stationno: initialFilters.stationno,
              stationname: initialFilters.stationName ?? "",
              provinceno: initialFilters?.provinceno ?? "",
              provincename: initialFilters?.provinceName ?? "",
            },
          ]
        : [],
  );

  React.useEffect(() => {
    if (!open) return;
    setYear(initialFilters?.year ?? currentYear);
    setProvinceFilters(
      scope.provinceLocked
        ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
        : initialFilters?.provinceno
          ? [
              {
                locationno: initialFilters.provinceno,
                locationname: initialFilters.provinceName ?? "",
              },
            ]
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
        : initialFilters?.stationno
          ? [
              {
                stationno: initialFilters.stationno,
                stationname: initialFilters.stationName ?? "",
                provinceno: initialFilters?.provinceno ?? "",
                provincename: initialFilters?.provinceName ?? "",
              },
            ]
          : [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialFilters?.year, initialFilters?.provinceno, initialFilters?.stationno]);

  const [groups, setGroups] = React.useState<ProvinceGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const fields = COMPLIANCE_FIELDS;
  const fieldKeys = React.useMemo(() => fields.map((f) => String(f.key)), [fields]);
  const catSpan = fields.length;
  const categoryRuns = React.useMemo(computeCategoryRuns, []);

  // Province/Station cross-sync — same rules used by TargetMatrix filters.
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
    const seen = new Map<string, SelectedLocation>();
    next.forEach((s) => {
      if (!s.provinceno || seen.has(s.provinceno)) return;
      seen.set(s.provinceno, { locationno: s.provinceno, locationname: s.provincename });
    });
    const derived = Array.from(seen.values());
    // Merge derived provinces from station picks with any provinces the user
    // already selected explicitly (so picking a station never removes a
    // manually-selected province).
    setProvinceFilters((prev) => {
      const merged = [...prev];
      const known = new Set(prev.map((p) => p.locationno));
      derived.forEach((d) => {
        if (!known.has(d.locationno)) {
          merged.push(d);
          known.add(d.locationno);
        }
      });
      if (merged.length === prev.length) return prev;
      return merged;
    });
  };

  // Fetch full-year matrix data from the FSISCompliance Ledger endpoint in a
  // single call (all 12 months), then bucket each station's daily records by
  // month for the on-screen matrix.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const ledgerResp = await complianceAPI.getLedger(
        {
          parameters: {
            searchkey: "",
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
      const ledger = unwrap<FSISComplianceModel[]>(ledgerResp);
      if (cancelled) return;
      if (!ledger.ok) {
        toast.error(ledger.error || "Unable to load matrix.");
        setGroups([]);
        setLoading(false);
        return;
      }
      const stations = Array.isArray(ledger.data) ? ledger.data : [];
      setGroups(buildGroupsFromLedger(stations));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, year]);

  // Client-side view filter driven by the multi-selects.
  const filteredGroups = React.useMemo<ProvinceGroup[]>(() => {
    const provSet = new Set(provinceFilters.map((p) => p.locationno));
    const stnSet = new Set(stationFilters.map((s) => s.stationno));
    return groups
      .filter((g) => provSet.size === 0 || provSet.has(g.provinceno))
      .map((g) => ({
        ...g,
        stations:
          stnSet.size === 0 ? g.stations : g.stations.filter((s) => stnSet.has(s.stationno)),
      }))
      .filter((g) => g.stations.length > 0);
  }, [groups, provinceFilters, stationFilters]);

  const handleExport = async () => {
    if (!year) {
      toast.error("Please select a year.");
      return;
    }

    const sourceGroups = filteredGroups.length > 0 ? filteredGroups : groups;
    const provinceMap = new Map<string, { provinceno: string; stationnos: Set<string> }>();
    for (const g of sourceGroups) {
      const key = g.provinceno || g.province;
      const entry = provinceMap.get(key) ?? {
        provinceno: g.provinceno,
        stationnos: new Set<string>(),
      };
      for (const s of g.stations) entry.stationnos.add(s.stationno);
      provinceMap.set(key, entry);
    }
    const provincesPayload = Array.from(provinceMap.values())
      .filter((p) => p.stationnos.size > 0)
      .map((p) => ({ provinceno: p.provinceno, stationnos: Array.from(p.stationnos) }));

    if (provincesPayload.length === 0) {
      toast.error("Please select at least one province and station.");
      return;
    }

    setExporting(true);
    try {
      const exportResp = await complianceAPI.export({
        searchkey: "",
        reportyear: Number(year),
        provinces: provincesPayload,
      });

      const stationMap = new Map<
        string,
        {
          stationno: string;
          stationCode: string;
          stationName: string;
          cityName: string;
          province: string;
          months: MonthBuckets;
          modeMonths: Record<IssuanceMode, MonthBuckets>;
        }
      >();

      const { ok, data } = unwrap<ProvinceIssuanceExportModel[] | FSISComplianceModel[]>(
        exportResp,
      );
      if (ok && Array.isArray(data)) {
        // The Export endpoint returns province groups; tolerate a flat station
        // list as well.
        const stationList: FSISComplianceModel[] = [];
        for (const entry of data as (ProvinceIssuanceExportModel & FSISComplianceModel)[]) {
          if (Array.isArray(entry?.stations)) {
            for (const st of entry.stations) {
              stationList.push({
                ...st,
                provincename: st.provincename || entry.provincename || "",
                provinceno: st.provinceno || entry.provinceno || "",
              });
            }
          } else if (entry?.stationno) {
            stationList.push(entry);
          }
        }

        // Respect the on-screen filters: the API may return more stations than
        // were requested, so keep only the stations currently in scope.
        const allowedStations = new Set(
          provincesPayload.flatMap((p) => p.stationnos).filter(Boolean),
        );
        for (const s of stationList) {
          if (allowedStations.size > 0 && s.stationno && !allowedStations.has(s.stationno))
            continue;
          const key = s.stationno || `${s.stationcode ?? ""}-${s.stationname ?? ""}`;

          const entry = stationMap.get(key) ?? {
            stationno: s.stationno,
            stationCode: s.stationcode ?? "",
            stationName: s.stationname ?? "",
            cityName: (s as unknown as { cityname?: string }).cityname ?? "",
            province: s.provincename || s.provinceno || "",
            months: {} as MonthBuckets,
            modeMonths: emptyModeMonths(),
          };

          // station → compliancelist (12 months, keyed by `reportmonth`)
          //         → issuancelist (located by `fsicmode`, never by index)
          for (const rec of Array.isArray(s.compliancelist) ? s.compliancelist : []) {
            plotComplianceRecord(rec, entry.months, entry.modeMonths);
          }

          stationMap.set(key, entry);
        }
      }

      // Two worksheet rows per station — MANUAL then FSIS.
      const mergedMap = Array.from(stationMap.values())
        .sort((a, b) => (a.stationCode || "").localeCompare(b.stationCode || ""))
        .reduce<Map<string, ComplianceExportStation[]>>((groupsByProvince, station) => {
          const provinceName = station.province || "Unknown Province";
          const bucket = groupsByProvince.get(provinceName) ?? [];
          bucket.push({
            stationno: station.stationno,
            stationCode: station.stationCode,
            stationName: station.stationName,
            cityName: station.cityName,
            months: station.months,
            modes: ISSUANCE_MODES.map((mode) => ({
              label: mode.label,
              months: station.modeMonths[mode.key],
            })),
          });
          groupsByProvince.set(provinceName, bucket);
          return groupsByProvince;
        }, new Map());
      const merged = Array.from(mergedMap.entries())
        .map(([province, stations]) => ({
          province,
          stations,
        }))
        .sort((a, b) => (a.province || "").localeCompare(b.province || ""));

      // Fallback — if the Export endpoint returns nothing, mirror exactly what
      // the on-screen matrix is showing so both stay in sync.
      const exportGroups = merged.some((g) => g.stations.length > 0)
        ? merged
        : sourceGroups.map((g) => ({
            province: g.province || "Unknown Province",
            stations: g.stations.map((s) => ({
              stationno: s.stationno,
              stationCode: s.stationcode,
              stationName: s.stationname,
              cityName: s.cityname,
              months: s.months,
              modes: ISSUANCE_MODES.map((mode) => ({
                label: mode.label,
                months: s.modeMonths[mode.key],
              })),
            })),
          }));

      const flatFields = COMPLIANCE_FIELDS.map((f) => ({
        key: String(f.key),
        label: f.label,
        category: f.category,
        group: f.group,
        leafLabel: f.leafLabel,
        derived: f.derived,
      }));

      await exportComplianceMatrix({
        year,
        groups: exportGroups,
        fields: flatFields,
        signatory: {
          rank:
            (user as unknown as { rankcode?: string; rankname?: string })?.rankcode ??
            (user as unknown as { rankname?: string })?.rankname ??
            "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: (user as unknown as { designation?: string })?.designation ?? "",
        },
        filename: `ComplianceMatrix_${year}.xlsx`,
      });
      toast.success("Compliance Matrix exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Compliance Matrix.");
    } finally {
      setExporting(false);
    }
  };

  const totalCols = 2 + 12 * catSpan + 4 * catSpan + catSpan + catSpan + catSpan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
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

        {/* Filters — mirrors the ledger filter bar */}
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
                disabled={readOnly}
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
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              {readOnly ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {provinceFilters.length === 0
                    ? "ALL"
                    : provinceFilters.length === 1
                      ? provinceFilters[0].locationname
                      : `${provinceFilters.length} selected`}
                </div>
              ) : scope.provinceLocked ? (
                <ReadOnlyField
                  value={provinceFilters[0]?.locationname || scope.provincename}
                  placeholder="Select province"
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
              {readOnly ? (
                <div className="h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center text-muted-foreground">
                  {stationFilters.length === 0
                    ? "ALL"
                    : stationFilters.length === 1
                      ? stationFilters[0].stationname
                      : `${stationFilters.length} selected`}
                </div>
              ) : scope.stationLocked ? (
                <ReadOnlyField
                  value={stationFilters[0]?.stationname || scope.stationname}
                  placeholder="Select station"
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
            {!readOnly && (
              <div className="flex items-end justify-end md:col-span-2 lg:col-span-1">
                <ResetFiltersButton
                  onReset={() => {
                    setYear(initialFilters?.year ?? currentYear);
                    setProvinceFilters(
                      scope.provinceLocked
                        ? [{ locationno: scope.provinceno, locationname: scope.provincename }]
                        : initialFilters?.provinceno
                          ? [
                              {
                                locationno: initialFilters.provinceno,
                                locationname: initialFilters.provinceName ?? "",
                              },
                            ]
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
                        : initialFilters?.stationno
                          ? [
                              {
                                stationno: initialFilters.stationno,
                                stationname: initialFilters.stationName ?? "",
                                provinceno: initialFilters?.provinceno ?? "",
                                provincename: initialFilters?.provinceName ?? "",
                              },
                            ]
                          : [],
                    );
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
              {!loading && filteredGroups.length === 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="border-b bg-card px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No compliance data for {year}.
                  </td>
                </tr>
              )}
              {!loading &&
                filteredGroups.map((g) => (
                  <ProvinceBlock
                    key={g.province}
                    group={g}
                    totalCols={totalCols}
                    fieldKeys={fieldKeys}
                    year={Number(year)}
                    onDrill={() => {}}
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
  fields: { key: string | number; label: string; category?: ComplianceCategory }[];
  catSpan: number;
}) {
  const CATS = computeCategoryRuns().map((r) => ({
    label: r.category === "NOTICES" ? "ISSUED NOTICES" : r.category,
    span: r.end - r.start + 1,
    cls: CATEGORY_STYLE[r.category],
  }));
  return (
    <thead className="sticky top-0 z-30">
      <tr>
        <th
          rowSpan={5}
          className={`sticky left-0 top-0 z-40 min-w-[240px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Station
        </th>
        <th
          rowSpan={5}
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
            CATS.map((c, ci) => (
              <th
                key={`cat-${mv}-${c.label}`}
                colSpan={c.span}
                className={`border-b px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wider ${
                  ci === CATS.length - 1 && monthIdx === 2
                    ? "border-r-2 border-r-white/30"
                    : "border-r"
                } ${c.cls}`}
              >
                {c.label}
              </th>
            )),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          CATS.map((c, ci) => (
            <th
              key={`cat-total-${grpIdx}-${c.label}`}
              colSpan={c.span}
              className={`border-b px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wider ${
                ci === CATS.length - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${c.cls}`}
            >
              {c.label}
            </th>
          )),
        )}
      </tr>
      {/* Sub-group row — DURING/AFTER span both rows, 1ST BPLO/GOV/PEZA/TIEZA split into Target/Issuance */}
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.flatMap((mv, monthIdx) =>
            COLUMN_GROUPS.map((g, gi) => (
              <th
                key={`g-${mv}-${g.category}-${g.label}`}
                colSpan={g.grouped ? g.keys.length : undefined}
                rowSpan={g.grouped ? undefined : 2}
                className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                  gi === COLUMN_GROUPS.length - 1 && monthIdx === 2
                    ? "border-r-2 border-r-emerald-800/60"
                    : "border-r"
                } ${CATEGORY_SUB_STYLE[g.category]}`}
              >
                {g.label}
              </th>
            )),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          COLUMN_GROUPS.map((g, gi) => (
            <th
              key={`g-final-${grpIdx}-${g.category}-${g.label}`}
              colSpan={g.grouped ? g.keys.length : undefined}
              rowSpan={g.grouped ? undefined : 2}
              className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase ${
                gi === COLUMN_GROUPS.length - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${CATEGORY_SUB_STYLE[g.category]}`}
            >
              {g.label}
            </th>
          )),
        )}
      </tr>
      {/* Leaf row — only Target/Issuance pairs live here */}
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.flatMap((mv) =>
            COLUMN_GROUPS.filter((g) => g.grouped).flatMap((g) =>
              g.keys.map((k) => (
                <th
                  key={`l-${mv}-${k.key}`}
                  className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-bold uppercase ${CATEGORY_SUB_STYLE[g.category]}`}
                >
                  {k.label}
                </th>
              )),
            ),
          ),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((grpIdx) =>
          COLUMN_GROUPS.filter((g) => g.grouped).flatMap((g) =>
            g.keys.map((k) => (
              <th
                key={`l-final-${grpIdx}-${k.key}`}
                className={`border-b border-r px-1.5 py-1 text-center text-[10px] font-bold uppercase ${CATEGORY_SUB_STYLE[g.category]}`}
              >
                {k.label}
              </th>
            )),
          ),
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
          colSpan={2}
          className={`sticky left-0 z-10 border-b border-t-2 border-t-slate-400/60 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] ${STYLE.provHeaderRow}`}
        >
          {group.province}
        </td>
        <td
          colSpan={totalCols - 2}
          aria-hidden="true"
          className="border-b border-t-2 border-grid-strong group-row"
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
        modeMonths={group.provincialModeTotal}
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
  rowSpan,
  pct,
}: {
  value: number;
  onClick?: () => void;
  bold?: boolean;
  boundary?: boolean;
  rowClass?: string;
  rowSpan?: number;
  pct?: boolean;
}) {
  const base = `border-b px-2 py-1.5 text-center tabular-nums ${
    boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
  } ${bold ? "font-bold" : ""} ${value === 0 && !bold ? "text-muted-foreground/60" : ""} ${rowClass ?? ""}`;
  const text = pct
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
    : value.toLocaleString();
  if (onClick) {
    return (
      <td
        rowSpan={rowSpan}
        className={`${base} cursor-pointer hover:bg-primary/10`}
        onClick={onClick}
        title="Open monthly details"
      >
        {text}
      </td>
    );
  }
  return (
    <td rowSpan={rowSpan} className={base}>
      {text}
    </td>
  );
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
  const rowBg = zebra ? "bg-muted" : "bg-card";
  // Two rows per station — always MANUAL (fsicmode 96) first, FSIS (97) second.
  // INSPECTION columns belong to the month itself, so they are merged (rowSpan 2)
  // across both mode rows; only FSEC/FSIC/NOTICES split per mode.
  const combinedAgg = computeAgg(station.months, fieldKeys);
  return (
    <>
      {ISSUANCE_MODES.map((mode, mi) => {
        const months = station.modeMonths[mode.key] ?? {};
        const agg = computeAgg(months, fieldKeys);
        return (
          <tr key={`${station.stationno}-${mode.key}`} className={rowBg}>
            {mi === 0 ? (
              <td rowSpan={2} className={`sticky left-0 z-10 border-b border-r px-3 py-2 ${rowBg}`}>
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
            ) : null}
            <td
              className={`sticky left-[240px] z-10 border-b border-r px-3 py-2 text-center text-[11px] font-semibold uppercase ${rowBg}`}
            >
              {mode.label}
            </td>

            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
              const bucket = months[mv];
              const combinedBucket = station.months[mv];
              const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
              return fieldKeys.map((k, i) => {
                if (INSPECTION_KEY_SET.has(k)) {
                  if (mi !== 0) return null;
                  return (
                    <DrillCell
                      key={`${station.stationno}-insp-${mv}-${k}`}
                      value={leafValue(k, combinedBucket)}
                      pct={isPctKey(k)}
                      rowSpan={2}
                      boundary={i === fieldKeys.length - 1 && quarterEnd}
                    />
                  );
                }
                return (
                  <DrillCell
                    key={`${station.stationno}-${mode.key}-${mv}-${k}`}
                    value={leafValue(k, bucket)}
                    pct={isPctKey(k)}
                    boundary={i === fieldKeys.length - 1 && quarterEnd}
                  />
                );
              });
            })}
            {(["q1", "q2", "q3", "q4", "sem1", "sem2", "annual"] as const).map((grp) =>
              fieldKeys.map((k, i) => {
                if (INSPECTION_KEY_SET.has(k)) {
                  if (mi !== 0) return null;
                  return (
                    <DrillCell
                      key={`${station.stationno}-insp-${grp}-${k}`}
                      value={leafValue(k, combinedAgg[grp])}
                      pct={isPctKey(k)}
                      rowSpan={2}
                      bold
                      boundary={i === fieldKeys.length - 1}
                    />
                  );
                }
                return (
                  <DrillCell
                    key={`${station.stationno}-${mode.key}-${grp}-${k}`}
                    value={leafValue(k, agg[grp])}
                    pct={isPctKey(k)}
                    bold
                    boundary={i === fieldKeys.length - 1}
                  />
                );
              }),
            )}
          </tr>
        );
      })}
    </>
  );
}

function ProvincialTotalRow({
  months,
  province,
  fieldKeys,
}: {
  months: Record<number, Record<string, number>>;
  modeMonths?: Record<IssuanceMode, MonthBuckets>;
  province: string;
  fieldKeys: string[];
}) {
  // Single total row — MANUAL and FSIS are combined into one line.
  const combinedAgg = computeAgg(months, fieldKeys);
  return (
    <tr key={`pt-${province}`}>
      <td
        className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-[11px] uppercase tracking-wider ${STYLE.provTotalRow}`}
      >
        Provincial Total — {province}
      </td>
      <td
        className={`sticky left-[240px] z-10 border-b border-r px-3 py-2 text-center text-[11px] font-bold uppercase ${STYLE.provTotalRow}`}
      >
        MANUAL + FSIS
      </td>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((mv) => {
        const cb = months[mv] ?? {};
        const quarterEnd = mv === 3 || mv === 6 || mv === 9 || mv === 12;
        return fieldKeys.map((k, i) => (
          <DrillCell
            key={`pt-${province}-${mv}-${k}`}
            value={leafValue(k, cb)}
            pct={isPctKey(k)}
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
            value={leafValue(k, combinedAgg[grp])}
            pct={isPctKey(k)}
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
void buildGroupsFromLedger;
void DATA_FIELDS;
