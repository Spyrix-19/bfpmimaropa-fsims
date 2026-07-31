import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS, QUARTERS, HALVES } from "@/lib/fsims-constants";
import {
  addBucket,
  computeDailyFromList,
  computeDerivedFromList,
  emptyBucket,
  formatDayLabel,
  type TargetBucket,
  type TargetPeriod,
} from "../helpers";
import type { TargetReferenceClassModel } from "@/types/targetreferenceType";

export interface TargetReferenceExportGroup {
  province: string;
  stationCode: string;
  stationName: string;
  targetreferencelist: TargetReferenceClassModel[];
}

export interface TargetReferenceExportSignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

interface PeriodDef {
  key: string;
  label: string;
  getBucket: (list: TargetReferenceClassModel[]) => TargetBucket;
}

function fill(color: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
}

function border(style: ExcelJS.BorderStyle = "thin", color = "FF64748B"): ExcelJS.Borders {
  const b: Partial<ExcelJS.Border> = { style, color: { argb: color } };
  return {
    top: b as ExcelJS.Border,
    left: b as ExcelJS.Border,
    right: b as ExcelJS.Border,
    bottom: b as ExcelJS.Border,
    diagonal: {} as ExcelJS.Border,
  };
}

function titleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FF0F172A" }, size: 16 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border("medium", "FF0F172A"),
  };
}

function formatMilitaryTimestamp(value: Date): string {
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  const month = value.toLocaleString("en-US", { month: "long" });
  const year = value.getFullYear();
  return `${day} ${hours}${minutes}${seconds}H ${month} ${year}`;
}

function subtitleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: "FF0F172A" } },
    alignment: { horizontal: "left", vertical: "middle" },
    border: border("thin", "FFCBD5E1"),
  };
}

function crownHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: border("thin", "FF334155"),
  };
}

function categoryHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: "FF064E3B" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
  };
}

function dataCellStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
  };
}

function dataRowStyle(isAlternate: boolean): Partial<ExcelJS.Style> {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
    fill: isAlternate ? fill("FFF8FAFC") : undefined,
  };
}

function provinceRowStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: "FF713F12" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border("medium", "FF334155"),
  };
}

function buildPeriodDefs(
  interval: TargetPeriod,
  year: number,
  selectedMonths: number[],
  quarter: string,
  semester: string,
): PeriodDef[] {
  switch (interval) {
    case "MONTHLY": {
      return MONTHS.filter((m) => selectedMonths.includes(m.value)).map((m) => ({
        key: `m${m.value}`,
        label: m.name,
        getBucket: (list) => {
          const derived = computeDerivedFromList(list);
          return derived.monthly[m.value] ?? emptyBucket();
        },
      }));
    }
    case "QUARTERLY": {
      const quarters = quarter === "all" ? ["q1", "q2", "q3", "q4"] : [quarter];
      return quarters.flatMap((q) => {
        const idx = ["q1", "q2", "q3", "q4"].indexOf(q);
        if (idx < 0) return [];
        return [
          {
            key: q,
            label: QUARTERS[idx],
            getBucket: (list) => {
              const derived = computeDerivedFromList(list);
              return derived.quarters[idx] ?? emptyBucket();
            },
          },
        ];
      });
    }
    case "SEMI-ANNUAL": {
      const semesters = semester === "all" ? ["s1", "s2"] : [semester];
      return semesters.flatMap((s) => {
        const idx = ["s1", "s2"].indexOf(s);
        if (idx < 0) return [];
        return [
          {
            key: s,
            label: HALVES[idx],
            getBucket: (list) => {
              const derived = computeDerivedFromList(list);
              return derived.halves[idx] ?? emptyBucket();
            },
          },
        ];
      });
    }
    case "ANNUAL":
      return [
        {
          key: "annual",
          label: "Annual Total",
          getBucket: (list) => {
            const derived = computeDerivedFromList(list);
            return derived.annual ?? emptyBucket();
          },
        },
      ];
    case "DAILY": {
      const month = selectedMonths[0] ?? new Date().getMonth() + 1;
      const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
      return days.map((day) => ({
        key: `d${day}`,
        label: formatDayLabel(year, month, day),
        getBucket: (list) => {
          const daily = computeDailyFromList(list, year, month);
          return daily.daily[day] ?? emptyBucket();
        },
      }));
    }
    default:
      return [];
  }
}

export async function exportTargetReferenceWorkbook(opts: {
  year: number;
  groups: TargetReferenceExportGroup[];
  interval: TargetPeriod;
  selectedMonths: number[];
  quarter: string;
  semester: string;
  signatory?: TargetReferenceExportSignatory;
  filename?: string;
}) {
  const { year, groups, interval, selectedMonths, quarter, semester, signatory, filename } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();

  const ws = wb.addWorksheet(`Target Reference ${year}`, {
    views: [{ state: "frozen", xSplit: 4, ySplit: 5, showGridLines: false }],
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

  const periods = buildPeriodDefs(interval, year, selectedMonths, quarter, semester);
  const dataStartCol = 5;
  const lastCol = dataStartCol + periods.length * 4 - 1;

  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `TARGET REFERENCE EXPORT — ${year}`;
  Object.assign(titleCell, titleStyle());
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, 4);
  const metaIntervalCell = ws.getCell(2, 1);
  metaIntervalCell.value = `Interval: ${interval}`;
  Object.assign(metaIntervalCell, subtitleStyle());
  metaIntervalCell.fill = fill("FFF8FAFC");

  ws.mergeCells(2, 5, 2, 8);
  const metaMonthsCell = ws.getCell(2, 5);
  metaMonthsCell.value = `Months: ${selectedMonths.length ? selectedMonths.join(", ") : "All"}`;
  Object.assign(metaMonthsCell, subtitleStyle());
  metaMonthsCell.fill = fill("FFF8FAFC");

  ws.mergeCells(3, 1, 3, 4);
  const metaGeneratedCell = ws.getCell(3, 1);
  const generatedAt = new Date();
  metaGeneratedCell.value = `Generated: ${formatMilitaryTimestamp(generatedAt)}`;
  Object.assign(metaGeneratedCell, subtitleStyle());
  metaGeneratedCell.fill = fill("FFF8FAFC");

  ws.mergeCells(3, 5, 3, 8);
  const metaPreparedCell = ws.getCell(3, 5);
  metaPreparedCell.value = `Prepared by: ${signatory?.fullname || "—"}`;
  Object.assign(metaPreparedCell, subtitleStyle());
  metaPreparedCell.fill = fill("FFF8FAFC");

  ws.getRow(2).height = 20;
  ws.getRow(3).height = 20;

  const headerRow = ws.getRow(5);
  ws.mergeCells(5, 1, 5, 4);
  const stationInfoHeader = headerRow.getCell(1);
  stationInfoHeader.value = "Station Information";
  stationInfoHeader.fill = fill("FF1D4ED8");
  Object.assign(stationInfoHeader, crownHeaderStyle());

  for (let c = 2; c <= 4; c++) {
    headerRow.getCell(c).value = "";
    headerRow.getCell(c).fill = fill("FF1D4ED8");
    Object.assign(headerRow.getCell(c), crownHeaderStyle());
  }

  let col = dataStartCol;
  periods.forEach((period) => {
    const c2 = col + 3;
    ws.mergeCells(5, col, 5, c2);
    const cell = ws.getCell(5, col);
    cell.value = period.label.toUpperCase();
    Object.assign(cell, crownHeaderStyle());
    cell.fill = fill("FF0F766E");

    const catRow = ws.getRow(6);
    ["BPLO", "GOV", "PEZA", "TIEZA"].forEach((label, idx) => {
      const catCell = catRow.getCell(col + idx);
      catCell.value = label;
      catCell.fill = fill("FFD1FAE5");
      Object.assign(catCell, categoryHeaderStyle());
    });
    col += 4;
  });

  ws.getRow(5).height = 24;
  ws.getRow(6).height = 20;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 32;
  for (let c = dataStartCol; c <= lastCol; c++) {
    ws.getColumn(c).width = 11;
  }

  const provinceGroups = new Map<string, TargetReferenceExportGroup[]>();
  groups.forEach((group) => {
    const province = group.province || "—";
    const existing = provinceGroups.get(province) ?? [];
    existing.push(group);
    provinceGroups.set(province, existing);
  });

  let cursor = 7;
  const provinceNames = Array.from(provinceGroups.keys()).sort((a, b) => a.localeCompare(b));
  provinceNames.forEach((provinceName, provinceIndex) => {
    const stationGroups = provinceGroups.get(provinceName) ?? [];

    stationGroups.forEach((station, stationIndex) => {
      const row = ws.getRow(cursor);
      const isAlternate = stationIndex % 2 === 1;
      row.getCell(1).value = stationIndex + 1;
      row.getCell(2).value = provinceName;
      row.getCell(3).value = station.stationCode;
      row.getCell(4).value = station.stationName;
      for (let c = 1; c <= 4; c++) {
        Object.assign(row.getCell(c), dataRowStyle(isAlternate));
      }

      let col = dataStartCol;
      periods.forEach((period) => {
        const bucket = period.getBucket(station.targetreferencelist);
        [bucket.bplo, bucket.gov, bucket.peza, bucket.tieza].forEach((value, idx) => {
          const cell = row.getCell(col + idx);
          cell.value = Number(value) || 0;
          cell.numFmt = "#,##0;(#,##0);-";
          Object.assign(cell, dataCellStyle());
        });
        col += 4;
      });
      row.height = 22;
      cursor++;
    });

    const provinceRow = ws.getRow(cursor);
    ws.mergeCells(cursor, 1, cursor, 4);
    const labelCell = provinceRow.getCell(1);
    labelCell.value = `PROVINCIAL TOTAL — ${provinceName.toUpperCase()}`;
    labelCell.fill = fill("FFFEF08A");
    Object.assign(labelCell, provinceRowStyle());

    let col = dataStartCol;
    periods.forEach((period) => {
      const totalBucket = stationGroups.reduce<TargetBucket>((acc, station) => {
        const bucket = period.getBucket(station.targetreferencelist);
        return addBucket(acc, bucket);
      }, emptyBucket());
      [totalBucket.bplo, totalBucket.gov, totalBucket.peza, totalBucket.tieza].forEach((value, idx) => {
        const cell = provinceRow.getCell(col + idx);
        cell.value = Number(value) || 0;
        cell.numFmt = "#,##0;(#,##0);-";
        cell.fill = fill("FFFEF08A");
        Object.assign(cell, provinceRowStyle());
      });
      col += 4;
    });
    provinceRow.height = 24;
    cursor++;

    if (provinceIndex < provinceNames.length - 1) {
      ws.getRow(cursor).height = 8;
      cursor++;
    }
  });

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
  ws.pageSetup.printTitlesRow = "5:6";

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename ?? `TargetReference_${year}.xlsx`,
  );
}
