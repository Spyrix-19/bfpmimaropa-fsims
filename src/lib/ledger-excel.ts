import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  NUMBER_FMT,
  categoryHeaderStyle,
  crownHeaderStyle,
  dataCellStyle,
  dataRowStyle,
  fill,
  formatMilitaryTimestamp,
  provinceRowStyle,
  titleStyle,
} from "@/lib/excel-style";

/* ------------------------------------------------------------------ *
 * Shared station-ledger workbook writer.
 * Mirrors the Compliance / Target Reference workbook layout: title
 * banner, "Station Information" crown, grouped metric crown, station
 * rows grouped per province, provincial totals and signatory footer.
 * ------------------------------------------------------------------ */

export interface LedgerExcelField {
  key: string;
  label: string;
}

export interface LedgerExcelStation {
  stationname: string;
  unitcode: string;
  cityname: string;
  provincename: string;
  [key: string]: unknown;
}

export interface LedgerExcelSignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

const toNum = (v: unknown) => Number(v ?? 0) || 0;

export async function exportStationLedgerWorkbook(opts: {
  title: string;
  crownLabel: string;
  rows: LedgerExcelStation[];
  fields: LedgerExcelField[];
  totalLabel: string;
  sheetName?: string;
  filename?: string;
  signatory?: LedgerExcelSignatory;
}) {
  const { title, crownLabel, rows, fields, totalLabel, signatory } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();

  const ws = wb.addWorksheet(opts.sheetName ?? title.slice(0, 28), {
    views: [{ state: "frozen", xSplit: 4, ySplit: 3, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  const dataStartCol = 5;
  const metricCount = fields.length + 1; // metrics + total column
  const lastCol = dataStartCol + metricCount - 1;

  // Title banner
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `${title.toUpperCase()} — STATION LEDGER`;
  Object.assign(titleCell, titleStyle());
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 30;

  // Station Information crown (rows 2-3, cols 1-4)
  ws.mergeCells(2, 1, 3, 4);
  const stationInfoHeader = ws.getCell(2, 1);
  stationInfoHeader.value = "Station Information";
  stationInfoHeader.fill = fill("FF1D4ED8");
  Object.assign(stationInfoHeader, crownHeaderStyle());

  // Metric crown (row 2) + leaf headers (row 3)
  ws.mergeCells(2, dataStartCol, 2, lastCol);
  const crownCell = ws.getCell(2, dataStartCol);
  crownCell.value = crownLabel.toUpperCase();
  Object.assign(crownCell, crownHeaderStyle());
  crownCell.fill = fill("FF0F766E");

  const leafRow = ws.getRow(3);
  [...fields.map((f) => f.label), totalLabel].forEach((label, idx) => {
    const cell = leafRow.getCell(dataStartCol + idx);
    cell.value = label;
    cell.fill = fill(idx === fields.length ? "FFFDE68A" : "FFD1FAE5");
    Object.assign(cell, categoryHeaderStyle());
  });

  ws.getRow(2).height = 26;
  ws.getRow(3).height = 22;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 34;
  for (let c = dataStartCol; c <= lastCol; c++) ws.getColumn(c).width = 16;

  // Group rows per province
  const provinceGroups = new Map<string, LedgerExcelStation[]>();
  rows.forEach((row) => {
    const province = row.provincename || "—";
    const list = provinceGroups.get(province) ?? [];
    list.push(row);
    provinceGroups.set(province, list);
  });

  let cursor = 4;
  const provinceNames = Array.from(provinceGroups.keys()).sort((a, b) => a.localeCompare(b));

  provinceNames.forEach((provinceName, provinceIndex) => {
    const stations = (provinceGroups.get(provinceName) ?? []).sort((a, b) =>
      String(a.stationname).localeCompare(String(b.stationname)),
    );

    stations.forEach((station, stationIndex) => {
      const row = ws.getRow(cursor);
      const isAlternate = stationIndex % 2 === 1;
      row.getCell(1).value = stationIndex + 1;
      row.getCell(2).value = provinceName;
      row.getCell(3).value = station.unitcode;
      row.getCell(4).value = station.stationname;
      for (let c = 1; c <= 4; c++) Object.assign(row.getCell(c), dataRowStyle(isAlternate));
      row.getCell(4).alignment = { horizontal: "left", vertical: "middle" };

      const values = fields.map((f) => toNum(station[f.key]));
      [...values, values.reduce((a, b) => a + b, 0)].forEach((value, idx) => {
        const cell = row.getCell(dataStartCol + idx);
        cell.value = value;
        cell.numFmt = NUMBER_FMT;
        Object.assign(cell, dataCellStyle());
        if (isAlternate) cell.fill = fill("FFF8FAFC");
        if (idx === fields.length) cell.font = { size: 10, bold: true };
      });

      row.height = 22;
      cursor++;
    });

    // Provincial total
    const provinceRow = ws.getRow(cursor);
    ws.mergeCells(cursor, 1, cursor, 4);
    const labelCell = provinceRow.getCell(1);
    labelCell.value = `PROVINCIAL TOTAL — ${provinceName.toUpperCase()}`;
    labelCell.fill = fill("FFFEF08A");
    Object.assign(labelCell, provinceRowStyle());

    const totals = fields.map((f) => stations.reduce((sum, s) => sum + toNum(s[f.key]), 0));
    [...totals, totals.reduce((a, b) => a + b, 0)].forEach((value, idx) => {
      const cell = provinceRow.getCell(dataStartCol + idx);
      cell.value = value;
      cell.numFmt = NUMBER_FMT;
      cell.fill = fill("FFFEF08A");
      Object.assign(cell, provinceRowStyle());
    });

    provinceRow.height = 24;
    cursor++;

    if (provinceIndex < provinceNames.length - 1) {
      ws.getRow(cursor).height = 8;
      cursor++;
    }
  });

  // Regional grand total
  const grandRow = ws.getRow(cursor + 1);
  ws.mergeCells(cursor + 1, 1, cursor + 1, 4);
  const grandLabel = grandRow.getCell(1);
  grandLabel.value = "REGIONAL GRAND TOTAL — MIMAROPA";
  grandLabel.fill = fill("FF0F766E");
  Object.assign(grandLabel, provinceRowStyle());
  grandLabel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };

  const grandTotals = fields.map((f) => rows.reduce((sum, s) => sum + toNum(s[f.key]), 0));
  [...grandTotals, grandTotals.reduce((a, b) => a + b, 0)].forEach((value, idx) => {
    const cell = grandRow.getCell(dataStartCol + idx);
    cell.value = value;
    cell.numFmt = NUMBER_FMT;
    cell.fill = fill("FF0F766E");
    Object.assign(cell, provinceRowStyle());
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  });
  grandRow.height = 24;
  cursor += 2;

  // Signatory footer
  const footerStart = cursor + 2;
  ws.mergeCells(footerStart, 1, footerStart, 6);
  const genCell = ws.getCell(footerStart, 1);
  genCell.value = "Generated by:";
  genCell.font = { bold: true, italic: true, size: 11 };
  genCell.alignment = { horizontal: "left", vertical: "middle" };

  let signatureRow = footerStart + 1;
  for (let i = 0; i < 2; i++) {
    ws.mergeCells(signatureRow, 1, signatureRow, 6);
    ws.getRow(signatureRow).height = 18;
    signatureRow++;
  }

  const nameRow = signatureRow;
  ws.mergeCells(nameRow, 1, nameRow, 6);
  const nameCell = ws.getCell(nameRow, 1);
  const rankFullName = [signatory?.rank, signatory?.fullname].filter(Boolean).join(" ").trim();
  nameCell.value = rankFullName || "____________________________";
  nameCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  nameCell.alignment = { horizontal: "left", vertical: "middle" };
  nameCell.border = { top: { style: "thin", color: { argb: "FF334155" } } } as ExcelJS.Borders;

  const designationRow = nameRow + 1;
  ws.mergeCells(designationRow, 1, designationRow, 6);
  const designationCell = ws.getCell(designationRow, 1);
  designationCell.value = signatory?.designation || "Designation";
  designationCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  designationCell.alignment = { horizontal: "left", vertical: "middle" };

  const generatedDateRow = designationRow + 1;
  ws.mergeCells(generatedDateRow, 1, generatedDateRow, 6);
  const generatedDateCell = ws.getCell(generatedDateRow, 1);
  generatedDateCell.value = `Date Generated: ${formatMilitaryTimestamp(new Date())}`;
  generatedDateCell.font = { size: 10, color: { argb: "FF475569" } };
  generatedDateCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.pageSetup.printArea = `A1:${ws.getCell(generatedDateRow, lastCol).address}`;
  ws.pageSetup.printTitlesRow = "2:3";

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    opts.filename ?? `${title.replace(/\s+/g, "")}_${new Date().getFullYear()}.xlsx`,
  );
}
