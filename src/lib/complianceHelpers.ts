/**
 * Pure helpers for the compliance monthly monitoring workflow.
 *
 * Every monthly / quarterly / semester / annual / province total is derived
 * from raw daily rows — never persisted. Keep this module free of React,
 * network, and store internals so it can be reused server-side later.
 */
import type {
  ComplianceCategoryBucket,
  ComplianceDailyCounts,
  ComplianceCategoryKey,
  ComplianceMatrixProvinceGroup,
  ComplianceMatrixStationRow,
} from "@/types/complianceType";

import { EMPTY_GUID } from "@/lib/fsims-constants";

/** Field definitions per category — drives table columns, matrix columns, and totals. */
export const CATEGORY_FIELDS: Record<
  ComplianceCategoryKey,
  {
    key: keyof ComplianceDailyCounts | "insp_total" | "fsec_total" | "fsic_total" | "not_total";
    label: string;
  }[]
> = {
  INSPECTION: [
    { key: "insp_during", label: "During" },
    { key: "insp_after", label: "After" },
    { key: "insp_bplo", label: "BPLO" },
    { key: "insp_gov", label: "GOV" },
    { key: "insp_peza", label: "PEZA" },
    { key: "insp_tieza", label: "TIEZA" },
  ],
  FSEC: [
    { key: "fsec_building", label: "Building" },
    { key: "fsec_gov", label: "Gov" },
    { key: "fsec_peza", label: "PEZA" },
    { key: "fsec_tieza", label: "TIEZA" },
  ],
  FSIC: [
    { key: "fsic_occupancy", label: "Occupancy" },
    { key: "fsic_bplo_new", label: "BPLO New" },
    { key: "fsic_bplo_renewal", label: "BPLO Renew" },
    { key: "fsic_gov", label: "Gov" },
    { key: "fsic_peza", label: "PEZA" },
    { key: "fsic_tieza", label: "TIEZA" },
  ],
  // NTCV / Abatement / Closure are reinspection-only categories.
  NOTICES: [
    { key: "not_nod", label: "NOD" },
    { key: "not_ntc", label: "NTC" },
  ],

  OVERALL: [
    { key: "insp_total", label: "Inspection" },
    { key: "fsec_total", label: "FSEC" },
    { key: "fsic_total", label: "FSIC" },
    { key: "not_total", label: "Issued Notices" },
  ],
};

export const INSPECTION_FIELDS = [
  "insp_during",
  "insp_after",
  "insp_bplo",
  "insp_gov",
  "insp_peza",
  "insp_tieza",
] as const;
export const FSEC_FIELDS = ["fsec_building", "fsec_gov", "fsec_peza", "fsec_tieza"] as const;
export const FSIC_FIELDS = [
  "fsic_occupancy",
  "fsic_bplo_new",
  "fsic_bplo_renewal",
  "fsic_gov",
  "fsic_peza",
  "fsic_tieza",
] as const;
/** Inspection-side notices only — NTCV / Abatement / Closure belong to reinspection. */
export const NOTICES_FIELDS = ["not_nod", "not_ntc"] as const;

export const ALL_NUMERIC_FIELDS = [
  ...INSPECTION_FIELDS,
  ...FSEC_FIELDS,
  ...FSIC_FIELDS,
  ...NOTICES_FIELDS,
] as const;

export function calendarDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * A record key (fsisno / noticeno / targetno) counts as a real record only when
 * it is a non-empty, non-default GUID.
 */
export function isValidRecordId(value: unknown): boolean {
  const id = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!id) return false;
  if (id === EMPTY_GUID) return false;
  if (/^0[-0]*$/.test(id)) return false;
  return true;
}

/**
 * Normalize any date-ish value to `yyyy-mm-dd`, or "" when unusable.
 *
 * Accepts `Date`, ISO strings (`2026-09-01T00:00:00Z`) and `MM/DD/YYYY`.
 * ISO strings are read as calendar text (never re-parsed through `Date`) so a
 * UTC timestamp can never shift the day by the browser timezone. Sentinel
 * "no date" values (any year <= 1900, e.g. 1899-12-30 / 1900-01-01) return "".
 */
export function normalizeDayKey(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const y = value.getFullYear();
    if (y <= 1900) return "";
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  if (!raw) return "";

  let iso = "";
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    iso = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else {
    // MM/DD/YYYY (the format the API expects/emits for date filters).
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!slash) return "";
    iso = `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  }

  const [y, m, d] = iso.split("-").map(Number);
  if (y <= 1900 || m < 1 || m > 12 || d < 1) return "";
  // Reject impossible days (e.g. Feb 30) — leap-year aware.
  if (d > calendarDaysInMonth(y, m)) return "";
  return iso;
}

/**
 * Shared "day has actual data" rule: a calendar date is counted once when at
 * least one of its records has a valid record id OR a non-zero actual count.
 * Targets never make a day count.
 *
 * `allowedDays` (optional) restricts counting to a known set of `yyyy-mm-dd`
 * keys — the calendar days of the browsed period — so records from other
 * months/days can never push the badge above its denominator.
 */
export function countDaysWithData<T>(
  rows: readonly T[] | null | undefined,
  getDate: (row: T) => unknown,
  hasData: (row: T) => boolean,
  allowedDays?: ReadonlySet<string> | null,
): number {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    const key = normalizeDayKey(getDate(row));
    if (!key) continue;
    if (allowedDays && !allowedDays.has(key)) continue;
    if (!hasData(row)) continue;
    set.add(key);
  }
  return set.size;
}

/** Every `yyyy-mm-dd` key of the given months in a year (leap-year aware). */
export function calendarDayKeys(year: number, months: readonly number[]): Set<string> {
  const out = new Set<string>();
  for (const m of months) {
    if (!m || m < 1 || m > 12) continue;
    const total = calendarDaysInMonth(year, m);
    for (let d = 1; d <= total; d++) {
      out.add(`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }
  return out;
}

/** COUNT(DISTINCT dateinspected) across rows that carry actual recorded data. */
export function daysEncoded(rows: ComplianceDailyCounts[]): number {
  return countDaysWithData(
    rows,
    (r) => r.dateinspected,
    (r) =>
      isValidRecordId(r.fsisno) || ALL_NUMERIC_FIELDS.some((f) => (Number(r[f] ?? 0) || 0) !== 0),
  );
}

/** Sum a group of fields across many daily rows. */
export function sumFields(
  rows: ComplianceDailyCounts[],
  fields: readonly (keyof ComplianceDailyCounts)[],
): number {
  let total = 0;
  for (const r of rows) {
    for (const f of fields) {
      total += Number(r[f] ?? 0) || 0;
    }
  }
  return total;
}

export function inspectionTotal(rows: ComplianceDailyCounts[]): number {
  return sumFields(rows, INSPECTION_FIELDS);
}
export function fsecTotal(rows: ComplianceDailyCounts[]): number {
  return sumFields(rows, FSEC_FIELDS);
}
export function fsicTotal(rows: ComplianceDailyCounts[]): number {
  return sumFields(rows, FSIC_FIELDS);
}
export function noticesTotal(rows: ComplianceDailyCounts[]): number {
  return sumFields(rows, NOTICES_FIELDS);
}

export function bucketFor(rows: ComplianceDailyCounts[]): ComplianceCategoryBucket {
  return {
    inspection: inspectionTotal(rows),
    fsec: fsecTotal(rows),
    fsic: fsicTotal(rows),
    notices: noticesTotal(rows),
  };
}

export function breakdownFor(rows: ComplianceDailyCounts[]) {
  return {
    inspection: Object.fromEntries(
      INSPECTION_FIELDS.map((key) => [key, sumFields(rows, [key])]),
    ) as Record<string, number>,
    fsec: Object.fromEntries(FSEC_FIELDS.map((key) => [key, sumFields(rows, [key])])) as Record<
      string,
      number
    >,
    fsic: Object.fromEntries(FSIC_FIELDS.map((key) => [key, sumFields(rows, [key])])) as Record<
      string,
      number
    >,
    notices: Object.fromEntries(
      NOTICES_FIELDS.map((key) => [key, sumFields(rows, [key])]),
    ) as Record<string, number>,
  };
}

/** Parse `yyyy-mm-dd` into `{year, month, day}`. */
export function parseISODate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso
    .slice(0, 10)
    .split("-")
    .map((n) => Number(n));
  return { year: y, month: m, day: d };
}

export function isSameMonth(iso: string, year: number, month: number): boolean {
  const p = parseISODate(iso);
  return p.year === year && p.month === month;
}

/**
 * Build a simple inspection subcategory map for a single daily row.
 * Returns object shaped like:
 * {
 *   BPLO: { target, firstInspection, reInspection },
 *   GOV: { ... },
 *   PEZA: { ... },
 *   TIEZA: { ... }
 * }
 */
export function inspectionSubcategories(row: ComplianceDailyCounts | null | undefined) {
  const r = row ?? ({} as ComplianceDailyCounts);
  return {
    BPLO: {
      target: Number(r.dailytargetbplo ?? 0) || 0,
      firstInspection: Number(r.inspectbplocount ?? 0) || 0,
      reInspection: Number(r.reinspectbplocount ?? 0) || 0,
    },
    GOV: {
      target: Number(r.dailytargetgov ?? 0) || 0,
      firstInspection: Number(r.inspectgovcount ?? 0) || 0,
      reInspection: Number(r.reinspectgovcount ?? 0) || 0,
    },
    PEZA: {
      target: Number(r.dailytargetpeza ?? 0) || 0,
      firstInspection: Number(r.inspectpezacount ?? 0) || 0,
      reInspection: Number(r.reinspectpezacount ?? 0) || 0,
    },
    TIEZA: {
      target: Number(r.dailytargettieza ?? 0) || 0,
      firstInspection: Number(r.inspecttiezacount ?? 0) || 0,
      reInspection: Number(r.reinspecttiezacount ?? 0) || 0,
    },
  };
}

/** Group live (non-deleted) rows by `${stationno}|${year}|${month}`. */
export function groupByStationMonth(
  rows: ComplianceDailyCounts[],
): Map<string, ComplianceDailyCounts[]> {
  const out = new Map<string, ComplianceDailyCounts[]>();
  for (const r of rows) {
    if (r.deletedat) continue;
    const p = parseISODate(r.dateinspected);
    const key = `${r.stationno}|${p.year}|${p.month}`;
    const arr = out.get(key) ?? [];
    arr.push(r);
    out.set(key, arr);
  }
  return out;
}

export function fieldsForCategory(
  cat: ComplianceCategoryKey,
): readonly (keyof ComplianceDailyCounts)[] {
  switch (cat) {
    case "INSPECTION":
      return INSPECTION_FIELDS;
    case "FSEC":
      return FSEC_FIELDS;
    case "FSIC":
      return FSIC_FIELDS;
    case "NOTICES":
      return NOTICES_FIELDS;
    case "OVERALL":
      return ALL_NUMERIC_FIELDS;
  }
}

/** Aggregate matrix data into { province → stations × months × field-values }. */
export function buildMatrix(
  rows: ComplianceDailyCounts[],
  category: ComplianceCategoryKey,
): ComplianceMatrixProvinceGroup[] {
  const fields = CATEGORY_FIELDS[category];
  const live = rows.filter((r) => !r.deletedat);

  const stationMap = new Map<string, ComplianceMatrixStationRow>();
  for (const r of live) {
    let st = stationMap.get(r.stationno);
    if (!st) {
      const months: Record<number, Record<string, number>> = {};
      for (let m = 1; m <= 12; m++) {
        months[m] = Object.fromEntries(fields.map((f) => [f.key, 0]));
      }
      st = {
        stationno: r.stationno,
        stationcode: r.stationcode,
        stationname: r.stationname,
        provinceno: r.provinceno,
        province: r.provincename,
        logoUrl: "",
        months,
      };
      stationMap.set(r.stationno, st);
    }
    const p = parseISODate(r.dateinspected);
    const bucket = st.months[p.month];
    for (const f of fields) {
      if (f.key === "insp_total")
        bucket[f.key] += INSPECTION_FIELDS.reduce((s, k) => s + Number(r[k] ?? 0), 0);
      else if (f.key === "fsec_total")
        bucket[f.key] += FSEC_FIELDS.reduce((s, k) => s + Number(r[k] ?? 0), 0);
      else if (f.key === "fsic_total")
        bucket[f.key] += FSIC_FIELDS.reduce((s, k) => s + Number(r[k] ?? 0), 0);
      else if (f.key === "not_total")
        bucket[f.key] += NOTICES_FIELDS.reduce((s, k) => s + Number(r[k] ?? 0), 0);
      else bucket[f.key] += Number(r[f.key as keyof ComplianceDailyCounts] ?? 0) || 0;
    }
  }

  const byProvince = new Map<string, ComplianceMatrixStationRow[]>();
  stationMap.forEach((s) => {
    const arr = byProvince.get(s.province) ?? [];
    arr.push(s);
    byProvince.set(s.province, arr);
  });

  const order = Array.from(byProvince.keys()).sort();
  return order.map<ComplianceMatrixProvinceGroup>((province) => {
    const stations = (byProvince.get(province) ?? []).sort((a, b) =>
      a.stationname.localeCompare(b.stationname),
    );
    const totals: Record<number, Record<string, number>> = {};
    for (let m = 1; m <= 12; m++) {
      totals[m] = Object.fromEntries(fields.map((f) => [f.key, 0]));
    }
    stations.forEach((s) => {
      for (let m = 1; m <= 12; m++) {
        for (const f of fields) {
          totals[m][f.key] += s.months[m][f.key];
        }
      }
    });
    return {
      province,
      provinceno: stations[0]?.provinceno ?? "",
      stations,
      provincialTotal: totals,
    };
  });
}

/** Sum a per-month bucket record across an array of month numbers. */
export function sumMonths(
  months: Record<number, Record<string, number>>,
  monthList: number[],
  fieldKeys: string[],
): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(fieldKeys.map((k) => [k, 0]));
  for (const m of monthList) {
    for (const k of fieldKeys) {
      out[k] += months[m]?.[k] ?? 0;
    }
  }
  return out;
}

/** Sum every field within a bucket to a single scalar (used for drill-down cells). */
export function bucketScalar(bucket: Record<string, number>): number {
  let sum = 0;
  for (const v of Object.values(bucket)) sum += v;
  return sum;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/* ---------------------------------------------------------------------------
 * Report Matrix (Target | Actual)
 *
 * Extends `buildMatrix` output so every field carries BOTH a target and an
 * actual value. Both come from the live compliance rows: actuals from the
 * inspection/issuance counts, targets from the API `dailytarget*` fields.
 * Fields with no target column in the API report a target of 0.
 * ------------------------------------------------------------------------ */

export interface TargetActualCell {
  target: number;
  actual: number;
}

export interface ReportMatrixStationRow {
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  province: string;
  logoUrl: string;
  /** month (1-12) -> field key -> { target, actual } */
  months: Record<number, Record<string, TargetActualCell>>;
}

export interface ReportMatrixProvinceGroup {
  province: string;
  provinceno: string;
  stations: ReportMatrixStationRow[];
  provincialTotal: Record<number, Record<string, TargetActualCell>>;
}

/** UI field key -> API target field(s) that back it. */
const TARGET_SOURCES: Record<string, readonly (keyof ComplianceDailyCounts)[]> = {
  insp_bplo: ["dailytargetbplo"],
  insp_gov: ["dailytargetgov"],
  insp_peza: ["dailytargetpeza"],
  insp_tieza: ["dailytargettieza"],
  insp_total: ["dailytargetbplo", "dailytargetgov", "dailytargetpeza", "dailytargettieza"],
};

export function buildReportMatrix(
  rows: ComplianceDailyCounts[],
  category: ComplianceCategoryKey,
): ReportMatrixProvinceGroup[] {
  const base = buildMatrix(rows, category);
  const fields = CATEGORY_FIELDS[category];
  const fieldKeys = fields.map((f) => String(f.key));

  // stationno|month -> field key -> summed target
  const targets = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (r.deletedat) continue;
    const { month } = parseISODate(r.dateinspected);
    if (!month) continue;
    const key = `${r.stationno}|${month}`;
    let bucket = targets.get(key);
    if (!bucket) {
      bucket = Object.fromEntries(fieldKeys.map((k) => [k, 0]));
      targets.set(key, bucket);
    }
    for (const k of fieldKeys) {
      const src = TARGET_SOURCES[k];
      if (!src) continue;
      for (const f of src) bucket[k] += Number(r[f] ?? 0) || 0;
    }
  }

  return base.map<ReportMatrixProvinceGroup>((g) => {
    const stations = g.stations.map<ReportMatrixStationRow>((s) => {
      const months: Record<number, Record<string, TargetActualCell>> = {};
      for (let m = 1; m <= 12; m++) {
        const bucket: Record<string, TargetActualCell> = {};
        const monthTargets = targets.get(`${s.stationno}|${m}`);
        for (const k of fieldKeys) {
          bucket[k] = { target: monthTargets?.[k] ?? 0, actual: s.months[m]?.[k] ?? 0 };
        }
        months[m] = bucket;
      }
      return {
        stationno: s.stationno,
        stationcode: s.stationcode,
        stationname: s.stationname,
        provinceno: s.provinceno,
        province: s.province,
        logoUrl: s.logoUrl,
        months,
      };
    });

    const provincialTotal: Record<number, Record<string, TargetActualCell>> = {};
    for (let m = 1; m <= 12; m++) {
      const bucket: Record<string, TargetActualCell> = {};
      for (const k of fieldKeys) bucket[k] = { target: 0, actual: 0 };
      for (const st of stations) {
        for (const k of fieldKeys) {
          bucket[k].target += st.months[m][k].target;
          bucket[k].actual += st.months[m][k].actual;
        }
      }
      provincialTotal[m] = bucket;
    }

    return {
      province: g.province,
      provinceno: g.provinceno,
      stations,
      provincialTotal,
    };
  });
}

export function sumReportMonths(
  months: Record<number, Record<string, TargetActualCell>>,
  monthList: number[],
  fieldKeys: string[],
): Record<string, TargetActualCell> {
  const out: Record<string, TargetActualCell> = Object.fromEntries(
    fieldKeys.map((k) => [k, { target: 0, actual: 0 }]),
  );
  for (const m of monthList) {
    for (const k of fieldKeys) {
      const cell = months[m]?.[k];
      if (!cell) continue;
      out[k].target += cell.target;
      out[k].actual += cell.actual;
    }
  }
  return out;
}
