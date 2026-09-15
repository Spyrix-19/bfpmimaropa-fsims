import type {
  FSISFeeCollectionDetailModel,
  FSISFeeAccomDetailModel,
} from "@/types/firecodefeesType";

/**
 * The Fire Code Fees report column model now lives in `@/lib/fsims-constants`.
 * This module re-exports it so the existing page imports keep working, and
 * adds the ledger-row shape used only by the Fire Code Fees screens.
 */
export {
  FEE_GROUPS,
  FEE_COLUMNS,
  FEE_CATEGS,
  FEE_SECTORS,
  SECTOR_BY_CODE,
  FIRE_CODE_MODES,
  FIRE_CODE_MODE_MANUAL,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_FEE_CATEG_BASE,
  SECTOR_NO,
  SECTORS,
  sectorKeyFromCode,
  sectorKeyFromNo,
  lastDayOfMonthISO,
} from "@/lib/fsims-constants";
export type { FeeCol, FeeGroup, FeeColumn, FireCodeSectorKey } from "@/lib/fsims-constants";

import type { FireCodeSectorKey } from "@/lib/fsims-constants";

/**
 * Collected amounts of one sector + mode, keyed by fee category (`feecateg`).
 */
export type FeeAmounts = Record<number, number>;

/** Row of the Fire Code Fees ledger card list. */
export interface FireCodeFeeLedgerRow {
  key: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  year: number;
  month: number;
  grandTotal: number;
  sectorTotals: Record<FireCodeSectorKey, number>;
  lastupdated: string;
  feedetaillist: FSISFeeCollectionDetailModel[];
}

/**
 * Flattens a collection record into its accomplishment rows. The API returns
 * them flat under `accomfeelist`; legacy grouped payloads are still unwrapped
 * so older cached responses keep working.
 */
export function flattenFeeAccomItems(
  rec: FSISFeeCollectionDetailModel | null | undefined,
): (FSISFeeAccomDetailModel & { sectorno: number })[] {
  const out: (FSISFeeAccomDetailModel & { sectorno: number })[] = [];
  if (!rec || typeof rec !== "object") return out;

  const legacy = (rec as unknown as { sectorlist?: unknown }).sectorlist;
  if (Array.isArray(legacy)) {
    for (const sector of legacy) {
      const parentSectorno = Number((sector as { sectorno?: unknown })?.sectorno) || 0;
      const rows = (sector as { accomfeelist?: FSISFeeAccomDetailModel[] })?.accomfeelist;
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        out.push({
          ...row,
          sectorno: Number((row as { sectorno?: unknown }).sectorno) || parentSectorno,
        });
      }
    }
  }
  if (out.length > 0) return out;

  const flat = rec.accomfeelist;
  if (Array.isArray(flat)) {
    for (const row of flat) {
      if (!row || typeof row !== "object") continue;
      out.push({ ...row, sectorno: Number((row as { sectorno?: unknown }).sectorno) || 0 });
    }
  }
  return out;
}

/** Peso display used by every amount cell: 150,000,000,000.00 */
export const peso = (value: number) =>
  (Number(value) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Groups an amount string with thousand separators, keeping typed decimals. */
export const groupAmountText = (raw: string) => {
  const s = String(raw ?? "");
  if (s === "") return "";
  const [whole, dec] = s.split(".");
  const grouped = (Number(whole || 0) || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
  return dec === undefined ? grouped : `${grouped}.${dec}`;
};
