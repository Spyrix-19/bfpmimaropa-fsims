import {
  exportStationLedgerWorkbook,
  type LedgerExcelSignatory,
  type LedgerExcelStation,
} from "@/lib/ledger-excel";
import { FEE_SECTORS, type FireCodeFeeLedgerRow } from "../feeColumns";

/* ------------------------------------------------------------------ *
 * Fire Code Fees — station ledger workbook.
 * Uses the exact shared station-ledger layout as the Fire Safety
 * Compliance / BWC / Inspector exports, with the four report sectors
 * (BPLO, GOV, PEZA, TIEZA) as the grouped metric columns.
 * ------------------------------------------------------------------ */

export const FIRE_CODE_FEES_LEDGER_FIELDS = FEE_SECTORS.map((s) => ({
  key: s.key,
  label: s.label,
}));

export async function exportFireCodeFeesLedgerWorkbook(opts: {
  rows: FireCodeFeeLedgerRow[];
  periodLabel?: string | null;
  year: number;
  signatory?: LedgerExcelSignatory;
}) {
  const rows: LedgerExcelStation[] = opts.rows.map((r) => ({
    stationname: r.Stationname,
    unitcode: r.Stationcode,
    cityname: "",
    provincename: r.Provincename,
    bplo: r.sectorTotals.bplo,
    gov: r.sectorTotals.gov,
    peza: r.sectorTotals.peza,
    tieza: r.sectorTotals.tieza,
  }));

  const title = opts.periodLabel
    ? `Fire Code Fees Collection — ${opts.periodLabel}`
    : "Fire Code Fees Collection";

  await exportStationLedgerWorkbook({
    title,
    crownLabel: "Fire Code Fees Collection",
    sheetName: "Fire Code Fees Ledger",
    rows,
    fields: FIRE_CODE_FEES_LEDGER_FIELDS,
    totalLabel: "TOTAL",
    signatory: opts.signatory,
    filename: `FireCodeFeesCollection_${opts.year}.xlsx`,
  });
}
