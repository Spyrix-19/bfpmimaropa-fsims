import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS } from "@/lib/fsims-constants";
import type { NoticeDetailClassModel } from "@/types/noticeType";

/* ------------------------------------------------------------------ *
 * Notice export — mirrors the Fire Safety Compliance workbook layout.
 * One crown per period, split into MANUAL / FSIS mode bands, with the
 * five notice categories under each band, provincial totals, and the
 * signatory footer block.
 * ------------------------------------------------------------------ */

export type NoticePeriod = "DAILY" | "MONTHLY" | "QUARTERLY" | "SEMI-ANNUAL" | "ANNUAL";

export type NoticeExportRecord = Partial<Omit<NoticeDetailClassModel, "dateaccomplish">> & {
  dateaccomplish?: string | Date;
};

export interface NoticeExportGroup {
  province: string;
  stationCode: string;
  stationName: string;
  noticelist: NoticeExportRecord[];
}

export interface NoticeExportSignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

export interface NoticeBucket {
  nod: number;
  ntc: number;
  ntcv: number;
  abatement: number;
  closure: number;
}

export interface NoticeModeBucket {
  manual: NoticeBucket;
  fsis: NoticeBucket;
}

const CATEGORY_LABELS: string[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];
const MODE_LABELS: string[] = ["MANUAL", "FSIS"];
const CATEGORIES_PER_MODE = CATEGORY_LABELS.length;
const COLS_PER_PERIOD = CATEGORIES_PER_MODE * MODE_LABELS.length;
const QUARTER_LABELS = ["First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"];
const SEMESTER_LABELS = ["First Semester", "Second Semester"];

const MODE_MANUAL = 96;

export const emptyBucket = (): NoticeBucket => ({
  nod: 0,
  ntc: 0,
  ntcv: 0,
  abatement: 0,
  closure: 0,
});

export const emptyModeBucket = (): NoticeModeBucket => ({
  manual: emptyBucket(),
  fsis: emptyBucket(),
});

export const addBucket = (a: NoticeBucket, b: NoticeBucket): NoticeBucket => ({
  nod: a.nod + b.nod,
  ntc: a.ntc + b.ntc,
  ntcv: a.ntcv + b.ntcv,
  abatement: a.abatement + b.abatement,
  closure: a.closure + b.closure,
});

export const addModeBucket = (a: NoticeModeBucket, b: NoticeModeBucket): NoticeModeBucket => ({
  manual: addBucket(a.manual, b.manual),
  fsis: addBucket(a.fsis, b.fsis),
});

const num = (v: unknown) => Number(v ?? 0) || 0;

const bucketValues = (bucket: NoticeBucket) => [
  bucket.nod,
  bucket.ntc,
  bucket.ntcv,
  bucket.abatement,
  bucket.closure,
];

/** ISO date parts of a notice record; nulls out the 1900 sentinel. */
function recordDate(rec: NoticeExportRecord): { year: number; month: number; day: number } | null {
  const iso = String(rec?.dateaccomplish ?? "").slice(0, 10);
  if (!iso || iso.startsWith("1900")) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

function recordBucket(rec: NoticeExportRecord): NoticeModeBucket {
  const out = emptyModeBucket();
  const accoms = Array.isArray(rec.noticeaccomlist) ? rec.noticeaccomlist : [];
  for (const accom of accoms) {
    const a = accom as unknown as Record<string, unknown>;
    const target = num(a.fsicmode) === MODE_MANUAL ? out.manual : out.fsis;
    target.nod += num(a.nodcount);
    target.ntc += num(a.ntccount);
    target.ntcv += num(a.ntcvcount);
    target.abatement += num(a.abatementcount);
    target.closure += num(a.closurecount);
  }
  return out;
}

function sumWhere(
  list: NoticeExportRecord[],
  predicate: (p: { year: number; month: number; day: number }) => boolean,
): NoticeModeBucket {
  return (list ?? []).reduce<NoticeModeBucket>((acc, rec) => {
    const parts = recordDate(rec);
    if (!parts || !predicate(parts)) return acc;
    return addModeBucket(acc, recordBucket(rec));
  }, emptyModeBucket());
}

interface PeriodDef {
  key: string;
  label: string;
  getBucket: (list: NoticeExportRecord[]) => NoticeModeBucket;
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
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  }).format(value);
}

function crownHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: border("thin", "FF334155"),
  };
}

function modeHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: "FF0F172A" } },
    alignment: { horizontal: "center", vertical: "middle" },
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
  interval: NoticePeriod,
  year: number,
  selectedMonths: number[],
  quarter: string,
  semester: string,
  selectedDay: number | null,
): PeriodDef[] {
  switch (interval) {
    case "MONTHLY": {
      return MONTHS.filter((m) => selectedMonths.includes(m.value)).map((m) => ({
        key: `m${m.value}`,
        label: m.name,
        getBucket: (list) => sumWhere(list, (p) => p.year === year && p.month === m.value),
      }));
    }
    case "QUARTERLY": {
      const quarters = quarter === "all" ? ["q1", "q2", "q3", "q4"] : [quarter];
      return quarters.flatMap((q) => {
        const idx = ["q1", "q2", "q3", "q4"].indexOf(q);
        if (idx < 0) return [];
        const months = [idx * 3 + 1, idx * 3 + 2, idx * 3 + 3];
        return [
          {
            key: q,
            label: QUARTER_LABELS[idx],
            getBucket: (list) => sumWhere(list, (p) => p.year === year && months.includes(p.month)),
          },
        ];
      });
    }
    case "SEMI-ANNUAL": {
      const semesters = semester === "all" ? ["s1", "s2"] : [semester];
      return semesters.flatMap((s) => {
        const idx = ["s1", "s2"].indexOf(s);
        if (idx < 0) return [];
        const months = idx === 0 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
        return [
          {
            key: s,
            label: SEMESTER_LABELS[idx],
            getBucket: (list) => sumWhere(list, (p) => p.year === year && months.includes(p.month)),
          },
        ];
      });
    }
    case "ANNUAL":
      return [
        {
          key: "annual",
          label: "Annual Total",
          getBucket: (list) => sumWhere(list, (p) => p.year === year),
        },
      ];
    case "DAILY": {
      const month = selectedMonths[0] ?? new Date().getMonth() + 1;
      const monthName = MONTHS.find((m) => m.value === month)?.name ?? "";
      const allDays = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
      const days = selectedDay ? [selectedDay] : allDays;
      return days.map((day) => ({
        key: `d${day}`,
        label: `${monthName} ${day}`,
        getBucket: (list) =>
          sumWhere(list, (p) => p.year === year && p.month === month && p.day === day),
      }));
    }
    default:
      return [];
  }
}

const INTERVAL_TITLES: Record<NoticePeriod, string> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  "SEMI-ANNUAL": "Semi-Annual",
  ANNUAL: "Annual",
};

export async function exportNoticeWorkbook(opts: {
  year: number;
  groups: NoticeExportGroup[];
  interval: NoticePeriod;
  selectedMonths: number[];
  quarter: string;
  semester: string;
  selectedDay?: number | null;
  signatory?: NoticeExportSignatory;
  filename?: string;
}) {
  const {
    year,
    groups,
    interval,
    selectedMonths,
    quarter,
    semester,
    selectedDay = null,
    signatory,
    filename,
  } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();

  const intervalTitle = INTERVAL_TITLES[interval] ?? "";
  const ws = wb.addWorksheet(`${intervalTitle} ${year}`.trim(), {
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

  const periods = buildPeriodDefs(interval, year, selectedMonths, quarter, semester, selectedDay);
  const dataStartCol = 5;
  const lastCol = dataStartCol + periods.length * COLS_PER_PERIOD - 1;

  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  const dailyMonthName =
    MONTHS.find((m) => m.value === (selectedMonths[0] ?? new Date().getMonth() + 1))?.name ?? "";
  const titleScope =
    interval === "DAILY"
      ? `FOR THE MONTH OF ${dailyMonthName.toUpperCase()} ${year}`
      : `FOR THE YEAR ${year}`;
  const intervalWord = interval === "SEMI-ANNUAL" ? "SEMESTER" : intervalTitle.toUpperCase();
  titleCell.value = `ACCOMPLISHED NOTICES — ${intervalWord} ACCOMPLISHMENT ${titleScope}`;
  Object.assign(titleCell, titleStyle());
  titleCell.fill = fill("FFF8FAFC");

  ws.getRow(1).height = 30;

  // Station Information crown — merged across the four info columns and all header rows
  ws.mergeCells(2, 1, 4, 4);
  const stationInfoHeader = ws.getCell(2, 1);
  stationInfoHeader.value = "Station Information";
  stationInfoHeader.fill = fill("FF1D4ED8");
  Object.assign(stationInfoHeader, crownHeaderStyle());

  let col = dataStartCol;
  periods.forEach((period) => {
    const periodEnd = col + COLS_PER_PERIOD - 1;
    ws.mergeCells(2, col, 2, periodEnd);
    const cell = ws.getCell(2, col);
    cell.value = period.label.toUpperCase();
    Object.assign(cell, crownHeaderStyle());
    cell.fill = fill("FF0F766E");

    const modeRow = ws.getRow(3);
    const catRow = ws.getRow(4);
    MODE_LABELS.forEach((mode, modeIdx) => {
      const modeStart = col + modeIdx * CATEGORIES_PER_MODE;
      const modeEnd = modeStart + CATEGORIES_PER_MODE - 1;
      ws.mergeCells(3, modeStart, 3, modeEnd);
      const modeCell = ws.getCell(3, modeStart);
      modeCell.value = mode;
      modeCell.fill = fill(modeIdx === 0 ? "FFBAE6FD" : "FFFDE68A");
      Object.assign(modeCell, modeHeaderStyle());

      CATEGORY_LABELS.forEach((label, idx) => {
        const catCell = catRow.getCell(modeStart + idx);
        catCell.value = label;
        catCell.fill = fill("FFD1FAE5");
        Object.assign(catCell, categoryHeaderStyle());
      });
    });
    col += COLS_PER_PERIOD;
  });

  ws.getRow(2).height = 26;
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 22;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 32;
  for (let c = dataStartCol; c <= lastCol; c++) {
    ws.getColumn(c).width = 12;
  }

  const provinceGroups = new Map<string, NoticeExportGroup[]>();
  groups.forEach((group) => {
    const province = group.province || "—";
    const existing = provinceGroups.get(province) ?? [];
    existing.push(group);
    provinceGroups.set(province, existing);
  });

  let cursor = 5;
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
        const bucket = period.getBucket(station.noticelist);
        [...bucketValues(bucket.manual), ...bucketValues(bucket.fsis)].forEach((value, idx) => {
          const cell = row.getCell(col + idx);
          cell.value = Number(value) || 0;
          cell.numFmt = "#,##0;(#,##0);-";
          Object.assign(cell, dataCellStyle());
        });
        col += COLS_PER_PERIOD;
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

    let totalCol = dataStartCol;
    periods.forEach((period) => {
      const totalBucket = stationGroups.reduce<NoticeModeBucket>(
        (acc, station) => addModeBucket(acc, period.getBucket(station.noticelist)),
        emptyModeBucket(),
      );
      [...bucketValues(totalBucket.manual), ...bucketValues(totalBucket.fsis)].forEach(
        (value, idx) => {
          const cell = provinceRow.getCell(totalCol + idx);
          cell.value = Number(value) || 0;
          cell.numFmt = "#,##0;(#,##0);-";
          cell.fill = fill("FFFEF08A");
          Object.assign(cell, provinceRowStyle());
        },
      );
      totalCol += COLS_PER_PERIOD;
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
  ws.pageSetup.printTitlesRow = "2:4";

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename ?? `AccomplishedNotices_${year}.xlsx`,
  );
}
