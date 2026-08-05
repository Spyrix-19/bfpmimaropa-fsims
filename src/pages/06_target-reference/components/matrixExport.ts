/**
 * Rich Excel export for the Target Reference Matrix.
 *
 * Uses ExcelJS to reproduce the on-screen matrix (grouped headers, merged
 * cells, colored bands, borders, per-province NO. numbering, province totals,
 * signature footer). Formulas are kept where possible so the workbook stays
 * dynamic when a user edits monthly values.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS } from "@/lib/fsims-constants";
import {
  NUMBER_FMT,
  border,
  centerBoldWhite,
  fill,
  formatMilitaryTimestamp,
} from "@/lib/excel-style";

export interface ExportBucket {
  bplo: number;
  gov: number;
  peza: number;
  tieza: number;
}

export interface ExportStation {
  stationno: string;
  stationCode: string;
  stationName: string;
  cityName: string;
  months: Record<number, ExportBucket>;
}

export interface ExportProvinceGroup {
  province: string;
  stations: ExportStation[];
}

export interface ExportSignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

const CATS: { key: keyof ExportBucket; label: string }[] = [
  { key: "bplo", label: "BPLO" },
  { key: "gov", label: "Gov" },
  { key: "peza", label: "PEZA" },
  { key: "tieza", label: "TIEZA" },
];

// Column layout (1-based). NO=1, Province=2, City=3, Station=4.
const COL = {
  NO: 1,
  PROV: 2,
  CITY: 3,
  STATION: 4,
  MONTHS_START: 5, // 5..52 = 12 months × 4 cats
  QTOTAL_START: 53, // 53..68 = 4 quarters × 4 cats
  SEM1_START: 69, // 69..72
  SEM2_START: 73, // 73..76
  ANN_START: 77, // 77..80
  LAST: 80,
};

const monthCatCol = (monthIdx0: number, catIdx: number) =>
  COL.MONTHS_START + monthIdx0 * 4 + catIdx;
const qtotalCol = (qIdx0: number, catIdx: number) => COL.QTOTAL_START + qIdx0 * 4 + catIdx;

// Palette mirrors the centralized web theme tokens (see src/lib/theme.ts).
const FILL = {
  stationHead: "FF1D4ED8", // blue-700
  quarter: "FF065F46", // emerald-800
  month: "FF059669", // emerald-600
  cat: "FFD1FAE5", // emerald-100
  semester: "FFF97316", // orange-500
  annual: "FF1E3A8A", // blue-900
  provHeader: "FFE2E8F0", // slate-200
  provTotal: "FFFEF08A", // yellow-200
  numberCol: "FFEFF6FF", // very light blue
};

export async function exportTargetMatrix(opts: {
  year: number;
  groups: ExportProvinceGroup[];
  signatory?: ExportSignatory;
  filename?: string;
}) {
  const { year, groups, signatory, filename } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Target Matrix ${year}`, {
    views: [{ state: "frozen", xSplit: 4, ySplit: 4, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // -------------------------------------------------------------- Title row
  ws.mergeCells(1, 1, 1, COL.LAST);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `FIRE SAFETY INSPECTION TARGET MATRIX — ${year}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 26;

  // ---------------------------------------------------------- Header rows
  // Row 2: banner row  (Station Info | Q1 | Q2 | Q3 | Q4 | Q totals | Sem1 | Sem2 | Annual)
  // Row 3: month names / (blank for rowspan groups above)
  // Row 4: category labels row (BPLO/Gov/PEZA/TIEZA)
  const HR1 = 2;
  const HR2 = 3;
  const HR3 = 4;

  // Station Information header — merge A2:D4 vertically
  ws.mergeCells(HR1, COL.NO, HR3, COL.STATION);
  const stationHead = ws.getCell(HR1, COL.NO);
  stationHead.value = "Station Information";
  stationHead.fill = fill(FILL.stationHead);
  Object.assign(stationHead, centerBoldWhite());

  // Quarter banners over 12 monthly cat cells each
  const quarters = [
    { label: "Target First Quarter", months: [0, 1, 2] },
    { label: "Target Second Quarter", months: [3, 4, 5] },
    { label: "Target Third Quarter", months: [6, 7, 8] },
    { label: "Target Fourth Quarter", months: [9, 10, 11] },
  ];
  quarters.forEach((q, qi) => {
    const c1 = monthCatCol(qi * 3, 0);
    const c2 = monthCatCol(qi * 3 + 2, 3);
    ws.mergeCells(HR1, c1, HR1, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = q.label;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
  });

  // Month names on row 3, each spanning 4 category cols
  for (let m = 0; m < 12; m++) {
    const c1 = monthCatCol(m, 0);
    const c2 = monthCatCol(m, 3);
    ws.mergeCells(HR2, c1, HR2, c2);
    const cell = ws.getCell(HR2, c1);
    cell.value = MONTHS[m].name.toUpperCase();
    cell.fill = fill(FILL.month);
    Object.assign(cell, centerBoldWhite());
  }

  // Category labels on row 4 for each of 12 months
  for (let m = 0; m < 12; m++) {
    CATS.forEach((c, ci) => {
      const cell = ws.getCell(HR3, monthCatCol(m, ci));
      cell.value = c.label;
      cell.fill = fill(FILL.cat);
      cell.font = { bold: true, size: 9, color: { argb: "FF064E3B" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = border();
    });
  }

  // Quarter totals — merge HR1:HR2 header, cats on HR3
  quarters.forEach((q, qi) => {
    const c1 = qtotalCol(qi, 0);
    const c2 = qtotalCol(qi, 3);
    ws.mergeCells(HR1, c1, HR2, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = q.label;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
    CATS.forEach((c, ci) => {
      const sub = ws.getCell(HR3, qtotalCol(qi, ci));
      sub.value = c.label;
      sub.fill = fill(FILL.cat);
      sub.font = { bold: true, size: 9, color: { argb: "FF064E3B" } };
      sub.alignment = { horizontal: "center", vertical: "middle" };
      sub.border = border();
    });
  });

  const bigTotals: { start: number; label: string; color: string }[] = [
    { start: COL.SEM1_START, label: "Target First Semester", color: FILL.semester },
    { start: COL.SEM2_START, label: "Target Second Semester", color: FILL.semester },
    { start: COL.ANN_START, label: "Annual Total", color: FILL.annual },
  ];
  bigTotals.forEach((bt) => {
    ws.mergeCells(HR1, bt.start, HR2, bt.start + 3);
    const cell = ws.getCell(HR1, bt.start);
    cell.value = bt.label;
    cell.fill = fill(bt.color);
    Object.assign(cell, centerBoldWhite());
    CATS.forEach((c, ci) => {
      const sub = ws.getCell(HR3, bt.start + ci);
      sub.value = c.label;
      sub.fill = fill(FILL.cat);
      sub.font = { bold: true, size: 9, color: { argb: "FF064E3B" } };
      sub.alignment = { horizontal: "center", vertical: "middle" };
      sub.border = border();
    });
  });

  [HR1, HR2, HR3].forEach((r) => (ws.getRow(r).height = r === HR3 ? 20 : 22));

  // --------------------------------------------------------- Body rows
  let cursor = HR3 + 1;

  const writeStationRow = (station: ExportStation, seq: number, provinceName: string) => {
    const row = ws.getRow(cursor);
    row.getCell(COL.NO).value = seq;
    row.getCell(COL.PROV).value = provinceName;
    row.getCell(COL.CITY).value = station.cityName || "";
    row.getCell(COL.STATION).value =
      `${station.stationCode ? station.stationCode + "  " : ""}${station.stationName}`;

    // Monthly numeric cells
    for (let m = 0; m < 12; m++) {
      const b = station.months[m + 1] ?? { bplo: 0, gov: 0, peza: 0, tieza: 0 };
      CATS.forEach((c, ci) => {
        const cell = row.getCell(monthCatCol(m, ci));
        cell.value = Number(b[c.key]) || 0;
        cell.numFmt = NUMBER_FMT;
      });
    }
    // Quarter totals (formulas summing 3 monthly cells)
    quarters.forEach((q, qi) => {
      CATS.forEach((_c, ci) => {
        const refs = q.months.map((mIdx) => {
          const addr = ws.getCell(cursor, monthCatCol(mIdx, ci)).address;
          return addr;
        });
        const cell = row.getCell(qtotalCol(qi, ci));
        cell.value = { formula: refs.join("+") } as ExcelJS.CellFormulaValue;
        cell.numFmt = NUMBER_FMT;
      });
    });
    // Sem1 / Sem2 / Annual formulas from quarter totals
    CATS.forEach((_c, ci) => {
      const q1 = ws.getCell(cursor, qtotalCol(0, ci)).address;
      const q2 = ws.getCell(cursor, qtotalCol(1, ci)).address;
      const q3 = ws.getCell(cursor, qtotalCol(2, ci)).address;
      const q4 = ws.getCell(cursor, qtotalCol(3, ci)).address;
      row.getCell(COL.SEM1_START + ci).value = {
        formula: `${q1}+${q2}`,
      } as ExcelJS.CellFormulaValue;
      row.getCell(COL.SEM2_START + ci).value = {
        formula: `${q3}+${q4}`,
      } as ExcelJS.CellFormulaValue;
      row.getCell(COL.ANN_START + ci).value = {
        formula: `${q1}+${q2}+${q3}+${q4}`,
      } as ExcelJS.CellFormulaValue;
      [COL.SEM1_START, COL.SEM2_START, COL.ANN_START].forEach((base) => {
        row.getCell(base + ci).numFmt = NUMBER_FMT;
      });
    });

    // Styling: text cells left/centered, numeric cells centered
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

    for (let col = COL.MONTHS_START; col <= COL.LAST; col++) {
      const cell = row.getCell(col);
      if (stationRows.length > 0) {
        const refs = stationRows.map((r) => ws.getCell(r, col).address).join("+");
        cell.value = { formula: refs } as ExcelJS.CellFormulaValue;
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

  const provinceTotalRows: number[] = [];
  groups.forEach((g) => {
    const stationRowNums: number[] = [];
    g.stations.forEach((s, i) => {
      stationRowNums.push(cursor);
      writeStationRow(s, i + 1, g.province);
    });
    provinceTotalRows.push(cursor);
    writeProvinceTotal(g.province, stationRowNums);
  });

  // Regional grand total — only when more than one province is present
  if (provinceTotalRows.length > 1) {
    const row = ws.getRow(cursor);
    ws.mergeCells(cursor, COL.NO, cursor, COL.STATION);
    const labelCell = row.getCell(COL.NO);
    labelCell.value = "REGIONAL GRAND TOTAL — MIMAROPA";
    labelCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    labelCell.alignment = { horizontal: "center", vertical: "middle" };
    labelCell.fill = fill("FF0F766E");
    labelCell.border = border("medium", "FF334155");

    for (let col = COL.MONTHS_START; col <= COL.LAST; col++) {
      const cell = row.getCell(col);
      const refs = provinceTotalRows.map((r) => ws.getCell(r, col).address).join("+");
      cell.value = { formula: refs } as ExcelJS.CellFormulaValue;
      cell.numFmt = NUMBER_FMT;
      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = fill("FF0F766E");
      cell.border = border();
    }
    row.height = 24;
    cursor++;
  }


  // -------------------------------------------------- Column widths
  ws.getColumn(COL.NO).width = 5;
  ws.getColumn(COL.PROV).width = 22;
  ws.getColumn(COL.CITY).width = 22;
  ws.getColumn(COL.STATION).width = 30;
  for (let c = COL.MONTHS_START; c <= COL.LAST; c++) {
    ws.getColumn(c).width = 8;
  }

  // -------------------------------------------------- Signature footer
  cursor += 2; // two blank rows
  const sigStart = cursor;
  ws.mergeCells(sigStart, 1, sigStart, 6);
  const genCell = ws.getCell(sigStart, 1);
  genCell.value = "Generated by:";
  genCell.font = { bold: true, italic: true, size: 11 };
  genCell.alignment = { horizontal: "left", vertical: "middle" };

  // Two blank rows before the signature block
  cursor = sigStart + 1;
  for (let i = 0; i < 2; i++) {
    ws.mergeCells(cursor, 1, cursor, 6);
    ws.getRow(cursor).height = 18;
    cursor++;
  }

  const nameRow = cursor;
  ws.mergeCells(nameRow, 1, nameRow, 6);
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
  ws.mergeCells(desigRow, 1, desigRow, 6);
  const desigCell = ws.getCell(desigRow, 1);
  desigCell.value = signatory?.designation || "Designation";
  desigCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  desigCell.alignment = { horizontal: "left", vertical: "middle" };

  cursor++;
  const generatedDateRow = cursor;
  ws.mergeCells(generatedDateRow, 1, generatedDateRow, 6);
  const generatedDateCell = ws.getCell(generatedDateRow, 1);
  generatedDateCell.value = `Date Generated: ${formatMilitaryTimestamp(new Date())}`;
  generatedDateCell.font = { size: 10, color: { argb: "FF475569" } };
  generatedDateCell.alignment = { horizontal: "left", vertical: "middle" };

  // Set print area
  ws.pageSetup.printArea = `A1:${ws.getCell(generatedDateRow, COL.LAST).address}`;
  ws.pageSetup.printTitlesRow = `${HR1}:${HR3}`;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename ?? `TargetMatrix_${year}.xlsx`,
  );
}
