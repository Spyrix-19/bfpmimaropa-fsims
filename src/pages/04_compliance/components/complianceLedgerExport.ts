import {
  exportStationLedgerWorkbook,
  type LedgerExcelSignatory,
  type LedgerExcelStation,
} from "@/lib/ledger-excel";
import type { ComplianceExportGroup, ComplianceExportRecord } from "./complianceExport";
import { toNumber as num } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Fire Safety Compliance — station ledger workbook.
 * Uses the shared station-ledger layout (same design as the BWC and
 * Inspector exports) with the Compliance ledger data: per-station
 * Inspection / FSEC / FSIC / Issued Notices totals.
 * ------------------------------------------------------------------ */

const INSPECTION_KEYS = [
  "inspectduringcount",
  "inspectaftercount",
  "inspectbplocount",
  "inspectgovcount",
  "inspectpezacount",
  "inspecttiezacount",
] as const;
const FSEC_KEYS = ["fsecbuildingcount", "fsecgovcount", "fsecpezacount", "fsectiezacount"] as const;
const FSIC_KEYS = [
  "fsicoccupancycount",
  "fsicbplonewcount",
  "fsicbplorenewcount",
  "fsicgovcount",
  "fsicpezacount",
  "fsictiezacount",
] as const;
const NOTICE_KEYS = [
  "nodcount",
  "ntccount",
  "ntcvcount",
  "abatementcount",
  "closurecount",
] as const;

export const COMPLIANCE_LEDGER_FIELDS = [
  { key: "inspection", label: "Inspection" },
  { key: "fsec", label: "FSEC" },
  { key: "fsic", label: "FSIC" },
  { key: "notices", label: "Issued Notices" },
];

const sumKeys = (source: Record<string, unknown>, keys: readonly string[]) =>
  keys.reduce((acc, k) => acc + num(source[k]), 0);

/** Sums every daily compliance record of a station into the four ledger categories. */
function stationTotals(list: ComplianceExportRecord[]) {
  let inspection = 0;
  let fsec = 0;
  let fsic = 0;
  let notices = 0;

  (list ?? []).forEach((rec) => {
    const r = rec as Record<string, unknown>;
    inspection += sumKeys(r, INSPECTION_KEYS);
    fsec += sumKeys(r, FSEC_KEYS);
    fsic += sumKeys(r, FSIC_KEYS);
    notices += sumKeys(r, NOTICE_KEYS);

    const issuances = Array.isArray(rec.issuancelist) ? rec.issuancelist : [];
    issuances.forEach((iss) => {
      const i = iss as Record<string, unknown>;
      fsec += sumKeys(i, FSEC_KEYS);
      fsic += sumKeys(i, FSIC_KEYS);
      notices += sumKeys(i, NOTICE_KEYS);
    });
  });

  return { inspection, fsec, fsic, notices };
}

export async function exportComplianceLedgerWorkbook(opts: {
  groups: ComplianceExportGroup[];
  periodLabel?: string;
  year: number;
  signatory?: LedgerExcelSignatory;
}) {
  const rows: LedgerExcelStation[] = opts.groups.map((g) => ({
    stationname: g.stationName,
    unitcode: g.stationCode,
    cityname: "",
    provincename: g.province,
    ...stationTotals(g.compliancelist),
  }));

  const title = opts.periodLabel
    ? `Fire Safety Compliance — ${opts.periodLabel}`
    : "Fire Safety Compliance";

  await exportStationLedgerWorkbook({
    title,
    crownLabel: "Fire Safety Compliance",
    sheetName: "Compliance Ledger",
    rows,
    fields: COMPLIANCE_LEDGER_FIELDS,
    totalLabel: "TOTAL",
    signatory: opts.signatory,
    filename: `FireSafetyCompliance_${opts.year}.xlsx`,
  });
}
