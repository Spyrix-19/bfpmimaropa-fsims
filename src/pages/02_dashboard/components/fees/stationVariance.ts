import type { DashboardFireCodeFeeStationModel } from "@/types/dashboardType";

export type StationStatus = "improved" | "declined" | "same";
export type StationStatusFilter = "all" | StationStatus;
export type StationSortKey = "first" | "second" | "variance" | "positive" | "percentage" | "station";
export type SortDirection = "asc" | "desc";

export interface StationVarianceRow {
  key: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  logourl: string;
  first: number;
  second: number;
  /** Shortfall vs. the first year: max(0, first - second). */
  variance: number;
  /** Gain vs. the first year: max(0, second - first). */
  positive: number;
  /** second / first * 100; null when the first year is zero. */
  percentage: number | null;
  status: StationStatus;
}

const amountOf = (row: DashboardFireCodeFeeStationModel, year: number) =>
  Number(row?.years?.[String(year)]) || 0;

export function toStationVarianceRows(
  rows: DashboardFireCodeFeeStationModel[],
  firstYear: number,
  secondYear: number,
): StationVarianceRow[] {
  return rows.map((row, index) => {
    const first = amountOf(row, firstYear);
    const second = amountOf(row, secondYear);
    return {
      key: row.stationno || `${row.stationcode}-${index}`,
      stationno: row.stationno,
      stationcode: row.stationcode,
      stationname: row.stationname,
      provinceno: row.provinceno,
      provincename: row.provincename,
      logourl: row.logourl,
      first,
      second,
      variance: Math.max(0, first - second),
      positive: Math.max(0, second - first),
      percentage: first === 0 ? null : (second / first) * 100,
      status: second > first ? "improved" : second < first ? "declined" : "same",
    };
  });
}

export function filterStationRows(
  rows: StationVarianceRow[],
  search: string,
  status: StationStatusFilter,
): StationVarianceRow[] {
  const term = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!term) return true;
    return [row.stationname, row.stationcode, row.provincename]
      .some((value) => (value ?? "").toLowerCase().includes(term));
  });
}

/** Rows with no percentage (first year = 0) always sink to the bottom. */
export function sortStationRows(
  rows: StationVarianceRow[],
  key: StationSortKey,
  direction: SortDirection,
): StationVarianceRow[] {
  const sign = direction === "asc" ? 1 : -1;
  const byName = (a: StationVarianceRow, b: StationVarianceRow) =>
    (a.provincename ?? "").localeCompare(b.provincename ?? "") ||
    (a.stationname ?? "").localeCompare(b.stationname ?? "");

  return [...rows].sort((a, b) => {
    if (key === "station") return sign * byName(a, b);
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return byName(a, b);
    if (av === null) return 1;
    if (bv === null) return -1;
    return sign * (av - bv) || byName(a, b);
  });
}

export function summarizeStationRows(rows: StationVarianceRow[]) {
  const first = rows.reduce((sum, row) => sum + row.first, 0);
  const second = rows.reduce((sum, row) => sum + row.second, 0);
  return {
    first,
    second,
    variance: Math.max(0, first - second),
    positive: Math.max(0, second - first),
    percentage: first === 0 ? null : (second / first) * 100,
    improved: rows.filter((row) => row.status === "improved").length,
    declined: rows.filter((row) => row.status === "declined").length,
    same: rows.filter((row) => row.status === "same").length,
  };
}
