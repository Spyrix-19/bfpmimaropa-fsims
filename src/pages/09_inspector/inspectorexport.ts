import { toast } from "@/lib/toast";
import { exportStationLedgerWorkbook, type LedgerExcelSignatory } from "@/lib/ledger-excel";
import type { InspectorField, InspectorRow } from "./FireSafetyInspector";

/** Reads a numeric metric off a ledger row. */
export const num = (row: InspectorRow, key: string) => Number(row[key] ?? 0) || 0;

/** Sum of every metric column on a row. */
export const rowTotal = (row: InspectorRow, fields: InspectorField[]) =>
  fields.reduce((sum, f) => sum + num(row, f.key), 0);

/** Exports the Fire Safety Inspector ledger as a styled workbook. */
export async function exportInspectorLedger(
  rows: InspectorRow[],
  fields: InspectorField[],
  totalLabel: string,
  title = "Fire Safety Inspector",
  signatory?: LedgerExcelSignatory,
) {
  if (rows.length === 0) {
    toast.info("Nothing to export — no stations match the current filters.");
    return;
  }
  await exportStationLedgerWorkbook({
    title,
    crownLabel: "Fire Safety Inspectors",
    sheetName: "Fire Safety Inspector",
    rows: rows.map((r) => ({ ...r })),
    fields: fields.map((f) => ({ key: f.key, label: f.label })),
    totalLabel,
    signatory,
    filename: `FireSafetyInspector_${new Date().getFullYear()}.xlsx`,
  });
  toast.success("Fire Safety Inspector ledger exported.");
}
