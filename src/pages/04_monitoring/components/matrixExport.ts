/**
 * Rich Excel export for the Fire Safety Compliance Matrix.
 *
 * Mirrors the Target Reference matrix export (`src/pages/05_target-reference/components/matrixExport.ts`)
 * exactly — same column layout, palette, header banners, borders, striping,
 * province numbering, and signature footer. Totals use Excel SUM formulas so
 * the workbook remains editable and self-recalculating.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS } from "@/lib/fsims-constants";

export interface ComplianceField {
  key: string;
  label: string;
  /** Category the field belongs to (INSPECTION | FSEC | FSIC | NOTICES). */
  category?: string;
}

export interface ComplianceExportStation {
  stationno: string;
  stationCode: string;
  stationName: string;
  cityName: string;
  /** month(1..12) → fieldKey → value */
  months: Record<number, Record<string, number>>;
}

export interface ComplianceExportGroup {
  province: string;
  stations: ComplianceExportStation[];
}

export interface ComplianceExportSignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

const FILL = {
  stationHead: "FF1D4ED8",
  quarter: "FF065F46",
  month: "FF059669",
  fieldLabel: "FFECFDF5",
  semester: "FFF97316",
  annual: "FF1E3A8A",
  provTotal: "FFFEF08A",
  numberCol: "FFEFF6FF",
};

/** Per-category header banding — mirrors the reference ComplianceMatrix_2026.xlsx. */
const CATEGORY_FILL: Record<string, { fg: string; font: string }> = {
  INSPECTION: { fg: "FF0EA5E9", font: "FFFFFFFF" }, // sky
  FSEC:       { fg: "FF10B981", font: "FFFFFFFF" }, // emerald
  FSIC:       { fg: "FFF59E0B", font: "FF1F2937" }, // amber
  NOTICES:    { fg: "FFF43F5E", font: "FFFFFFFF" }, // rose
  DEFAULT:    { fg: "FF64748B", font: "FFFFFFFF" },
};

function catStyle(cat?: string) {
  return CATEGORY_FILL[cat ?? "DEFAULT"] ?? CATEGORY_FILL.DEFAULT;
}

const NUMBER_FMT = "#,##0;(#,##0);-";

function fill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function border(
  style: ExcelJS.BorderStyle = "thin",
  color = "FF64748B",
): ExcelJS.Borders {
  const b: Partial<ExcelJS.Border> = { style, color: { argb: color } };
  return {
    top: b as ExcelJS.Border,
    left: b as ExcelJS.Border,
    right: b as ExcelJS.Border,
    bottom: b as ExcelJS.Border,
    diagonal: {} as ExcelJS.Border,
  };
}

function centerBoldWhite(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: border("thin", "FF334155"),
  };
}

export async function exportComplianceMatrix(opts: {
  year: number;
  groups: ComplianceExportGroup[];
  fields: ComplianceField[];
  signatory?: ComplianceExportSignatory;
  filename?: string;
}) {
  const { year, groups, fields, signatory, filename } = opts;
  const catSpan = fields.length;

  // Compute contiguous category runs across the fields array so we can render
  // the category banner row above the field labels (matches the reference
  // ComplianceMatrix_2026.xlsx grouping visually).
  type Run = { category: string; start: number; end: number };
  const runs: Run[] = [];
  fields.forEach((f, idx) => {
    const c = f.category ?? "";
    const last = runs[runs.length - 1];
    if (last && last.category === c) last.end = idx;
    else runs.push({ category: c, start: idx, end: idx });
  });

  // Column layout: NO | Province | City | Station | months × cats | q-totals × cats | sem1 | sem2 | annual
  const COL = {
    NO: 1,
    PROV: 2,
    CITY: 3,
    STATION: 4,
    MONTHS_START: 5,
  };
  const QTOTAL_START = COL.MONTHS_START + 12 * catSpan;
  const SEM1_START = QTOTAL_START + 4 * catSpan;
  const SEM2_START = SEM1_START + catSpan;
  const ANN_START = SEM2_START + catSpan;
  const LAST = ANN_START + catSpan - 1;

  const monthCatCol = (monthIdx0: number, catIdx: number) =>
    COL.MONTHS_START + monthIdx0 * catSpan + catIdx;
  const qtotalCol = (qIdx0: number, catIdx: number) =>
    QTOTAL_START + qIdx0 * catSpan + catIdx;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Compliance Matrix ${year}`, {
    views: [{ state: "frozen", xSplit: 4, ySplit: 5, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Title row
  ws.mergeCells(1, 1, 1, LAST);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `FIRE SAFETY COMPLIANCE MATRIX — ${year}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  // 5-row banded header (matches the reference layout):
  //  HR1 — Quarter / Semester / Annual banners
  //  HR2 — Month names   (or Q-Total merged continuation)
  //  HR3 — Category banners (INSPECTION | FSEC | FSIC | NOTICES)
  //  HR4 — Field labels
  const HR1 = 2;
  const HR2 = 3;
  const HR3 = 4;
  const HR4 = 5;

  // Station Information header
  ws.mergeCells(HR1, COL.NO, HR4, COL.STATION);
  const stationHead = ws.getCell(HR1, COL.NO);
  stationHead.value = "Station Information";
  stationHead.fill = fill(FILL.stationHead);
  Object.assign(stationHead, centerBoldWhite());
  stationHead.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };

  const quarters = [
    { label: "First Quarter", months: [0, 1, 2] },
    { label: "Second Quarter", months: [3, 4, 5] },
    { label: "Third Quarter", months: [6, 7, 8] },
    { label: "Fourth Quarter", months: [9, 10, 11] },
  ];

  // Quarter banners over month × cat cells
  quarters.forEach((q, qi) => {
    const c1 = monthCatCol(qi * 3, 0);
    const c2 = monthCatCol(qi * 3 + 2, catSpan - 1);
    ws.mergeCells(HR1, c1, HR1, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = q.label;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
  });

  // Month names row — each month spans all its category+field cols.
  for (let m = 0; m < 12; m++) {
    const c1 = monthCatCol(m, 0);
    const c2 = monthCatCol(m, catSpan - 1);
    ws.mergeCells(HR2, c1, HR2, c2);
    const cell = ws.getCell(HR2, c1);
    cell.value = MONTHS[m].name.toUpperCase();
    cell.fill = fill(FILL.month);
    Object.assign(cell, centerBoldWhite());
  }

  // Category banner row (HR3) — one merged band per category, per month.
  // Field label row (HR4) — one cell per field.
  const paintCategoryBanner = (row: number, baseCol: number, run: Run) => {
    const c1 = baseCol + run.start;
    const c2 = baseCol + run.end;
    if (c2 > c1) ws.mergeCells(row, c1, row, c2);
    const style = catStyle(run.category);
    const cell = ws.getCell(row, c1);
    cell.value = run.category || "";
    cell.fill = fill(style.fg);
    cell.font = { bold: true, size: 10, color: { argb: style.font } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border("thin", "FF334155");
  };
  const paintFieldLabels = (row: number, baseCol: number) => {
    fields.forEach((f, ci) => {
      const cell = ws.getCell(row, baseCol + ci);
      cell.value = f.label;
      cell.fill = fill(FILL.fieldLabel);
      cell.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = border();
    });
  };
  for (let m = 0; m < 12; m++) {
    const base = monthCatCol(m, 0);
    runs.forEach((run) => paintCategoryBanner(HR3, base, run));
    paintFieldLabels(HR4, base);
  }

  // Quarter totals headers — banner spans HR1:HR2, category banners on HR3, field labels on HR4.
  quarters.forEach((q, qi) => {
    const c1 = qtotalCol(qi, 0);
    const c2 = qtotalCol(qi, catSpan - 1);
    ws.mergeCells(HR1, c1, HR2, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = `${q.label} Total`;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
    runs.forEach((run) => paintCategoryBanner(HR3, c1, run));
    paintFieldLabels(HR4, c1);
  });

  const bigTotals: { start: number; label: string; color: string }[] = [
    { start: SEM1_START, label: "First Semester", color: FILL.semester },
    { start: SEM2_START, label: "Second Semester", color: FILL.semester },
    { start: ANN_START, label: "Annual Total", color: FILL.annual },
  ];
  bigTotals.forEach((bt) => {
    ws.mergeCells(HR1, bt.start, HR2, bt.start + catSpan - 1);
    const cell = ws.getCell(HR1, bt.start);
    cell.value = bt.label;
    cell.fill = fill(bt.color);
    Object.assign(cell, centerBoldWhite());
    runs.forEach((run) => paintCategoryBanner(HR3, bt.start, run));
    paintFieldLabels(HR4, bt.start);
  });

  ws.getRow(HR1).height = 24;
  ws.getRow(HR2).height = 22;
  ws.getRow(HR3).height = 20;
  ws.getRow(HR4).height = 28;

  // Body rows
  let cursor = HR4 + 1;

  const writeStationRow = (station: ComplianceExportStation, seq: number, provinceName: string) => {
    const row = ws.getRow(cursor);
    row.getCell(COL.NO).value = seq;
    row.getCell(COL.PROV).value = provinceName;
    row.getCell(COL.CITY).value = station.cityName || "";
    row.getCell(COL.STATION).value =
      `${station.stationCode ? station.stationCode + "  " : ""}${station.stationName}`;

    // Monthly numeric cells
    for (let m = 0; m < 12; m++) {
      const bucket = station.months[m + 1] ?? {};
      fields.forEach((f, ci) => {
        const cell = row.getCell(monthCatCol(m, ci));
        cell.value = Number(bucket[f.key]) || 0;
        cell.numFmt = NUMBER_FMT;
      });
    }
    // Quarter totals via SUM formula referencing this row's 3 monthly cells
    quarters.forEach((q, qi) => {
      fields.forEach((_f, ci) => {
        const refs = q.months.map((mIdx) => ws.getCell(cursor, monthCatCol(mIdx, ci)).address);
        const cell = row.getCell(qtotalCol(qi, ci));
        cell.value = { formula: `SUM(${refs.join(",")})` } as ExcelJS.CellFormulaValue;
        cell.numFmt = NUMBER_FMT;
      });
    });
    // Sem1/Sem2/Annual — sum of quarter totals via SUM
    fields.forEach((_f, ci) => {
      const q1 = ws.getCell(cursor, qtotalCol(0, ci)).address;
      const q2 = ws.getCell(cursor, qtotalCol(1, ci)).address;
      const q3 = ws.getCell(cursor, qtotalCol(2, ci)).address;
      const q4 = ws.getCell(cursor, qtotalCol(3, ci)).address;
      row.getCell(SEM1_START + ci).value = { formula: `SUM(${q1},${q2})` } as ExcelJS.CellFormulaValue;
      row.getCell(SEM2_START + ci).value = { formula: `SUM(${q3},${q4})` } as ExcelJS.CellFormulaValue;
      row.getCell(ANN_START + ci).value = {
        formula: `SUM(${q1},${q2},${q3},${q4})`,
      } as ExcelJS.CellFormulaValue;
      [SEM1_START, SEM2_START, ANN_START].forEach((base) => {
        row.getCell(base + ci).numFmt = NUMBER_FMT;
      });
    });

    // Styling
    row.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell, colNumber: number) => {
      cell.border = border();
      if (colNumber === COL.NO) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = fill(FILL.numberCol);
        cell.font = { bold: true, size: 10 };
      } else if (colNumber === COL.PROV || colNumber === COL.CITY) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.font = { size: 10 };
      } else if (colNumber === COL.STATION) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
        cell.font = { size: 10, bold: true };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { size: 10 };
      }
    });
    row.height = 22;
    cursor++;
  };

  const writeProvinceTotal = (province: string, stationRows: number[]) => {
    const row = ws.getRow(cursor);
    ws.mergeCells(cursor, COL.NO, cursor, COL.STATION);
    const labelCell = row.getCell(COL.NO);
    labelCell.value = `PROVINCIAL TOTAL — ${province.toUpperCase()}`;
    labelCell.font = { bold: true, size: 10, color: { argb: "FF713F12" } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = fill(FILL.provTotal);
    labelCell.border = border("medium", "FF334155");

    for (let col = COL.MONTHS_START; col <= LAST; col++) {
      const cell = row.getCell(col);
      if (stationRows.length > 0) {
        const refs = stationRows.map((r) => ws.getCell(r, col).address).join(",");
        cell.value = { formula: `SUM(${refs})` } as ExcelJS.CellFormulaValue;
      } else {
        cell.value = 0;
      }
      cell.numFmt = NUMBER_FMT;
      cell.font = { bold: true, size: 10, color: { argb: "FF713F12" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = fill(FILL.provTotal);
      cell.border = border();
    }
    row.height = 22;
    cursor++;
  };

  groups.forEach((g) => {
    const stationRowNums: number[] = [];
    g.stations.forEach((s, i) => {
      stationRowNums.push(cursor);
      writeStationRow(s, i + 1, g.province);
    });
    writeProvinceTotal(g.province, stationRowNums);
  });

  // Column widths
  ws.getColumn(COL.NO).width = 5;
  ws.getColumn(COL.PROV).width = 22;
  ws.getColumn(COL.CITY).width = 22;
  ws.getColumn(COL.STATION).width = 30;
  for (let c = COL.MONTHS_START; c <= LAST; c++) {
    ws.getColumn(c).width = 8;
  }

  // ------------------------------ Signature footer (A:G merged) ------------
  cursor++; // blank line after last data row
  const genRow = cursor;
  ws.mergeCells(genRow, 1, genRow, 7);
  const genCell = ws.getCell(genRow, 1);
  genCell.value = "Generated by:";
  genCell.font = { bold: true, italic: true, size: 11 };
  genCell.alignment = { horizontal: "left", vertical: "middle" };
  cursor++;

  // Two blank rows
  ws.mergeCells(cursor, 1, cursor, 7);
  ws.getRow(cursor).height = 18;
  cursor++;
  ws.mergeCells(cursor, 1, cursor, 7);
  ws.getRow(cursor).height = 18;
  cursor++;

  const nameRow = cursor;
  ws.mergeCells(nameRow, 1, nameRow, 7);
  const nameCell = ws.getCell(nameRow, 1);
  const rankFullName = [signatory?.rank, signatory?.fullname].filter(Boolean).join(" ").trim();
  nameCell.value = rankFullName || "____________________________";
  nameCell.font = { bold: true, size: 11, underline: true };
  nameCell.alignment = { horizontal: "left", vertical: "middle" };
  nameCell.border = {
    top: { style: "thin", color: { argb: "FF334155" } },
  } as ExcelJS.Borders;
  cursor++;

  const desigRow = cursor;
  ws.mergeCells(desigRow, 1, desigRow, 7);
  const desigCell = ws.getCell(desigRow, 1);
  desigCell.value = signatory?.designation || "Designation";
  desigCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  desigCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.pageSetup.printArea = `A1:${ws.getCell(desigRow, LAST).address}`;
  ws.pageSetup.printTitlesRow = `${HR1}:${HR4}`;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename ?? `ComplianceMatrix_${year}.xlsx`,
  );
}
