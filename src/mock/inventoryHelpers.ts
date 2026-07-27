/**
 * Pure helpers for the FSIS Inventory monthly monitoring workflow.
 *
 * Every monthly / quarterly / semester / annual / province total is derived
 * from raw daily rows — never persisted. Keep this module free of React,
 * network, and store internals so it can be reused server-side later.
 */
import type {
  CategoryBucket,
  DailyInventoryDTO,
  InventoryCategory,
  MatrixProvinceGroup,
  MatrixStationRow,
} from "@/types/inventoryType";

/** Field definitions per category — drives table columns, matrix columns, and totals. */
export const CATEGORY_FIELDS: Record<
  InventoryCategory,
  {
    key: keyof DailyInventoryDTO | "insp_total" | "fsec_total" | "fsic_total" | "not_total";
    label: string;
  }[]
> = {
  INSPECTION: [
    { key: "insp_during", label: "During" },
    { key: "insp_after", label: "After" },
    { key: "insp_bplo", label: "1st BPLO" },
    { key: "insp_gov", label: "1st GOV" },
    { key: "insp_peza", label: "1st PEZA" },
    { key: "insp_tieza", label: "1st TIEZA" },
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
  NOTICES: [
    { key: "not_nod", label: "NOD" },
    { key: "not_ntc", label: "NTC" },
    { key: "not_ntcv", label: "NTCV" },
    { key: "not_abatement", label: "Abatement" },
    { key: "not_closure", label: "Closure" },
  ],
  OVERALL: [
    { key: "insp_total", label: "Inspection" },
    { key: "fsec_total", label: "FSEC" },
    { key: "fsic_total", label: "FSIC" },
    { key: "not_total", label: "Notices" },
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
export const NOTICES_FIELDS = [
  "not_nod",
  "not_ntc",
  "not_ntcv",
  "not_abatement",
  "not_closure",
] as const;

export const ALL_NUMERIC_FIELDS = [
  ...INSPECTION_FIELDS,
  ...FSEC_FIELDS,
  ...FSIC_FIELDS,
  ...NOTICES_FIELDS,
] as const;

export function calendarDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** COUNT(DISTINCT dateinspected) across the given rows. */
export function daysEncoded(rows: DailyInventoryDTO[]): number {
  const set = new Set<string>();
  rows.forEach((r) => set.add(r.dateinspected));
  return set.size;
}

/** Sum a group of fields across many daily rows. */
export function sumFields(
  rows: DailyInventoryDTO[],
  fields: readonly (keyof DailyInventoryDTO)[],
): number {
  let total = 0;
  for (const r of rows) {
    for (const f of fields) {
      total += Number(r[f] ?? 0) || 0;
    }
  }
  return total;
}

export function inspectionTotal(rows: DailyInventoryDTO[]): number {
  return sumFields(rows, INSPECTION_FIELDS);
}
export function fsecTotal(rows: DailyInventoryDTO[]): number {
  return sumFields(rows, FSEC_FIELDS);
}
export function fsicTotal(rows: DailyInventoryDTO[]): number {
  return sumFields(rows, FSIC_FIELDS);
}
export function noticesTotal(rows: DailyInventoryDTO[]): number {
  return sumFields(rows, NOTICES_FIELDS);
}

export function bucketFor(rows: DailyInventoryDTO[]): CategoryBucket {
  return {
    inspection: inspectionTotal(rows),
    fsec: fsecTotal(rows),
    fsic: fsicTotal(rows),
    notices: noticesTotal(rows),
  };
}

export function breakdownFor(rows: DailyInventoryDTO[]) {
  return {
    inspection: Object.fromEntries(
      INSPECTION_FIELDS.map((key) => [key, sumFields(rows, [key])]),
    ) as Record<string, number>,
    fsec: Object.fromEntries(
      FSEC_FIELDS.map((key) => [key, sumFields(rows, [key])]),
    ) as Record<string, number>,
    fsic: Object.fromEntries(
      FSIC_FIELDS.map((key) => [key, sumFields(rows, [key])]),
    ) as Record<string, number>,
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

/** Group live (non-deleted) rows by `${stationno}|${year}|${month}`. */
export function groupByStationMonth(rows: DailyInventoryDTO[]): Map<string, DailyInventoryDTO[]> {
  const out = new Map<string, DailyInventoryDTO[]>();
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

export function fieldsForCategory(cat: InventoryCategory): readonly (keyof DailyInventoryDTO)[] {
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
  rows: DailyInventoryDTO[],
  category: InventoryCategory,
): MatrixProvinceGroup[] {
  const fields = CATEGORY_FIELDS[category];
  const live = rows.filter((r) => !r.deletedat);

  const stationMap = new Map<string, MatrixStationRow>();
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
      else bucket[f.key] += Number(r[f.key as keyof DailyInventoryDTO] ?? 0) || 0;
    }
  }

  const byProvince = new Map<string, MatrixStationRow[]>();
  stationMap.forEach((s) => {
    const arr = byProvince.get(s.province) ?? [];
    arr.push(s);
    byProvince.set(s.province, arr);
  });

  const order = Array.from(byProvince.keys()).sort();
  return order.map<MatrixProvinceGroup>((province) => {
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
 * Extends `buildMatrix` output so every field carries BOTH a target and
 * an actual value. Actuals come from the centralized daily inventory store
 * (same source as `buildMatrix`). Targets are derived deterministically from
 * the same rows so the mock is stable across reloads — no separate dataset.
 *
 * When the real backend is ready, replace `deriveTarget()` with data
 * pulled from `targetreferenceAPI` and every consumer stays untouched.
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

function deriveTarget(actual: number, seed: number): number {
  let s = (seed * 2654435761) >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  const jitter = (s / 0x100000000) * 0.35;
  const base = Math.max(actual, 3);
  return Math.round(base * (1.1 + jitter)) + 2;
}

function hashKey(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
  }
  return h;
}

export function buildReportMatrix(
  rows: DailyInventoryDTO[],
  category: InventoryCategory,
): ReportMatrixProvinceGroup[] {
  const base = buildMatrix(rows, category);
  const fields = CATEGORY_FIELDS[category];
  const fieldKeys = fields.map((f) => String(f.key));

  return base.map<ReportMatrixProvinceGroup>((g) => {
    const stations = g.stations.map<ReportMatrixStationRow>((s) => {
      const months: Record<number, Record<string, TargetActualCell>> = {};
      for (let m = 1; m <= 12; m++) {
        const bucket: Record<string, TargetActualCell> = {};
        for (const k of fieldKeys) {
          const actual = s.months[m]?.[k] ?? 0;
          const target = deriveTarget(actual, hashKey(s.stationno, m, k));
          bucket[k] = { target, actual };
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
