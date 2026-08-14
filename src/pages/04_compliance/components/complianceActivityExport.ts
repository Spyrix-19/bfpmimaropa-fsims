/**
 * Fire Safety Compliance — activity ledger workbooks.
 *
 * Plots the two on-screen ledger tables of the Fire Safety Compliance page
 * into Excel, column-for-column:
 *
 *   • "Inspection & Issuance"  → Date/Period | Inspection (During, After +
 *     BPLO/GOV/PEZA/TIEZA × TARGET/ACCOMPLISHED/VARIANCE/POSITIVE LISTING/%)
 *     | Mode of Issuance | FSEC | FSIC | Issued Notices
 *   • "Reinspection"           → Date/Period | Reinspection | Mode of
 *     Issuance | Re-FSIC | Re-Issued Notices
 *
 * Each period line renders two body rows (MANUAL then FSIS) with the
 * period label and the mode-agnostic cells merged vertically, exactly like
 * the web tables. Every station returned by the ledger endpoint is plotted
 * as its own block — the workbook is never paginated.
 */
import type ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  NUMBER_FMT,
  border,
  categoryHeaderStyle,
  crownHeaderStyle,
  dataCellStyle,
  fill,
  formatMilitaryTimestamp,
  modeHeaderStyle,
  titleStyle,
} from "@/lib/excel-style";

/* ------------------------------- Contracts ------------------------------- */

export type ActivityVariant = "inspection" | "reinspection";

export interface ActivityLine {
  /** Row caption — a date, month, week span, quarter, semester or year. */
  label: string;
  inspection: Record<string, number>;
  sectors: Record<string, { target: number; accomplished: number }>;
  reinspection: Record<string, number>;
  manual: Record<string, number>;
  fsis: Record<string, number>;
}

export interface ActivityStation {
  province: string;
  stationCode: string;
  stationName: string;
  cityName?: string;
  lines: ActivityLine[];
}

export interface ActivitySignatory {
  rank?: string;
  fullname?: string;
  designation?: string;
}

/* ------------------------- Column tree (UI parity) ------------------------ */

type Col = { key: string; label: string };

const INSPECTION_PLAIN_COLS: Col[] = [
  { key: "inspectduringcount", label: "During" },
  { key: "inspectaftercount", label: "After" },
];

const INSPECTION_SECTORS = [
  { key: "bplo", label: "BPLO" },
  { key: "gov", label: "GOV" },
  { key: "peza", label: "PEZA" },
  { key: "tieza", label: "TIEZA" },
];

const SECTOR_METRIC_LABELS = ["TARGET", "ACCOMPLISHED", "VARIANCE", "POSITIVE LISTING", "%"];

const FSEC_COLS: Col[] = [
  { key: "fsecbuildingcount", label: "Building" },
  { key: "fsecgovcount", label: "GOV" },
  { key: "fsecpezacount", label: "PEZA" },
  { key: "fsectiezacount", label: "TIEZA" },
];

const FSIC_COLS: Col[] = [
  { key: "fsicoccupancycount", label: "Occupancy" },
  { key: "fsicbplonewcount", label: "BPLO New" },
  { key: "fsicbplorenewcount", label: "BPLO Renew" },
  { key: "fsicgovcount", label: "GOV" },
  { key: "fsicpezacount", label: "PEZA" },
  { key: "fsictiezacount", label: "TIEZA" },
];

const NOTICE_COLS: Col[] = [
  { key: "nodcount", label: "NOD" },
  { key: "ntccount", label: "NTC" },
  { key: "ntcvcount", label: "NTCV" },
  { key: "abatementcount", label: "Abatement" },
  { key: "closurecount", label: "Closure" },
];

const REINSPECTION_COLS: Col[] = [
  { key: "reinspectoccupancycount", label: "Occupancy" },
  { key: "reinspectbplocount", label: "BPLO" },
  { key: "reinspectgovcount", label: "GOV" },
  { key: "reinspectpezacount", label: "PEZA" },
  { key: "reinspecttiezacount", label: "TIEZA" },
];

const RE_FSIC_COLS: Col[] = [
  { key: "refsicoccupancycount", label: "Occupancy" },
  { key: "refsicbplonewcount", label: "BPLO New" },
  { key: "refsicbplorenewcount", label: "BPLO Renew" },
  { key: "refsicgovcount", label: "GOV" },
  { key: "refsicpezacount", label: "PEZA" },
  { key: "refsictiezacount", label: "TIEZA" },
];

const RE_NOTICE_COLS: Col[] = [
  { key: "rentcvcount", label: "NTCV" },
  { key: "reabatementcount", label: "Abatement" },
  { key: "reclosurecount", label: "Closure" },
];

/* -------------------------------- Palette -------------------------------- */

const HEAD_FILL = "FFDBEAFE";
const SUBHEAD_FILL = "FFEFF6FF";
const FOOT_FILL = "FFBFDBFE";
const FSIS_FILL = "FFF8FAFC";
const STATION_FILL = "FF1D4ED8";
const PCT_FMT = '0.00"%"';

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

interface SectorMetrics {
  target: number;
  accomplished: number;
  variance: number;
  positive: number;
  pct: number;
}

/** Same arithmetic as the on-screen ledger. */
function calcSectorMetrics(target: number, accomplished: number): SectorMetrics {
  const t = num(target);
  const a = num(accomplished);
  return {
    target: t,
    accomplished: a,
    variance: Math.max(t - a, 0),
    positive: Math.max(a - t, 0),
    pct: t > 0 ? ((a - t) / t) * 100 : a > 0 ? 100 : 0,
  };
}

/** MANUAL + FSIS + inspection/reinspection/sector totals of one station. */
function sumLines(lines: ActivityLine[]) {
  const totals = {
    inspection: {} as Record<string, number>,
    reinspection: {} as Record<string, number>,
    sectors: {} as Record<string, { target: number; accomplished: number }>,
    combined: {} as Record<string, number>,
  };
  for (const c of INSPECTION_PLAIN_COLS) totals.inspection[c.key] = 0;
  for (const c of REINSPECTION_COLS) totals.reinspection[c.key] = 0;
  for (const s of INSPECTION_SECTORS) totals.sectors[s.key] = { target: 0, accomplished: 0 };

  const issuanceKeys = [
    ...FSEC_COLS,
    ...FSIC_COLS,
    ...NOTICE_COLS,
    ...RE_FSIC_COLS,
    ...RE_NOTICE_COLS,
  ].map((c) => c.key);
  for (const k of issuanceKeys) totals.combined[k] = 0;

  for (const l of lines) {
    for (const c of INSPECTION_PLAIN_COLS) totals.inspection[c.key] += num(l.inspection?.[c.key]);
    for (const c of REINSPECTION_COLS) totals.reinspection[c.key] += num(l.reinspection?.[c.key]);
    for (const s of INSPECTION_SECTORS) {
      totals.sectors[s.key].target += num(l.sectors?.[s.key]?.target);
      totals.sectors[s.key].accomplished += num(l.sectors?.[s.key]?.accomplished);
    }
    for (const k of issuanceKeys) {
      totals.combined[k] += num(l.manual?.[k]) + num(l.fsis?.[k]);
    }
  }
  return totals;
}

/* --------------------------------- Writer -------------------------------- */

export async function exportComplianceActivityWorkbook(opts: {
  variant: ActivityVariant;
  /** Card caption, e.g. "DAILY INSPECTION & ISSUANCE ACTIVITIES". */
  title: string;
  /** First column heading — "Date", "Month" or "Period". */
  periodHeading: string;
  /** Human period line under the title, e.g. "Q1 2026". */
  periodLabel?: string | null;
  year: number;
  stations: ActivityStation[];
  signatory?: ActivitySignatory;
  filename?: string;
}) {
  const { variant, title, periodHeading, periodLabel, stations, signatory } = opts;
  const isInspection = variant === "inspection";

  /* Leaf column plan ------------------------------------------------------ */
  const modeIssuanceCols = isInspection
    ? [...FSEC_COLS, ...FSIC_COLS, ...NOTICE_COLS]
    : [...RE_FSIC_COLS, ...RE_NOTICE_COLS];

  const plainCols = isInspection ? INSPECTION_PLAIN_COLS : REINSPECTION_COLS;
  const sectorSpan = isInspection ? INSPECTION_SECTORS.length * SECTOR_METRIC_LABELS.length : 0;

  const firstCol = 1;
  const plainStart = 2;
  const sectorStart = plainStart + plainCols.length;
  const modeCol = sectorStart + sectorSpan;
  const issuanceStart = modeCol + 1;
  const lastCol = issuanceStart + modeIssuanceCols.length - 1;

  const wb = new (await import("exceljs")).default.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();

  const ws = wb.addWorksheet(isInspection ? "Inspection & Issuance" : "Reinspection", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 2, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Column widths
  ws.getColumn(firstCol).width = 26;
  for (let c = plainStart; c <= lastCol; c++) {
    ws.getColumn(c).width = c === modeCol ? 14 : 13;
  }

  /* Title banner ---------------------------------------------------------- */
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `FIRE SAFETY COMPLIANCE — ${title.toUpperCase()}`;
  Object.assign(titleCell, titleStyle());
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = periodLabel ? `Period: ${periodLabel}` : `Reporting Year: ${opts.year}`;
  subCell.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
  subCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 20;

  let cursor = 4;

  const styleHead = (cell: ExcelJS.Cell, bg = HEAD_FILL) => {
    Object.assign(cell, crownHeaderStyle());
    cell.fill = fill(bg);
    cell.font = { bold: true, size: 9, color: { argb: "FF1D4ED8" } };
  };

  /** Writes the 3-row (inspection) or 2-row (reinspection) header tree. */
  const writeHeader = (top: number) => {
    const headerRows = isInspection ? 3 : 2;
    const bottom = top + headerRows - 1;

    // Period column
    ws.mergeCells(top, firstCol, bottom, firstCol);
    const periodCell = ws.getCell(top, firstCol);
    periodCell.value = periodHeading;
    styleHead(periodCell);
    periodCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    if (isInspection) {
      // "Inspection" crown over plain cols + sector metric blocks
      ws.mergeCells(top, plainStart, top, sectorStart + sectorSpan - 1);
      styleHead(ws.getCell(top, plainStart));
      ws.getCell(top, plainStart).value = "Inspection";

      plainCols.forEach((c, idx) => {
        const col = plainStart + idx;
        ws.mergeCells(top + 1, col, bottom, col);
        const cell = ws.getCell(top + 1, col);
        cell.value = c.label;
        styleHead(cell);
      });

      INSPECTION_SECTORS.forEach((s, sIdx) => {
        const start = sectorStart + sIdx * SECTOR_METRIC_LABELS.length;
        ws.mergeCells(top + 1, start, top + 1, start + SECTOR_METRIC_LABELS.length - 1);
        const cell = ws.getCell(top + 1, start);
        cell.value = s.label;
        styleHead(cell);
        SECTOR_METRIC_LABELS.forEach((label, mIdx) => {
          const leaf = ws.getCell(bottom, start + mIdx);
          leaf.value = label;
          styleHead(leaf, SUBHEAD_FILL);
          Object.assign(leaf, {
            ...categoryHeaderStyle(),
            fill: fill(SUBHEAD_FILL),
            font: { bold: true, size: 8, color: { argb: "FF1D4ED8" } },
            alignment: { horizontal: "center", vertical: "middle", wrapText: true },
          });
        });
      });
    } else {
      // "Reinspection" crown over the reinspection leaf columns
      ws.mergeCells(top, plainStart, top, plainStart + plainCols.length - 1);
      const crown = ws.getCell(top, plainStart);
      crown.value = "Reinspection";
      styleHead(crown);
      plainCols.forEach((c, idx) => {
        const cell = ws.getCell(bottom, plainStart + idx);
        cell.value = c.label;
        styleHead(cell, SUBHEAD_FILL);
      });
    }

    // Mode of Issuance column
    ws.mergeCells(top, modeCol, bottom, modeCol);
    const modeCell = ws.getCell(top, modeCol);
    modeCell.value = "Mode of Issuance";
    styleHead(modeCell);

    // Issuance category crowns + leaves
    const groups = isInspection
      ? [
          { label: "FSEC", cols: FSEC_COLS },
          { label: "FSIC", cols: FSIC_COLS },
          { label: "Issued Notices", cols: NOTICE_COLS },
        ]
      : [
          { label: "Re-FSIC", cols: RE_FSIC_COLS },
          { label: "Re-Issued Notices", cols: RE_NOTICE_COLS },
        ];

    let col = issuanceStart;
    groups.forEach((g) => {
      ws.mergeCells(top, col, top, col + g.cols.length - 1);
      const crown = ws.getCell(top, col);
      crown.value = g.label;
      styleHead(crown);
      g.cols.forEach((c, idx) => {
        if (isInspection) ws.mergeCells(top + 1, col + idx, bottom, col + idx);
        const cell = ws.getCell(isInspection ? top + 1 : bottom, col + idx);
        cell.value = c.label;
        styleHead(cell, SUBHEAD_FILL);
      });
      col += g.cols.length;
    });

    for (let r = top; r <= bottom; r++) ws.getRow(r).height = 20;
    return bottom + 1;
  };

  const writeNumeric = (
    row: number,
    col: number,
    value: number,
    alternate: boolean,
    rowSpan = 1,
  ) => {
    if (rowSpan > 1) ws.mergeCells(row, col, row + rowSpan - 1, col);
    const cell = ws.getCell(row, col);
    cell.value = num(value);
    cell.numFmt = NUMBER_FMT;
    Object.assign(cell, dataCellStyle());
    if (alternate) cell.fill = fill(FSIS_FILL);
    return cell;
  };

  /* Station blocks -------------------------------------------------------- */
  stations.forEach((station) => {
    // Station identity banner
    ws.mergeCells(cursor, 1, cursor, lastCol);
    const stationCell = ws.getCell(cursor, 1);
    stationCell.value = [
      station.stationCode ? `${station.stationCode} —` : "",
      station.stationName,
      station.cityName ? `· ${station.cityName}` : "",
      station.province ? `· ${station.province}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    stationCell.fill = fill(STATION_FILL);
    stationCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    stationCell.alignment = { horizontal: "left", vertical: "middle" };
    stationCell.border = border("thin", "FF334155");
    ws.getRow(cursor).height = 24;
    cursor++;

    cursor = writeHeader(cursor);

    if (station.lines.length === 0) {
      ws.mergeCells(cursor, 1, cursor, lastCol);
      const emptyCell = ws.getCell(cursor, 1);
      emptyCell.value = "No entries for this period.";
      emptyCell.font = { italic: true, size: 10, color: { argb: "FF64748B" } };
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
      emptyCell.border = border();
      ws.getRow(cursor).height = 20;
      cursor += 2;
      return;
    }

    station.lines.forEach((line) => {
      const manualRow = cursor;
      const fsisRow = cursor + 1;

      // Period label — merged across the MANUAL + FSIS rows
      ws.mergeCells(manualRow, firstCol, fsisRow, firstCol);
      const labelCell = ws.getCell(manualRow, firstCol);
      labelCell.value = line.label;
      Object.assign(labelCell, dataCellStyle());
      labelCell.font = { bold: true, size: 10 };
      labelCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

      // Mode-agnostic counts — merged vertically like the web table
      plainCols.forEach((c, idx) => {
        const source = isInspection ? line.inspection : line.reinspection;
        writeNumeric(manualRow, plainStart + idx, num(source?.[c.key]), false, 2);
      });

      if (isInspection) {
        INSPECTION_SECTORS.forEach((s, sIdx) => {
          const start = sectorStart + sIdx * SECTOR_METRIC_LABELS.length;
          const m = calcSectorMetrics(
            line.sectors?.[s.key]?.target ?? 0,
            line.sectors?.[s.key]?.accomplished ?? 0,
          );
          writeNumeric(manualRow, start, m.target, false, 2);
          writeNumeric(manualRow, start + 1, m.accomplished, false, 2);
          writeNumeric(manualRow, start + 2, m.variance, false, 2);
          writeNumeric(manualRow, start + 3, m.positive, false, 2);
          const pctCell = writeNumeric(manualRow, start + 4, m.pct, false, 2);
          pctCell.numFmt = PCT_FMT;
          pctCell.font = {
            size: 10,
            bold: true,
            color: { argb: m.pct < 0 ? "FFB91C1C" : m.pct > 0 ? "FF15803D" : "FF0F172A" },
          };
        });
      }

      // MANUAL / FSIS issuance rows
      (
        [
          { row: manualRow, label: "MANUAL", values: line.manual, alternate: false },
          { row: fsisRow, label: "FSIS", values: line.fsis, alternate: true },
        ] as const
      ).forEach((mode) => {
        const modeCell = ws.getCell(mode.row, modeCol);
        modeCell.value = mode.label;
        Object.assign(modeCell, modeHeaderStyle());
        modeCell.fill = fill(mode.alternate ? FSIS_FILL : SUBHEAD_FILL);
        modeIssuanceCols.forEach((c, idx) => {
          writeNumeric(mode.row, issuanceStart + idx, num(mode.values?.[c.key]), mode.alternate);
        });
      });

      ws.getRow(manualRow).height = 19;
      ws.getRow(fsisRow).height = 19;
      cursor += 2;
    });

    // Station total row — MANUAL + FSIS combined, matching the table footer
    const totals = sumLines(station.lines);
    const totalRow = cursor;
    const totalCell = ws.getCell(totalRow, firstCol);
    totalCell.value = "TOTAL";
    Object.assign(totalCell, dataCellStyle());
    totalCell.fill = fill(FOOT_FILL);
    totalCell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
    totalCell.alignment = { horizontal: "left", vertical: "middle" };

    plainCols.forEach((c, idx) => {
      const source = isInspection ? totals.inspection : totals.reinspection;
      const cell = writeNumeric(totalRow, plainStart + idx, num(source[c.key]), false);
      cell.fill = fill(FOOT_FILL);
      cell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
    });

    if (isInspection) {
      INSPECTION_SECTORS.forEach((s, sIdx) => {
        const start = sectorStart + sIdx * SECTOR_METRIC_LABELS.length;
        const m = calcSectorMetrics(
          totals.sectors[s.key]?.target ?? 0,
          totals.sectors[s.key]?.accomplished ?? 0,
        );
        [m.target, m.accomplished, m.variance, m.positive, m.pct].forEach((value, idx) => {
          const cell = writeNumeric(totalRow, start + idx, value, false);
          cell.fill = fill(FOOT_FILL);
          cell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
          if (idx === 4) {
            cell.numFmt = PCT_FMT;
            cell.font = {
              bold: true,
              size: 10,
              color: { argb: m.pct < 0 ? "FFB91C1C" : m.pct > 0 ? "FF15803D" : "FF1E40AF" },
            };
          }
        });
      });
    }

    const totalModeCell = ws.getCell(totalRow, modeCol);
    totalModeCell.value = "Total";
    Object.assign(totalModeCell, modeHeaderStyle());
    totalModeCell.fill = fill(FOOT_FILL);
    totalModeCell.font = { bold: true, size: 9, color: { argb: "FF1E40AF" } };

    modeIssuanceCols.forEach((c, idx) => {
      const cell = writeNumeric(totalRow, issuanceStart + idx, num(totals.combined[c.key]), false);
      cell.fill = fill(FOOT_FILL);
      cell.font = { bold: true, size: 10, color: { argb: "FF1E40AF" } };
    });

    ws.getRow(totalRow).height = 22;
    cursor += 2; // total row + one spacer row
  });

  /* Signatory footer ------------------------------------------------------ */
  const footerStart = cursor + 1;
  ws.mergeCells(footerStart, 1, footerStart, Math.min(6, lastCol));
  const genCell = ws.getCell(footerStart, 1);
  genCell.value = "Generated by:";
  genCell.font = { bold: true, italic: true, size: 11 };
  genCell.alignment = { horizontal: "left", vertical: "middle" };

  const nameRow = footerStart + 3;
  ws.mergeCells(nameRow, 1, nameRow, Math.min(6, lastCol));
  const nameCell = ws.getCell(nameRow, 1);
  const rankFullName = [signatory?.rank, signatory?.fullname].filter(Boolean).join(" ").trim();
  nameCell.value = rankFullName || "____________________________";
  nameCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  nameCell.alignment = { horizontal: "left", vertical: "middle" };

  const designationRow = nameRow + 1;
  ws.mergeCells(designationRow, 1, designationRow, Math.min(6, lastCol));
  const designationCell = ws.getCell(designationRow, 1);
  designationCell.value = signatory?.designation || "Designation";
  designationCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  designationCell.alignment = { horizontal: "left", vertical: "middle" };

  const generatedRow = designationRow + 1;
  ws.mergeCells(generatedRow, 1, generatedRow, Math.min(6, lastCol));
  const generatedCell = ws.getCell(generatedRow, 1);
  generatedCell.value = `Date Generated: ${formatMilitaryTimestamp(new Date())}`;
  generatedCell.font = { size: 10, color: { argb: "FF475569" } };
  generatedCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.pageSetup.printArea = `A1:${ws.getCell(generatedRow, lastCol).address}`;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    opts.filename ??
      `FireSafetyCompliance_${isInspection ? "InspectionIssuance" : "Reinspection"}_${opts.year}.xlsx`,
  );
}
