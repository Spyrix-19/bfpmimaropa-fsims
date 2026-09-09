import type { FSISFeeCollectionDetailModel } from "@/types/firecodefeesType";

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
  SECTOR_BPLO,
  SECTOR_GOV,
  SECTOR_PEZA,
  SECTOR_TIEZA,
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

/** Peso display used by every amount cell. */
export const peso = (value: number) =>
  (Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
