import { toast } from "@/lib/toast";
import { exportStationLedgerWorkbook, type LedgerExcelSignatory } from "@/lib/ledger-excel";
import type { BwcField, BwcRow } from "./IssuedBwc";

/** Reads a numeric metric off a ledger row. */
export const num = (row: BwcRow, key: string) => Number(row[key] ?? 0) || 0;

/** Sum of every metric column on a row. */
export const rowTotal = (row: BwcRow, fields: BwcField[]) =>
  fields.reduce((sum, f) => sum + num(row, f.key), 0);

/** Exports the Issued BWC ledger as a styled workbook (matches Compliance layout). */
export async function exportBwcLedger(
  rows: BwcRow[],
  fields: BwcField[],
  totalLabel: string,
  title = "Issued BWC",
  signatory?: LedgerExcelSignatory,
) {
  if (rows.length === 0) {
    toast.info("Nothing to export — no stations match the current filters.");
    return;
  }
  await exportStationLedgerWorkbook({
    title,
    crownLabel: "Issued Body-Worn Cameras",
    sheetName: "Issued BWC",
    rows: rows.map((r) => ({ ...r })),
    fields: fields.map((f) => ({ key: f.key, label: f.label })),
    totalLabel,
    signatory,
    filename: `IssuedBWC_${new Date().getFullYear()}.xlsx`,
  });
  toast.success("Issued BWC ledger exported.");
}
