/**
 * Shared ExcelJS styling primitives.
 *
 * Every workbook export in the project (compliance, notices, target
 * reference, matrices) previously duplicated these helpers verbatim.
 * They are byte-for-byte equivalent to the former local copies, so the
 * generated workbooks are unchanged.
 */
import type ExcelJS from "exceljs";

/** Accounting-style integer format used by every numeric export cell. */
export const NUMBER_FMT = "#,##0;(#,##0);-";

/** Solid pattern fill from an ARGB color string. */
export function fill(color: string): ExcelJS.Fill {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
}

/** Uniform border box (top/left/right/bottom) with an empty diagonal. */
export function border(style: ExcelJS.BorderStyle = "thin", color = "FF64748B"): ExcelJS.Borders {
  const b: Partial<ExcelJS.Border> = { style, color: { argb: color } };
  return {
    top: b as ExcelJS.Border,
    left: b as ExcelJS.Border,
    right: b as ExcelJS.Border,
    bottom: b as ExcelJS.Border,
    diagonal: {} as ExcelJS.Border,
  };
}

/** Long, human-readable timestamp used in export subtitles/footers. */
export function formatMilitaryTimestamp(value: Date): string {
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

/** Workbook title banner. */
export function titleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FF0F172A" }, size: 16 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border("medium", "FF0F172A"),
  };
}

/** Left-aligned subtitle line under the title. */
export function subtitleStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: "FF0F172A" } },
    alignment: { horizontal: "left", vertical: "middle" },
    border: border("thin", "FFCBD5E1"),
  };
}

/** Centered bold white header cell (period crowns, banded headers). */
export function crownHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: border("thin", "FF334155"),
  };
}

/** Alias kept for matrix exports that named the same style differently. */
export const centerBoldWhite = crownHeaderStyle;

/** Issuance-mode (MANUAL / FSIS) sub-header. */
export function modeHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: "FF0F172A" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border("thin", "FF334155"),
  };
}

/** Category leaf header. */
export function categoryHeaderStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 9, color: { argb: "FF064E3B" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
  };
}

/** Plain centered data cell. */
export function dataCellStyle(): Partial<ExcelJS.Style> {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
  };
}

/** Data cell with zebra banding. */
export function dataRowStyle(isAlternate: boolean): Partial<ExcelJS.Style> {
  return {
    font: { size: 10 },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border(),
    fill: isAlternate ? fill("FFF8FAFC") : undefined,
  };
}

/** Provincial total row. */
export function provinceRowStyle(): Partial<ExcelJS.Style> {
  return {
    font: { bold: true, size: 10, color: { argb: "FF713F12" } },
    alignment: { horizontal: "center", vertical: "middle" },
    border: border("medium", "FF334155"),
  };
}
