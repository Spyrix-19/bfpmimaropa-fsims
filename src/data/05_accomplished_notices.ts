/**
 * Centralized mock data for the Accomplished Notice module.
 *
 * Isolated data source — do NOT reuse from other modules.
 * Replace with a real API call once the backend endpoint is available.
 */

import { cityMunicipalityData } from "@/data/cityMunicipalityData";
import { getStationInfo } from "@/data/stationInfo";
import { REGION_NAME } from "@/lib/fsims-constants";

export type NoticeCategory = "NOD" | "NTC" | "NTCV" | "Abatement" | "Closure";

export interface CategoryCounts {
  pending: number;
  accomplished: number;
}

export interface AccomplishedNoticeRecord {
  stationNo: string;
  stationCode: string;
  stationName: string;
  logoUrl: string;
  province: string;
  municipality: string;
  region: string;
  reportYear: number;
  breakdown: Record<NoticeCategory, CategoryCounts>;
}

export const NOTICE_CATEGORIES: NoticeCategory[] = [
  "NOD",
  "NTC",
  "NTCV",
  "Abatement",
  "Closure",
];

export const REPORT_YEARS: number[] = [2024, 2025, 2026];

/** Deterministic pseudo-random helper so re-renders show the same numbers. */
function seeded(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

function buildBreakdown(
  seedKey: string,
): Record<NoticeCategory, CategoryCounts> {
  const rand = seeded(hashCode(seedKey));
  const build = (maxPending: number) => {
    const pending = Math.max(0, Math.round(rand() * maxPending));
    const accomplished = Math.round(pending * (0.4 + rand() * 0.6));
    return { pending, accomplished: Math.min(pending, accomplished) };
  };
  return {
    NOD: build(8),
    NTC: build(6),
    NTCV: build(4),
    Abatement: build(4),
    Closure: build(3),
  };
}

export const accomplishedNoticesData: AccomplishedNoticeRecord[] =
  cityMunicipalityData.flatMap((city, idx) => {
    const info = getStationInfo(city);
    return REPORT_YEARS.map((year) => ({
      stationNo: `${city.cityMunicipalityNo}-${year}`,
      stationCode: info.stationCode,
      stationName: info.stationName,
      logoUrl: info.logoUrl,
      province: city.province,
      municipality: city.cityMunicipalityName,
      region: info.region || REGION_NAME,
      reportYear: year,
      breakdown: buildBreakdown(`${city.cityMunicipalityCode}-${year}-${idx}`),
    }));
  });

export interface CategoryComputed extends CategoryCounts {
  category: NoticeCategory;
  remaining: number;
  completionPct: number;
}

export interface NoticeTotals {
  pending: number;
  accomplished: number;
  remaining: number;
  completionPct: number;
}

export function computeCategoryRows(
  breakdown: Record<NoticeCategory, CategoryCounts>,
): CategoryComputed[] {
  return NOTICE_CATEGORIES.map((category) => {
    const { pending, accomplished } = breakdown[category];
    const remaining = Math.max(0, pending - accomplished);
    const completionPct = pending === 0 ? 0 : (accomplished / pending) * 100;
    return { category, pending, accomplished, remaining, completionPct };
  });
}

export function computeTotals(
  breakdown: Record<NoticeCategory, CategoryCounts>,
): NoticeTotals {
  const rows = computeCategoryRows(breakdown);
  const pending = rows.reduce((s, r) => s + r.pending, 0);
  const accomplished = rows.reduce((s, r) => s + r.accomplished, 0);
  const remaining = Math.max(0, pending - accomplished);
  const completionPct = pending === 0 ? 0 : (accomplished / pending) * 100;
  return { pending, accomplished, remaining, completionPct };
}
