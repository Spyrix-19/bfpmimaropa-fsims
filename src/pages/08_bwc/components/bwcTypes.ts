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

/** Any logistics row: station identity + record key + numeric metrics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BwcRow = StationInfo & Record<string, any> & { recordno: string; remarks?: string };

export const num = (row: BwcRow, key: string) => Number(row[key] ?? 0) || 0;

export const rowTotal = (row: BwcRow, fields: BwcField[]) =>
  fields.reduce((sum, f) => sum + num(row, f.key), 0);

/** Maps an API ledger/detail model into the flat row shape used by the UI. */
export function toBwcRow(model: unknown, idKey: string): BwcRow {
  const m = (model ?? {}) as Record<string, unknown>;
  return {
    ...(m as object),
    recordno: String(m[idKey] ?? ""),
    stationno: String(m.stationno ?? ""),
    stationname: String(m.stationname ?? ""),
    unitcode: String(m.stationcode ?? m.unitcode ?? ""),
    cityname: String(m.cityname ?? ""),
    provincename: String(m.provincename ?? ""),
    logourl: (m.logourl as string) ?? null,
    remarks: String(m.remarks ?? ""),
  } as BwcRow;
}
