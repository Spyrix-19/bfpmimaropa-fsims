import * as React from "react";
import { gentableAPI } from "@/services/gentableAPI";
import { unwrap } from "@/lib/api-envelope";
import type { SearchGentableModel } from "@/types/gentableType";
import { FEE_GROUPS, FEE_KEYS } from "../feeColumns";

/** Gentable lookup that drives the Fire Code Fees entry form layout. */
export const FEE_CATEGORY_TABLE = "FIRE CODE FEES CATEGORY";

export interface FeeCategory {
  /** Amount field key on the payload (see `FireCodeFeeAmounts`). */
  key: string;
  /** Gentable `detno` when the lookup resolved, otherwise 0. */
  detno: number;
  /** BFP account code, e.g. "628-BFP-01". */
  code: string;
  label: string;
  groupLabel: string;
}

/** Local fallback built from the printed report columns. */
export const STATIC_FEE_CATEGORIES: FeeCategory[] = FEE_GROUPS.flatMap((g) =>
  g.cols.map((c) => ({
    key: c.key,
    detno: 0,
    code: g.code ?? "",
    label: g.cols.length > 1 ? `${g.label} — ${c.label}` : g.label,
    groupLabel: g.label,
  })),
);

/**
 * Loads the fee categories from `Gentable/Code`. The lookup is returned in
 * `sortorder` 1..32 which maps one-to-one onto `FEE_KEYS` (the report column
 * order), so the API drives the labels while the payload keys stay stable.
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
      if (rows.length === FEE_KEYS.length) {
        rows.sort((a, b) => Number(a.sortorder ?? 0) - Number(b.sortorder ?? 0));
        setCategories(
          rows.map((r, i) => ({
            key: FEE_KEYS[i],
            detno: Number(r.detno ?? 0),
            code: String(r.recordcode ?? ""),
            label: String(r.description ?? STATIC_FEE_CATEGORIES[i].label),
            groupLabel: STATIC_FEE_CATEGORIES[i].groupLabel,
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
  const groups: { code: string; label: string; items: FeeCategory[] }[] = [];
  for (const c of categories) {
    const last = groups[groups.length - 1];
    if (last && last.label === c.groupLabel) last.items.push(c);
    else groups.push({ code: c.code, label: c.groupLabel, items: [c] });
  }
  return groups;
}
