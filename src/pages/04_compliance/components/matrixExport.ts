/**
 * Rich Excel export for the Fire Safety Compliance Matrix.
 *
 * Layout mirrors the on-screen matrix exactly:
 *   • 5 banded header rows — Quarter / Month / Category / Sub-group / Leaf
 *   • INSPECTION → During | After | 1st BPLO (Target/Issuance) | 1st GOV | 1st PEZA | 1st TIEZA
 *   • FSEC | FSIC | NOTICES → flat leaf columns
 *   • Two body rows per station (MANUAL then FSIS); INSPECTION cells and the
 *     station identity cells are merged vertically across both mode rows.
 * Totals use Excel SUM formulas so the workbook stays self-recalculating.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS } from "@/lib/fsims-constants";
import { MONTH_COLORS } from "./monthColors";
import {
  NUMBER_FMT,
  border,
  centerBoldWhite,
  fill,
  formatMilitaryTimestamp,
} from "@/lib/excel-style";

export interface ComplianceField {
  key: string;
  label: string;
  /** Category the field belongs to (INSPECTION | FSEC | FSIC | NOTICES). */
  category?: string;
  /** Sub-group label (e.g. "1st BPLO"); undefined for flat columns. */
  group?: string;
  /** Leaf label under a sub-group (e.g. "Target" / "Issuance"). */
  leafLabel?: string;
}

export interface ComplianceExportMode {
  label: string;
  /** month(1..12) → fieldKey → value */
  months: Record<number, Record<string, number>>;
}

export interface ComplianceExportStation {
  stationno: string;
  stationCode: string;
  stationName: string;
  cityName: string;
  /** Combined (all modes) values — used for the merged INSPECTION cells. */
  months: Record<number, Record<string, number>>;
  /** One body row per issuance mode, in order (MANUAL, FSIS). */
  modes: ComplianceExportMode[];
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

/** Per-category header banding. */
const CATEGORY_FILL: Record<string, { fg: string; font: string }> = {
  INSPECTION: { fg: "FF0EA5E9", font: "FFFFFFFF" },
  FSEC: { fg: "FF10B981", font: "FFFFFFFF" },
  FSIC: { fg: "FFF59E0B", font: "FF1F2937" },
  NOTICES: { fg: "FFF43F5E", font: "FFFFFFFF" },
  DEFAULT: { fg: "FF64748B", font: "FFFFFFFF" },
};

function catStyle(cat?: string) {
  return CATEGORY_FILL[cat ?? "DEFAULT"] ?? CATEGORY_FILL.DEFAULT;
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

  const isInspection = (f: ComplianceField) => (f.category ?? "") === "INSPECTION";

  // Contiguous category runs (INSPECTION | FSEC | FSIC | NOTICES).
  type Run = { category: string; start: number; end: number };
  const runs: Run[] = [];
  fields.forEach((f, idx) => {
    const c = f.category ?? "";
    const last = runs[runs.length - 1];
    if (last && last.category === c) last.end = idx;
    else runs.push({ category: c, start: idx, end: idx });
  });

  // Contiguous sub-group runs — grouped columns (Target/Issuance) get a
  // sub-header, flat columns span the sub-group + leaf rows.
  type GroupRun = { label: string; category: string; start: number; end: number; grouped: boolean };
  const groupRuns: GroupRun[] = [];
  fields.forEach((f, idx) => {
    const last = groupRuns[groupRuns.length - 1];
    if (
      f.group &&
      last &&
      last.grouped &&
      last.label === f.group &&
      last.category === (f.category ?? "")
    ) {
      last.end = idx;
    } else {
      groupRuns.push({
        label: f.group ?? f.label,
        category: f.category ?? "",
        start: idx,
        end: idx,
        grouped: Boolean(f.group),
      });
    }
  });

  // Column layout: NO | Province | City | Station | Mode | months × fields | q-totals | sem1 | sem2 | annual
  const COL = { NO: 1, PROV: 2, CITY: 3, STATION: 4, MODE: 5, MONTHS_START: 6 };
  const QTOTAL_START = COL.MONTHS_START + 12 * catSpan;
  const SEM1_START = QTOTAL_START + 4 * catSpan;
  const SEM2_START = SEM1_START + catSpan;
  const ANN_START = SEM2_START + catSpan;
  const LAST = ANN_START + catSpan - 1;

  const monthCatCol = (monthIdx0: number, catIdx: number) =>
    COL.MONTHS_START + monthIdx0 * catSpan + catIdx;
  const qtotalCol = (qIdx0: number, catIdx: number) => QTOTAL_START + qIdx0 * catSpan + catIdx;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();
  const ws = wb.addWorksheet(`Compliance Matrix ${year}`, {
    views: [{ state: "frozen", xSplit: 5, ySplit: 6, showGridLines: false }],
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
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 26;

  //  HR1 — Quarter / Semester / Annual banners
  //  HR2 — Month names
  //  HR3 — Category banners
  //  HR4 — Sub-group labels (flat columns merge HR4:HR5)
  //  HR5 — Leaf labels (Target / Issuance)
  const HR1 = 2;
  const HR2 = 3;
  const HR3 = 4;
  const HR4 = 5;
  const HR5 = 6;

  // Station information + Mode of Issuance headers
  ws.mergeCells(HR1, COL.NO, HR5, COL.STATION);
  const stationHead = ws.getCell(HR1, COL.NO);
  stationHead.value = "Station Information";
  stationHead.fill = fill(FILL.stationHead);
  Object.assign(stationHead, centerBoldWhite());
  stationHead.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };

  ws.mergeCells(HR1, COL.MODE, HR5, COL.MODE);
  const modeHead = ws.getCell(HR1, COL.MODE);
  modeHead.value = "Mode of Issuance";
  modeHead.fill = fill(FILL.stationHead);
  Object.assign(modeHead, centerBoldWhite());

  const quarters = [
    { label: "First Quarter", months: [0, 1, 2] },
    { label: "Second Quarter", months: [3, 4, 5] },
    { label: "Third Quarter", months: [6, 7, 8] },
    { label: "Fourth Quarter", months: [9, 10, 11] },
  ];

  quarters.forEach((q, qi) => {
    const c1 = monthCatCol(qi * 3, 0);
    const c2 = monthCatCol(qi * 3 + 2, catSpan - 1);
    ws.mergeCells(HR1, c1, HR1, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = q.label;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
  });

  for (let m = 0; m < 12; m++) {
    const c1 = monthCatCol(m, 0);
    const c2 = monthCatCol(m, catSpan - 1);
    ws.mergeCells(HR2, c1, HR2, c2);
    const cell = ws.getCell(HR2, c1);
    cell.value = MONTHS[m].name.toUpperCase();
    cell.fill = fill(MONTH_COLORS[m].argb);
    Object.assign(cell, centerBoldWhite());
  }

  const paintCategoryBanner = (row: number, baseCol: number, run: Run) => {
    const c1 = baseCol + run.start;
    const c2 = baseCol + run.end;
    if (c2 > c1) ws.mergeCells(row, c1, row, c2);
    const style = catStyle(run.category);
    const cell = ws.getCell(row, c1);
    cell.value = run.category === "NOTICES" ? "ISSUED NOTICES" : run.category || "";
    cell.fill = fill(style.fg);
    cell.font = { bold: true, size: 10, color: { argb: style.font } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border("thin", "FF334155");
  };

  /** Sub-group row (HR4) + leaf row (HR5) for one column block. */
  const paintFieldLabels = (baseCol: number) => {
    groupRuns.forEach((g) => {
      const c1 = baseCol + g.start;
      const c2 = baseCol + g.end;
      if (g.grouped) {
        if (c2 > c1) ws.mergeCells(HR4, c1, HR4, c2);
        const cell = ws.getCell(HR4, c1);
        cell.value = g.label;
        cell.fill = fill(FILL.fieldLabel);
        cell.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = border();
        for (let i = g.start; i <= g.end; i++) {
          const leaf = ws.getCell(HR5, baseCol + i);
          leaf.value = fields[i].leafLabel ?? fields[i].label;
          leaf.fill = fill(FILL.fieldLabel);
          leaf.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
          leaf.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          leaf.border = border();
        }
      } else {
        ws.mergeCells(HR4, c1, HR5, c1);
        const cell = ws.getCell(HR4, c1);
        cell.value = g.label;
        cell.fill = fill(FILL.fieldLabel);
        cell.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = border();
      }
    });
  };

  for (let m = 0; m < 12; m++) {
    const base = monthCatCol(m, 0);
    runs.forEach((run) => paintCategoryBanner(HR3, base, run));
    paintFieldLabels(base);
  }

  quarters.forEach((q, qi) => {
    const c1 = qtotalCol(qi, 0);
    const c2 = qtotalCol(qi, catSpan - 1);
    ws.mergeCells(HR1, c1, HR2, c2);
    const cell = ws.getCell(HR1, c1);
    cell.value = `${q.label} Total`;
    cell.fill = fill(FILL.quarter);
    Object.assign(cell, centerBoldWhite());
    runs.forEach((run) => paintCategoryBanner(HR3, c1, run));
    paintFieldLabels(c1);
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
    paintFieldLabels(bt.start);
  });

  ws.getRow(HR1).height = 24;
  ws.getRow(HR2).height = 22;
  ws.getRow(HR3).height = 20;
  ws.getRow(HR4).height = 24;
  ws.getRow(HR5).height = 22;

  // ------------------------------ Body ------------------------------------
  let cursor = HR5 + 1;

  /** Writes the aggregate (quarter / semester / annual) formulas for one row. */
  const writeAggregates = (rowNumber: number, only: (f: ComplianceField) => boolean) => {
    const row = ws.getRow(rowNumber);
    quarters.forEach((q, qi) => {
      fields.forEach((f, ci) => {
        if (!only(f)) return;
        const refs = q.months.map((mIdx) => ws.getCell(rowNumber, monthCatCol(mIdx, ci)).address);
        const cell = row.getCell(qtotalCol(qi, ci));
        cell.value = { formula: `SUM(${refs.join(",")})` } as ExcelJS.CellFormulaValue;
        cell.numFmt = NUMBER_FMT;
      });
    });
    fields.forEach((f, ci) => {
      if (!only(f)) return;
      const q1 = ws.getCell(rowNumber, qtotalCol(0, ci)).address;
      const q2 = ws.getCell(rowNumber, qtotalCol(1, ci)).address;
      const q3 = ws.getCell(rowNumber, qtotalCol(2, ci)).address;
      const q4 = ws.getCell(rowNumber, qtotalCol(3, ci)).address;
      row.getCell(SEM1_START + ci).value = {
        formula: `SUM(${q1},${q2})`,
      } as ExcelJS.CellFormulaValue;
      row.getCell(SEM2_START + ci).value = {
        formula: `SUM(${q3},${q4})`,
      } as ExcelJS.CellFormulaValue;
      row.getCell(ANN_START + ci).value = {
        formula: `SUM(${q1},${q2},${q3},${q4})`,
      } as ExcelJS.CellFormulaValue;
      [SEM1_START, SEM2_START, ANN_START].forEach((base) => {
        row.getCell(base + ci).numFmt = NUMBER_FMT;
      });
    });
  };

  const styleBodyRow = (rowNumber: number) => {
    const row = ws.getRow(rowNumber);
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
      } else if (colNumber === COL.MODE) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { size: 10, bold: true };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.font = { size: 10 };
      }
    });
    row.height = 22;
  };

  /** Two rows per station — returns the anchor (first) row number. */
  const writeStationRows = (
    station: ComplianceExportStation,
    seq: number,
    provinceName: string,
  ): number => {
    const anchor = cursor;
    const modes = station.modes.length > 0 ? station.modes : [{ label: "MANUAL", months: {} }];

    modes.forEach((mode, mi) => {
      const rowNumber = anchor + mi;
      const row = ws.getRow(rowNumber);
      if (mi === 0) {
        row.getCell(COL.NO).value = seq;
        row.getCell(COL.PROV).value = provinceName;
        row.getCell(COL.CITY).value = station.cityName || "";
        row.getCell(COL.STATION).value =
          `${station.stationCode ? station.stationCode + "  " : ""}${station.stationName}`;
      }
      row.getCell(COL.MODE).value = mode.label;

      for (let m = 0; m < 12; m++) {
        const bucket = mode.months[m + 1] ?? {};
        const combined = station.months[m + 1] ?? {};
        fields.forEach((f, ci) => {
          if (isInspection(f)) {
            if (mi !== 0) return; // merged vertically onto the anchor row
            const cell = row.getCell(monthCatCol(m, ci));
            cell.value = Number(combined[f.key]) || 0;
            cell.numFmt = NUMBER_FMT;
            return;
          }
          const cell = row.getCell(monthCatCol(m, ci));
          cell.value = Number(bucket[f.key]) || 0;
          cell.numFmt = NUMBER_FMT;
        });
      }
      writeAggregates(rowNumber, (f) => (mi === 0 ? true : !isInspection(f)));
      styleBodyRow(rowNumber);
    });

    const last = anchor + modes.length - 1;
    if (modes.length > 1) {
      [COL.NO, COL.PROV, COL.CITY, COL.STATION].forEach((c) => ws.mergeCells(anchor, c, last, c));
      // Merge every INSPECTION column vertically across the mode rows.
      const mergeInspection = (baseCol: number) => {
        fields.forEach((f, ci) => {
          if (isInspection(f)) ws.mergeCells(anchor, baseCol + ci, last, baseCol + ci);
        });
      };
      for (let m = 0; m < 12; m++) mergeInspection(monthCatCol(m, 0));
      for (let qi = 0; qi < 4; qi++) mergeInspection(qtotalCol(qi, 0));
      [SEM1_START, SEM2_START, ANN_START].forEach((base) => mergeInspection(base));
    }

    cursor = last + 1;
    return anchor;
  };

  const writeProvinceTotals = (province: string, anchors: number[], modeLabels: string[]) => {
    const start = cursor;
    const last = start + modeLabels.length - 1;

    modeLabels.forEach((label, mi) => {
      const rowNumber = start + mi;
      const row = ws.getRow(rowNumber);
      row.getCell(COL.MODE).value = label;

      for (let col = COL.MONTHS_START; col <= LAST; col++) {
        const ci = (col - COL.MONTHS_START) % catSpan;
        const field = fields[ci];
        const inspection = isInspection(field);
        if (inspection && mi !== 0) continue;
        const cell = row.getCell(col);
        if (anchors.length > 0) {
          const refs = anchors
            .map((a) => ws.getCell(inspection ? a : a + mi, col).address)
            .join(",");
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

      const labelCell = row.getCell(COL.NO);
      if (mi === 0) labelCell.value = `PROVINCIAL TOTAL — ${province.toUpperCase()}`;
      [COL.NO, COL.PROV, COL.CITY, COL.STATION, COL.MODE].forEach((c) => {
        const cell = row.getCell(c);
        cell.font = { bold: true, size: 10, color: { argb: "FF713F12" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = fill(FILL.provTotal);
        cell.border = border("medium", "FF334155");
      });
      row.height = 22;
    });

    if (modeLabels.length > 1) {
      ws.mergeCells(start, COL.NO, last, COL.STATION);
      const mergeInspection = (baseCol: number) => {
        fields.forEach((f, ci) => {
          if (isInspection(f)) ws.mergeCells(start, baseCol + ci, last, baseCol + ci);
        });
      };
      for (let m = 0; m < 12; m++) mergeInspection(monthCatCol(m, 0));
      for (let qi = 0; qi < 4; qi++) mergeInspection(qtotalCol(qi, 0));
      [SEM1_START, SEM2_START, ANN_START].forEach((base) => mergeInspection(base));
    } else {
      ws.mergeCells(start, COL.NO, start, COL.STATION);
    }

    cursor = last + 1;
  };

  /** Regional grand total rows — sums the provincial total rows. */
  const writeGrandTotals = (provinceStarts: number[], modeLabels: string[]) => {
    const start = cursor;
    const last = start + modeLabels.length - 1;
    const GRAND = "FF0F766E";

    modeLabels.forEach((label, mi) => {
      const rowNumber = start + mi;
      const row = ws.getRow(rowNumber);
      row.getCell(COL.MODE).value = label;

      for (let col = COL.MONTHS_START; col <= LAST; col++) {
        const ci = (col - COL.MONTHS_START) % catSpan;
        const field = fields[ci];
        const inspection = isInspection(field);
        if (inspection && mi !== 0) continue;
        const cell = row.getCell(col);
        const refs = provinceStarts
          .map((p) => ws.getCell(inspection ? p : p + mi, col).address)
          .join(",");
        cell.value = { formula: `SUM(${refs})` } as ExcelJS.CellFormulaValue;
        cell.numFmt = NUMBER_FMT;
        cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = fill(GRAND);
        cell.border = border();
      }

      const labelCell = row.getCell(COL.NO);
      if (mi === 0) labelCell.value = "REGIONAL GRAND TOTAL — MIMAROPA";
      [COL.NO, COL.PROV, COL.CITY, COL.STATION, COL.MODE].forEach((c) => {
        const cell = row.getCell(c);
        cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = fill(GRAND);
        cell.border = border("medium", "FF334155");
      });
      row.height = 22;
    });

    if (modeLabels.length > 1) {
      ws.mergeCells(start, COL.NO, last, COL.STATION);
      const mergeInspection = (baseCol: number) => {
        fields.forEach((f, ci) => {
          if (isInspection(f)) ws.mergeCells(start, baseCol + ci, last, baseCol + ci);
        });
      };
      for (let m = 0; m < 12; m++) mergeInspection(monthCatCol(m, 0));
      for (let qi = 0; qi < 4; qi++) mergeInspection(qtotalCol(qi, 0));
      [SEM1_START, SEM2_START, ANN_START].forEach((base) => mergeInspection(base));
    } else {
      ws.mergeCells(start, COL.NO, start, COL.STATION);
    }

    cursor = last + 1;
  };

  const provinceTotalStarts: number[] = [];
  let grandModeLabels: string[] = ["MANUAL", "FSIS"];
  groups.forEach((g) => {
    const anchors: number[] = [];
    const modeLabels = g.stations[0]?.modes.map((m) => m.label) ?? ["MANUAL", "FSIS"];
    grandModeLabels = modeLabels;
    g.stations.forEach((s, i) => {
      anchors.push(writeStationRows(s, i + 1, g.province));
    });
    provinceTotalStarts.push(cursor);
    writeProvinceTotals(g.province, anchors, modeLabels);
  });

  // Regional grand total — only when more than one province is present
  if (provinceTotalStarts.length > 1) {
    writeGrandTotals(provinceTotalStarts, grandModeLabels);
  }


  // Column widths
  ws.getColumn(COL.NO).width = 5;
  ws.getColumn(COL.PROV).width = 22;
  ws.getColumn(COL.CITY).width = 22;
  ws.getColumn(COL.STATION).width = 30;
  ws.getColumn(COL.MODE).width = 14;
  for (let c = COL.MONTHS_START; c <= LAST; c++) {
    ws.getColumn(c).width = 8;
  }

  // ------------------------------ Signature footer -------------------------
  cursor++;
  const genRow = cursor;
  ws.mergeCells(genRow, 1, genRow, 7);
  const genCell = ws.getCell(genRow, 1);
  genCell.value = "Generated by:";
  genCell.font = { bold: true, italic: true, size: 11 };
  genCell.alignment = { horizontal: "left", vertical: "middle" };
  cursor++;

  for (let i = 0; i < 2; i++) {
    ws.mergeCells(cursor, 1, cursor, 7);
    ws.getRow(cursor).height = 18;
    cursor++;
  }

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
  cursor++;

  const generatedDateRow = cursor;
  ws.mergeCells(generatedDateRow, 1, generatedDateRow, 7);
  const generatedDateCell = ws.getCell(generatedDateRow, 1);
  generatedDateCell.value = `Date Generated: ${formatMilitaryTimestamp(new Date())}`;
  generatedDateCell.font = { size: 10, color: { argb: "FF475569" } };
  generatedDateCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.pageSetup.printArea = `A1:${ws.getCell(generatedDateRow, LAST).address}`;
  ws.pageSetup.printTitlesRow = `${HR1}:${HR5}`;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename ?? `ComplianceMatrix_${year}.xlsx`,
  );
}
