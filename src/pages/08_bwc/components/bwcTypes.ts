import type { StationInfo } from "@/mock/logistics.mock";

/** A numeric metric column shared by the board, form, details and matrix. */
export interface BwcField {
  key: string;
  label: string;
  /** Short label used inside the matrix header. */
  shortLabel?: string;
  tone?: "muted" | "success" | "destructive" | "primary";
  /** Helper hint rendered under the input inside the add/edit modal. */
  hint?: string;
}

/** Any logistics row: station identity + numeric metrics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BwcRow = StationInfo & Record<string, any>;

export const num = (row: BwcRow, key: string) => Number(row[key] ?? 0) || 0;

export const rowTotal = (row: BwcRow, fields: BwcField[]) =>
  fields.reduce((sum, f) => sum + num(row, f.key), 0);
