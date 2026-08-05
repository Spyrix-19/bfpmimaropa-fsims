import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { toNumber as num } from "@/lib/utils";
import { MONTHS } from "@/lib/fsims-constants";
import type { NoticeDetailClassModel } from "@/types/noticeType";
import {
  border,
  categoryHeaderStyle,
  crownHeaderStyle,
  dataCellStyle,
  dataRowStyle,
  fill,
  formatMilitaryTimestamp,
  modeHeaderStyle,
  provinceRowStyle,
  titleStyle,
} from "@/lib/excel-style";

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
const COLS_PER_PERIOD = CATEGORIES_PER_MODE;
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
    views: [{ state: "frozen", xSplit: 5, ySplit: 3, showGridLines: false }],
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
  const modeCol = 5;
  const dataStartCol = 6;
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

  // Station Information crown — merged across the four info columns and both header rows
  ws.mergeCells(2, 1, 3, 4);
  const stationInfoHeader = ws.getCell(2, 1);
  stationInfoHeader.value = "Station Information";
  stationInfoHeader.fill = fill("FF1D4ED8");
  Object.assign(stationInfoHeader, crownHeaderStyle());

  // Mode of Issuance lives beside the station information, inside the frozen pane
  ws.mergeCells(2, modeCol, 3, modeCol);
  const modeHeader = ws.getCell(2, modeCol);
  modeHeader.value = "MODE OF ISSUANCE";
  modeHeader.fill = fill("FF1D4ED8");
  Object.assign(modeHeader, crownHeaderStyle());

  let col = dataStartCol;
  periods.forEach((period) => {
    const periodEnd = col + COLS_PER_PERIOD - 1;
    ws.mergeCells(2, col, 2, periodEnd);
    const cell = ws.getCell(2, col);
    cell.value = period.label.toUpperCase();
    Object.assign(cell, crownHeaderStyle());
    cell.fill = fill("FF0F766E");

    const catRow = ws.getRow(3);
    CATEGORY_LABELS.forEach((label, idx) => {
      const catCell = catRow.getCell(col + idx);
      catCell.value = label;
      catCell.fill = fill("FFD1FAE5");
      Object.assign(catCell, categoryHeaderStyle());
    });
    col += COLS_PER_PERIOD;
  });

  ws.getRow(2).height = 26;
  ws.getRow(3).height = 22;

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 32;
  ws.getColumn(modeCol).width = 20;
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

  /** Writes the MANUAL / FSIS pair of rows for one station or provincial total. */
  const writeModeRows = (
    startRow: number,
    buckets: NoticeModeBucket[],
    opts2: { isAlternate?: boolean; isTotal?: boolean; isGrand?: boolean },
  ) => {
    MODE_LABELS.forEach((mode, modeIdx) => {
      const row = ws.getRow(startRow + modeIdx);
      const modeCell = row.getCell(modeCol);
      modeCell.value = mode;
      modeCell.fill = fill(modeIdx === 0 ? "FFBAE6FD" : "FFFDE68A");
      Object.assign(modeCell, opts2.isTotal || opts2.isGrand ? provinceRowStyle() : modeHeaderStyle());
      if (opts2.isTotal) modeCell.fill = fill(modeIdx === 0 ? "FFBAE6FD" : "FFFDE68A");
      if (opts2.isGrand) {
        modeCell.fill = fill("FF0F766E");
        modeCell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      }

      let c = dataStartCol;
      buckets.forEach((bucket) => {
        const values = bucketValues(modeIdx === 0 ? bucket.manual : bucket.fsis);
        values.forEach((value, idx) => {
          const cell = row.getCell(c + idx);
          cell.value = Number(value) || 0;
          cell.numFmt = "#,##0;(#,##0);-";
          if (opts2.isGrand) {
            Object.assign(cell, provinceRowStyle());
            cell.fill = fill("FF0F766E");
            cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
          } else if (opts2.isTotal) {
            cell.fill = fill("FFFEF08A");
            Object.assign(cell, provinceRowStyle());
          } else {
            Object.assign(cell, dataCellStyle());
            if (opts2.isAlternate) cell.fill = fill("FFF8FAFC");
          }
        });
        c += COLS_PER_PERIOD;
      });
      row.height = opts2.isTotal || opts2.isGrand ? 22 : 20;
    });
  };

  let cursor = 4;
  const provinceNames = Array.from(provinceGroups.keys()).sort((a, b) => a.localeCompare(b));
  provinceNames.forEach((provinceName, provinceIndex) => {
    const stationGroups = provinceGroups.get(provinceName) ?? [];

    stationGroups.forEach((station, stationIndex) => {
      const isAlternate = stationIndex % 2 === 1;
      const startRow = cursor;
      const endRow = cursor + MODE_LABELS.length - 1;

      // Station identity spans both mode rows
      const values = [stationIndex + 1, provinceName, station.stationCode, station.stationName];
      for (let c = 1; c <= 4; c++) {
        ws.mergeCells(startRow, c, endRow, c);
        const cell = ws.getCell(startRow, c);
        cell.value = values[c - 1];
        Object.assign(cell, dataRowStyle(isAlternate));
      }

      writeModeRows(
        startRow,
        periods.map((period) => period.getBucket(station.noticelist)),
        { isAlternate },
      );

      cursor = endRow + 1;
    });

    const startRow = cursor;
    const endRow = cursor + MODE_LABELS.length - 1;
    ws.mergeCells(startRow, 1, endRow, 4);
    const labelCell = ws.getCell(startRow, 1);
    labelCell.value = `PROVINCIAL TOTAL — ${provinceName.toUpperCase()}`;
    labelCell.fill = fill("FFFEF08A");
    Object.assign(labelCell, provinceRowStyle());

    writeModeRows(
      startRow,
      periods.map((period) =>
        stationGroups.reduce<NoticeModeBucket>(
          (acc, station) => addModeBucket(acc, period.getBucket(station.noticelist)),
          emptyModeBucket(),
        ),
      ),
      { isTotal: true },
    );

    cursor = endRow + 1;

    if (provinceIndex < provinceNames.length - 1) {
      ws.getRow(cursor).height = 8;
      cursor++;
    }
  });

  // Regional grand total — only meaningful when more than one province is present
  if (provinceNames.length > 1) {
    ws.getRow(cursor).height = 8;
    cursor++;
    const gStart = cursor;
    const gEnd = cursor + MODE_LABELS.length - 1;
    ws.mergeCells(gStart, 1, gEnd, 4);
    const gLabel = ws.getCell(gStart, 1);
    gLabel.value = "REGIONAL GRAND TOTAL — MIMAROPA";
    gLabel.fill = fill("FF0F766E");
    Object.assign(gLabel, provinceRowStyle());
    gLabel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };

    writeModeRows(
      gStart,
      periods.map((period) =>
        groups.reduce<NoticeModeBucket>(
          (acc, station) => addModeBucket(acc, period.getBucket(station.noticelist)),
          emptyModeBucket(),
        ),
      ),
      { isGrand: true },
    );
    cursor = gEnd + 1;
  }




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
    filename ?? `AccomplishedNotices_${year}.xlsx`,
  );
}
