import { toast } from "@/lib/toast";
import type { BwcField, BwcRow } from "./IssuedBwc";

/** Reads a numeric metric off a ledger row. */
export const num = (row: BwcRow, key: string) => Number(row[key] ?? 0) || 0;

/** Sum of every metric column on a row. */
export const rowTotal = (row: BwcRow, fields: BwcField[]) =>
  fields.reduce((sum, f) => sum + num(row, f.key), 0);

const csvCell = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;

const download = (filename: string, lines: string[]) => {
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Exports the Issued BWC ledger as it is currently filtered. */
export function exportBwcLedger(
  rows: BwcRow[],
  fields: BwcField[],
  totalLabel: string,
  title = "Issued BWC",
) {
  if (rows.length === 0) {
    toast.info("Nothing to export — no stations match the current filters.");
    return;
  }
  const header = [
    "Station",
    "Unit Code",
    "City / Municipality",
    "Province",
    ...fields.map((f) => f.label),
    totalLabel,
  ];
  const lines = [header.map(csvCell).join(",")];
  rows.forEach((r) => {
    lines.push(
      [
        r.stationname,
        r.unitcode,
        r.cityname,
        r.provincename,
        ...fields.map((f) => num(r, f.key)),
        rowTotal(r, fields),
      ]
        .map(csvCell)
        .join(","),
    );
  });
  download(`${title.replace(/\s+/g, "-").toLowerCase()}.csv`, lines);
  toast.success("Issued BWC ledger exported.");
}