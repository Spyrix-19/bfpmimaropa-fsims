import * as React from "react";
import { gentableAPI } from "@/services/gentableAPI";
import { unwrap } from "@/lib/api-envelope";
import type { SearchGentableModel } from "@/types/gentableType";
import { FEE_COLUMNS } from "../feeColumns";

/** Gentable lookup that drives the Fire Code Fees entry form layout. */
export const FEE_CATEGORY_TABLE = "FIRE CODE FEES CATEGORY";

export interface FeeCategory {
  /** Stable React key of the report column. */
  key: string;
  /** Fee category code sent as `Feecateg` (gentable `detno`). */
  detno: number;
  /** BFP account code, e.g. "628-BFP-01". */
  code: string;
  label: string;
  groupLabel: string;
  /** Backend `feeparentno` — the parent this category belongs to (API payloads). */
  parentno?: number;
  /** Backend `feeparentname`, shown next to the parent code when it has siblings. */
  parentname?: string;
}

/** Parent group of fee categories, keyed by `feeparentno`. */
export interface FeeParentGroup {
  parentno: number;
  /** `feeparentcode`, e.g. "628-BFP-01". */
  code: string;
  /** `feeparentname`. */
  name: string;
  items: FeeCategory[];
}

/** Groups categories by their `feeparentno`, preserving first-seen order. */
export function groupByParent(categories: FeeCategory[]): FeeParentGroup[] {
  const groups: FeeParentGroup[] = [];
  const byParent = new Map<string, FeeParentGroup>();
  for (const c of categories) {
    const parentno = Number(c.parentno) || 0;
    const key = parentno ? `p-${parentno}` : `c-${c.code || c.groupLabel}`;
    const existing = byParent.get(key);
    if (existing) {
      existing.items.push(c);
      continue;
    }
    const group: FeeParentGroup = {
      parentno,
      code: c.code || c.groupLabel,
      name: c.parentname ?? c.groupLabel,
      items: [c],
    };
    byParent.set(key, group);
    groups.push(group);
  }
  return groups;
}

/**
 * Local fallback built from the printed report columns. `detno` falls back to
 * the report column position until the gentable lookup resolves the real
 * `Feecateg` codes.
 */
export const STATIC_FEE_CATEGORIES: FeeCategory[] = FEE_COLUMNS.map((c) => ({
  key: c.key,
  detno: c.categ,
  code: c.code,
  label: c.label === "Amount" ? c.groupLabel : `${c.groupLabel} — ${c.label}`,
  groupLabel: c.groupLabel,
}));

/**
 * Loads the fee categories from `Gentable/Code`. The lookup is returned in
 * `sortorder` 1..32 which maps one-to-one onto the report column order, so the
 * API drives both the labels and the `Feecateg` codes used on the payload.
 */
export function useFeeCategories() {
  const [categories, setCategories] = React.useState<FeeCategory[]>(STATIC_FEE_CATEGORIES);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await gentableAPI.getCode(FEE_CATEGORY_TABLE, {
        suppressGlobalLoading: true,
        suppressErrorToast: true,
      });
      const { ok, data } = unwrap<SearchGentableModel[]>(resp);
      if (cancelled) return;
      const rows = ok && Array.isArray(data) ? [...data] : [];
      if (rows.length === FEE_COLUMNS.length) {
        rows.sort((a, b) => Number(a.sortorder ?? 0) - Number(b.sortorder ?? 0));
        setCategories(
          rows.map((r, i) => ({
            key: FEE_COLUMNS[i].key,
            detno: Number(r.detno ?? 0) || STATIC_FEE_CATEGORIES[i].detno,
            code: String(r.recordcode ?? ""),
            label: String(r.description ?? STATIC_FEE_CATEGORIES[i].label),
            groupLabel: STATIC_FEE_CATEGORIES[i].groupLabel,
            parentno: Number(r.parentno ?? 0) || undefined,
            parentname: String(r.parentname ?? "").trim() || undefined,
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}

/** Groups categories by their BFP account code crown, preserving order. */
export function groupCategories(categories: FeeCategory[]) {
  return groupByParent(categories).map((group) => ({
    code: group.code,
    label: group.name,
    items: group.items,
  }));
}
