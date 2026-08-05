/**
 * Fire Safety Compliance — official matrix-style workbook.
 *
 * Layout mirrors the printed BFP matrix:
 *   • Station Information crown (No. | Province | Unit Code | Station Name)
 *     with a separate "Mode of Issuance" column — the unit code is NEVER
 *     merged into the station name.
 *   • One period banner per selected period (day / month / quarter /
 *     semester / annual), each spanning the full category block:
 *     INSPECTION (During | After | 1st BPLO … 1st TIEZA with Target/Issuance)
 *     | FSEC | FSIC | ISSUED NOTICES.
 *   • Two body rows per station (MANUAL then FSIS). Station identity and the
 *     mode-agnostic INSPECTION cells are merged vertically across both rows.
 *   • Provincial totals, one blank row, then the regional grand total.
 */
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { MONTHS } from "@/lib/fsims-constants";
import { toNumber as num } from "@/lib/utils";
import { MONTH_COLORS } from "./monthColors";
import { border, fill, formatMilitaryTimestamp } from "@/lib/excel-style";
import type {
  CompliancePeriod,
  ComplianceExportGroup,
  ComplianceExportRecord,
  ComplianceExportSignatory,
} from "./complianceExport";

/* ------------------------------------------------------------------ *
 * Column tree — identical identity to the on-screen compliance matrix.
 * ------------------------------------------------------------------ */
type Category = "INSPECTION" | "FSEC" | "FSIC" | "NOTICES";

interface ColumnGroup {
  category: Category;
  label: string;
  grouped: boolean;
  keys: { key: string; label: string }[];
}

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    category: "INSPECTION",
    label: "During",
    grouped: false,
    keys: [{ key: "inspectduringcount", label: "During" }],
  },
  {
    category: "INSPECTION",
    label: "After",
    grouped: false,
    keys: [{ key: "inspectaftercount", label: "After" }],
  },
  {
    category: "INSPECTION",
    label: "1st BPLO",
    grouped: true,
    keys: [
      { key: "targetbplo", label: "Target" },
      { key: "inspectbplocount", label: "Issuance" },
    ],
  },
  {
    category: "INSPECTION",
    label: "1st GOV",
    grouped: true,
    keys: [
      { key: "targetgov", label: "Target" },
      { key: "inspectgovcount", label: "Issuance" },
    ],
  },
  {
    category: "INSPECTION",
    label: "1st PEZA",
    grouped: true,
    keys: [
      { key: "targetpeza", label: "Target" },
      { key: "inspectpezacount", label: "Issuance" },
    ],
  },
  {
    category: "INSPECTION",
    label: "1st TIEZA",
    grouped: true,
    keys: [
      { key: "targettieza", label: "Target" },
      { key: "inspecttiezacount", label: "Issuance" },
    ],
  },

  {
    category: "FSEC",
    label: "Building",
    grouped: false,
    keys: [{ key: "fsecbuildingcount", label: "Building" }],
  },
  { category: "FSEC", label: "Gov", grouped: false, keys: [{ key: "fsecgovcount", label: "Gov" }] },
  {
    category: "FSEC",
    label: "PEZA",
    grouped: false,
    keys: [{ key: "fsecpezacount", label: "PEZA" }],
  },
  {
    category: "FSEC",
    label: "TIEZA",
    grouped: false,
    keys: [{ key: "fsectiezacount", label: "TIEZA" }],
  },

  {
    category: "FSIC",
    label: "Occupancy",
    grouped: false,
    keys: [{ key: "fsicoccupancycount", label: "Occupancy" }],
  },
  {
    category: "FSIC",
    label: "BPLO New",
    grouped: false,
    keys: [{ key: "fsicbplonewcount", label: "BPLO New" }],
  },
  {
    category: "FSIC",
    label: "BPLO Renew",
    grouped: false,
    keys: [{ key: "fsicbplorenewcount", label: "BPLO Renew" }],
  },
  { category: "FSIC", label: "Gov", grouped: false, keys: [{ key: "fsicgovcount", label: "Gov" }] },
  {
    category: "FSIC",
    label: "PEZA",
    grouped: false,
    keys: [{ key: "fsicpezacount", label: "PEZA" }],
  },
  {
    category: "FSIC",
    label: "TIEZA",
    grouped: false,
    keys: [{ key: "fsictiezacount", label: "TIEZA" }],
  },

  { category: "NOTICES", label: "NOD", grouped: false, keys: [{ key: "nodcount", label: "NOD" }] },
  { category: "NOTICES", label: "NTC", grouped: false, keys: [{ key: "ntccount", label: "NTC" }] },
  {
    category: "NOTICES",
    label: "NTCV",
    grouped: false,
    keys: [{ key: "ntcvcount", label: "NTCV" }],
  },
  {
    category: "NOTICES",
    label: "Abatement",
    grouped: false,
    keys: [{ key: "abatementcount", label: "Abatement" }],
  },
  {
    category: "NOTICES",
    label: "Closure",
    grouped: false,
    keys: [{ key: "closurecount", label: "Closure" }],
  },
];

interface Field {
  key: string;
  category: Category;
  group?: string;
  leafLabel: string;
}

const FIELDS: Field[] = COLUMN_GROUPS.flatMap((g) =>
  g.keys.map((k) => ({
    key: k.key,
    category: g.category,
    group: g.grouped ? g.label : undefined,
    leafLabel: g.grouped ? k.label : g.label,
  })),
);

const SPAN = FIELDS.length;
const MODE_MANUAL = 96;
const MODES = ["MANUAL", "FSIS"] as const;
const NUMBER_FMT = "#,##0;(#,##0);-";

/** Target keys accepted from the API (daily* or monthly* prefixed). */
const TARGET_ALIASES: Record<string, string[]> = {
  targetbplo: ["dailytargetbplo", "monthlytargetbplo", "targetbplo"],
  targetgov: ["dailytargetgov", "monthlytargetgov", "targetgov"],
  targetpeza: ["dailytargetpeza", "monthlytargetpeza", "targetpeza"],
  targettieza: ["dailytargettieza", "monthlytargettieza", "targettieza"],
};

const CATEGORY_FILL: Record<Category, { fg: string; font: string; sub: string }> = {
  INSPECTION: { fg: "FF0EA5E9", font: "FFFFFFFF", sub: "FFEFF6FF" },
  FSEC: { fg: "FF10B981", font: "FFFFFFFF", sub: "FFECFDF5" },
  FSIC: { fg: "FFF59E0B", font: "FF1F2937", sub: "FFFFFBEB" },
  NOTICES: { fg: "FFF43F5E", font: "FFFFFFFF", sub: "FFFFF1F2" },
};

/* ------------------------------------------------------------------ *
 * Period model
 * ------------------------------------------------------------------ */
interface PeriodDef {
  label: string;
  color: string;
  match: (p: { year: number; month: number; day: number }) => boolean;
}

const QUARTERS = ["First Quarter", "Second Quarter", "Third Quarter", "Fourth Quarter"];
const SEMESTERS = ["First Semester", "Second Semester"];

function buildPeriods(
  interval: CompliancePeriod,
  year: number,
  selectedMonths: number[],
  quarter: string,
  semester: string,
  selectedDay: number | null,
): PeriodDef[] {
  switch (interval) {
    case "DAILY": {
      const month = selectedMonths[0] ?? new Date().getMonth() + 1;
      const monthName = MONTHS.find((m) => m.value === month)?.name ?? "";
      const days = selectedDay
        ? [selectedDay]
        : Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);
      return days.map((day) => ({
        label: `${monthName.toUpperCase()} ${day}`,
        color: MONTH_COLORS[month - 1].argb,
        match: (p) => p.year === year && p.month === month && p.day === day,
      }));
    }
    case "MONTHLY":
      return MONTHS.filter((m) => selectedMonths.includes(m.value)).map((m) => ({
        label: m.name.toUpperCase(),
        color: MONTH_COLORS[m.value - 1].argb,
        match: (p) => p.year === year && p.month === m.value,
      }));
    case "QUARTERLY": {
      const list = quarter === "all" ? ["q1", "q2", "q3", "q4"] : [quarter];
      return list.flatMap((q) => {
        const idx = ["q1", "q2", "q3", "q4"].indexOf(q);
        if (idx < 0) return [];
        const months = [idx * 3 + 1, idx * 3 + 2, idx * 3 + 3];
        return [
          {
            label: QUARTERS[idx].toUpperCase(),
            color: MONTH_COLORS[idx * 3].argb,
            match: (p) => p.year === year && months.includes(p.month),
          },
        ];
      });
    }
    case "SEMI-ANNUAL": {
      const list = semester === "all" ? ["s1", "s2"] : [semester];
      return list.flatMap((s) => {
        const idx = ["s1", "s2"].indexOf(s);
        if (idx < 0) return [];
        const months = idx === 0 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
        return [
          {
            label: SEMESTERS[idx].toUpperCase(),
            color: idx === 0 ? "FFF97316" : "FF7C3AED",
            match: (p) => p.year === year && months.includes(p.month),
          },
        ];
      });
    }
    case "ANNUAL":
    default:
      return [
        {
          label: `ANNUAL ${year}`,
          color: "FF1E3A8A",
          match: (p) => p.year === year,
        },
      ];
  }
}

/* ------------------------------------------------------------------ *
 * Aggregation
 * ------------------------------------------------------------------ */
type Values = Record<string, number>;
/** modeIndex → fieldKey → value; inspection values live on index 0 only. */
interface Cellset {
  inspection: Values;
  modes: Values[];
}

const emptyCellset = (): Cellset => ({ inspection: {}, modes: [{}, {}] });

function recordDate(rec: ComplianceExportRecord) {
  const iso = String(rec?.dateinspected ?? "").slice(0, 10);
  if (!iso || iso.startsWith("1900")) return null;
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  if (!y || !m || !d) return null;
  return { year: y, month: m, day: d };
}

const bump = (target: Values, key: string, value: number) => {
  if (!value) return;
  target[key] = (target[key] ?? 0) + value;
};

function collect(list: ComplianceExportRecord[], period: PeriodDef): Cellset {
  const out = emptyCellset();
  (list ?? []).forEach((rec) => {
    const parts = recordDate(rec);
    if (!parts || !period.match(parts)) return;
    const r = rec as Record<string, unknown>;

    FIELDS.filter((f) => f.category === "INSPECTION").forEach((f) => {
      const aliases = TARGET_ALIASES[f.key] ?? [f.key];
      const value = aliases.reduce((acc, a) => acc || num(r[a]), 0);
      bump(out.inspection, f.key, value);
    });

    const issuanceFields = FIELDS.filter((f) => f.category !== "INSPECTION");
    const issuances = Array.isArray(rec.issuancelist) ? rec.issuancelist : [];
    issuances.forEach((iss) => {
      const i = iss as Record<string, unknown>;
      const modeIdx = num(i.fsicmode) === MODE_MANUAL || !num(i.fsicmode) ? 0 : 1;
      issuanceFields.forEach((f) => bump(out.modes[modeIdx], f.key, num(i[f.key])));
    });
    // Flattened payloads carry issuance counts on the day record → MANUAL.
    issuanceFields.forEach((f) => bump(out.modes[0], f.key, num(r[f.key])));
  });
  return out;
}

const addCellset = (a: Cellset, b: Cellset): Cellset => {
  const merged = emptyCellset();
  FIELDS.forEach((f) => {
    if (f.category === "INSPECTION") {
      bump(merged.inspection, f.key, (a.inspection[f.key] ?? 0) + (b.inspection[f.key] ?? 0));
    } else {
      [0, 1].forEach((m) => bump(merged.modes[m], f.key, (a.modes[m][f.key] ?? 0) + (b.modes[m][f.key] ?? 0)));
    }
  });
  return merged;
};

/* ------------------------------------------------------------------ *
 * Workbook
 * ------------------------------------------------------------------ */
const INTERVAL_TITLES: Record<CompliancePeriod, string> = {
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  "SEMI-ANNUAL": "SEMESTRAL",
  ANNUAL: "ANNUAL",
};

export async function exportComplianceGridWorkbook(opts: {
  year: number;
  groups: ComplianceExportGroup[];
  interval: CompliancePeriod;
  selectedMonths: number[];
  quarter: string;
  semester: string;
  selectedDay?: number | null;
  signatory?: ComplianceExportSignatory;
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
  } = opts;

  const periods = buildPeriods(interval, year, selectedMonths, quarter, semester, selectedDay);
  const showTotalBlock = periods.length > 1;

  const wb = new ExcelJS.Workbook();
  wb.creator = "FSIMS";
  wb.created = new Date();

  const COL = { NO: 1, PROV: 2, CODE: 3, STATION: 4, MODE: 5, DATA: 6 };
  const blockCount = periods.length + (showTotalBlock ? 1 : 0);
  const LAST = COL.DATA + blockCount * SPAN - 1;

  const ws = wb.addWorksheet(`Compliance ${year}`, {
    views: [{ state: "frozen", xSplit: 5, ySplit: 5, showGridLines: false }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Title
  ws.mergeCells(1, 1, 1, LAST);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `FIRE SAFETY COMPLIANCE — ${INTERVAL_TITLES[interval]} ACCOMPLISHMENT FOR THE YEAR ${year}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = fill("FFF8FAFC");
  ws.getRow(1).height = 28;

  const HR_PERIOD = 2;
  const HR_CAT = 3;
  const HR_GROUP = 4;
  const HR_LEAF = 5;

  ws.mergeCells(HR_PERIOD, COL.NO, HR_LEAF, COL.STATION);
  const stationHead = ws.getCell(HR_PERIOD, COL.NO);
  stationHead.value = "Station Information";
  stationHead.fill = fill("FF1D4ED8");
  stationHead.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  stationHead.alignment = { horizontal: "center", vertical: "middle" };
  stationHead.border = border("thin", "FF334155");

  ws.mergeCells(HR_PERIOD, COL.MODE, HR_LEAF, COL.MODE);
  const modeHead = ws.getCell(HR_PERIOD, COL.MODE);
  modeHead.value = "Mode of Issuance";
  modeHead.fill = fill("FF1D4ED8");
  modeHead.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  modeHead.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  modeHead.border = border("thin", "FF334155");

  // Category runs + group runs (contiguous)
  type Run = { category: Category; start: number; end: number };
  const catRuns: Run[] = [];
  FIELDS.forEach((f, i) => {
    const last = catRuns[catRuns.length - 1];
    if (last && last.category === f.category) last.end = i;
    else catRuns.push({ category: f.category, start: i, end: i });
  });

  type GroupRun = { label: string; category: Category; start: number; end: number; grouped: boolean };
  const groupRuns: GroupRun[] = [];
  FIELDS.forEach((f, i) => {
    const last = groupRuns[groupRuns.length - 1];
    if (f.group && last && last.grouped && last.label === f.group && last.category === f.category) {
      last.end = i;
    } else {
      groupRuns.push({
        label: f.group ?? f.leafLabel,
        category: f.category,
        start: i,
        end: i,
        grouped: Boolean(f.group),
      });
    }
  });

  const paintBlockHeader = (base: number, label: string, color: string) => {
    ws.mergeCells(HR_PERIOD, base, HR_PERIOD, base + SPAN - 1);
    const cell = ws.getCell(HR_PERIOD, base);
    cell.value = label;
    cell.fill = fill(color);
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border("thin", "FF334155");

    catRuns.forEach((run) => {
      const c1 = base + run.start;
      const c2 = base + run.end;
      if (c2 > c1) ws.mergeCells(HR_CAT, c1, HR_CAT, c2);
      const style = CATEGORY_FILL[run.category];
      const catCell = ws.getCell(HR_CAT, c1);
      catCell.value = run.category === "NOTICES" ? "ISSUED NOTICES" : run.category;
      catCell.fill = fill(style.fg);
      catCell.font = { bold: true, size: 10, color: { argb: style.font } };
      catCell.alignment = { horizontal: "center", vertical: "middle" };
      catCell.border = border("thin", "FF334155");
    });

    groupRuns.forEach((g) => {
      const c1 = base + g.start;
      const c2 = base + g.end;
      const sub = CATEGORY_FILL[g.category].sub;
      if (g.grouped) {
        if (c2 > c1) ws.mergeCells(HR_GROUP, c1, HR_GROUP, c2);
        const cell = ws.getCell(HR_GROUP, c1);
        cell.value = g.label;
        cell.fill = fill(sub);
        cell.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = border();
        for (let i = g.start; i <= g.end; i++) {
          const leaf = ws.getCell(HR_LEAF, base + i);
          leaf.value = FIELDS[i].leafLabel;
          leaf.fill = fill(sub);
          leaf.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
          leaf.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          leaf.border = border();
        }
      } else {
        ws.mergeCells(HR_GROUP, c1, HR_LEAF, c1);
        const cell = ws.getCell(HR_GROUP, c1);
        cell.value = g.label;
        cell.fill = fill(sub);
        cell.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = border();
      }
    });
  };

  const blockBase = (idx: number) => COL.DATA + idx * SPAN;
  periods.forEach((p, i) => paintBlockHeader(blockBase(i), p.label, p.color));
  if (showTotalBlock) paintBlockHeader(blockBase(periods.length), "TOTAL", "FF1E3A8A");

  ws.getRow(HR_PERIOD).height = 24;
  ws.getRow(HR_CAT).height = 20;
  ws.getRow(HR_GROUP).height = 20;
  ws.getRow(HR_LEAF).height = 26;

  ws.getColumn(COL.NO).width = 5;
  ws.getColumn(COL.PROV).width = 22;
  ws.getColumn(COL.CODE).width = 12;
  ws.getColumn(COL.STATION).width = 32;
  ws.getColumn(COL.MODE).width = 14;
  for (let c = COL.DATA; c <= LAST; c++) ws.getColumn(c).width = 9;

  /* --------------------------- body ---------------------------- */
  const provinceGroups = new Map<string, ComplianceExportGroup[]>();
  groups.forEach((g) => {
    const key = g.province || "—";
    const list = provinceGroups.get(key) ?? [];
    list.push(g);
    provinceGroups.set(key, list);
  });
  const provinceNames = Array.from(provinceGroups.keys()).sort((a, b) => a.localeCompare(b));

  const grandCells: Cellset[] = Array.from({ length: blockCount }, emptyCellset);
  let cursor = HR_LEAF + 1;

  const writeValue = (r: number, c: number, value: number, style?: { fillArgb?: string; bold?: boolean; fontArgb?: string }) => {
    const cell = ws.getCell(r, c);
    cell.value = Number(value) || 0;
    cell.numFmt = NUMBER_FMT;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = border();
    cell.font = { size: 9, bold: style?.bold, color: { argb: style?.fontArgb ?? "FF0F172A" } };
    if (style?.fillArgb) cell.fill = fill(style.fillArgb);
  };

  provinceNames.forEach((provinceName, provinceIndex) => {
    const stations = (provinceGroups.get(provinceName) ?? []).sort((a, b) =>
      String(a.stationName).localeCompare(String(b.stationName)),
    );
    const provinceCells: Cellset[] = Array.from({ length: blockCount }, emptyCellset);

    stations.forEach((station, stationIndex) => {
      const top = cursor;
      const bottom = cursor + 1;
      const alt = stationIndex % 2 === 1;
      const bgArgb = alt ? "FFF8FAFC" : undefined;

      // Station identity — merged across the two mode rows.
      const identity: [number, string | number][] = [
        [COL.NO, stationIndex + 1],
        [COL.PROV, provinceName],
        [COL.CODE, station.stationCode],
        [COL.STATION, station.stationName],
      ];
      identity.forEach(([col, value]) => {
        ws.mergeCells(top, col, bottom, col);
        const cell = ws.getCell(top, col);
        cell.value = value;
        cell.font = { size: 9, color: { argb: "FF0F172A" } };
        cell.alignment = {
          horizontal: col === COL.STATION ? "left" : "center",
          vertical: "middle",
          wrapText: col === COL.STATION,
        };
        cell.border = border();
        if (bgArgb) cell.fill = fill(bgArgb);
      });

      MODES.forEach((mode, modeIdx) => {
        const cell = ws.getCell(top + modeIdx, COL.MODE);
        cell.value = mode;
        cell.font = { size: 9, bold: true, color: { argb: "FF0F172A" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = border();
        cell.fill = fill(modeIdx === 0 ? "FFEFF6FF" : "FFFFFBEB");
      });

      const stationBlocks: Cellset[] = [];
      periods.forEach((period, pIdx) => {
        const cells = collect(station.compliancelist, period);
        stationBlocks[pIdx] = cells;
        provinceCells[pIdx] = addCellset(provinceCells[pIdx], cells);
        grandCells[pIdx] = addCellset(grandCells[pIdx], cells);
      });

      if (showTotalBlock) {
        const totalIdx = periods.length;
        const totals = stationBlocks.reduce(addCellset, emptyCellset());
        stationBlocks[totalIdx] = totals;
        provinceCells[totalIdx] = addCellset(provinceCells[totalIdx], totals);
        grandCells[totalIdx] = addCellset(grandCells[totalIdx], totals);
      }

      stationBlocks.forEach((cells, blockIdx) => {
        const base = blockBase(blockIdx);
        FIELDS.forEach((f, fi) => {
          const col = base + fi;
          if (f.category === "INSPECTION") {
            ws.mergeCells(top, col, bottom, col);
            writeValue(top, col, cells.inspection[f.key] ?? 0, { fillArgb: bgArgb });
          } else {
            MODES.forEach((_, modeIdx) =>
              writeValue(top + modeIdx, col, cells.modes[modeIdx][f.key] ?? 0, {
                fillArgb: bgArgb,
              }),
            );
          }
        });
      });

      ws.getRow(top).height = 18;
      ws.getRow(bottom).height = 18;
      cursor += 2;
    });

    // Provincial total
    const provRow = cursor;
    ws.mergeCells(provRow, COL.NO, provRow, COL.MODE);
    const provLabel = ws.getCell(provRow, COL.NO);
    provLabel.value = `PROVINCIAL TOTAL — ${provinceName.toUpperCase()}`;
    provLabel.fill = fill("FFFEF08A");
    provLabel.font = { bold: true, size: 10, color: { argb: "FF0F172A" } };
    provLabel.alignment = { horizontal: "center", vertical: "middle" };
    provLabel.border = border("thin", "FF334155");

    provinceCells.forEach((cells, blockIdx) => {
      const base = blockBase(blockIdx);
      FIELDS.forEach((f, fi) => {
        const value =
          f.category === "INSPECTION"
            ? (cells.inspection[f.key] ?? 0)
            : (cells.modes[0][f.key] ?? 0) + (cells.modes[1][f.key] ?? 0);
        writeValue(provRow, base + fi, value, { fillArgb: "FFFEF08A", bold: true });
      });
    });
    ws.getRow(provRow).height = 20;
    cursor++;

    if (provinceIndex < provinceNames.length - 1) cursor++;
  });

  // One blank row, then the regional grand total.
  cursor++;
  const grandRow = cursor;
  ws.mergeCells(grandRow, COL.NO, grandRow, COL.MODE);
  const grandLabel = ws.getCell(grandRow, COL.NO);
  grandLabel.value = "REGIONAL GRAND TOTAL — MIMAROPA";
  grandLabel.fill = fill("FF0F766E");
  grandLabel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  grandLabel.alignment = { horizontal: "center", vertical: "middle" };
  grandLabel.border = border("thin", "FF334155");

  grandCells.forEach((cells, blockIdx) => {
    const base = blockBase(blockIdx);
    FIELDS.forEach((f, fi) => {
      const value =
        f.category === "INSPECTION"
          ? (cells.inspection[f.key] ?? 0)
          : (cells.modes[0][f.key] ?? 0) + (cells.modes[1][f.key] ?? 0);
      writeValue(grandRow, base + fi, value, {
        fillArgb: "FF0F766E",
        bold: true,
        fontArgb: "FFFFFFFF",
      });
    });
  });
  ws.getRow(grandRow).height = 22;
  cursor += 2;

  /* ------------------------- signatory -------------------------- */
  const footerStart = cursor + 1;
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

  ws.mergeCells(signatureRow, 1, signatureRow, 6);
  const nameCell = ws.getCell(signatureRow, 1);
  const rankFullName = [signatory?.rank, signatory?.fullname].filter(Boolean).join(" ").trim();
  nameCell.value = rankFullName || "____________________________";
  nameCell.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  nameCell.alignment = { horizontal: "left", vertical: "middle" };
  nameCell.border = { top: { style: "thin", color: { argb: "FF334155" } } } as ExcelJS.Borders;

  const designationRow = signatureRow + 1;
  ws.mergeCells(designationRow, 1, designationRow, 6);
  const designationCell = ws.getCell(designationRow, 1);
  designationCell.value = signatory?.designation || "Designation";
  designationCell.font = { italic: true, size: 10, color: { argb: "FF475569" } };
  designationCell.alignment = { horizontal: "left", vertical: "middle" };

  const dateRow = designationRow + 1;
  ws.mergeCells(dateRow, 1, dateRow, 6);
  const dateCell = ws.getCell(dateRow, 1);
  dateCell.value = `Date Generated: ${formatMilitaryTimestamp(new Date())}`;
  dateCell.font = { size: 10, color: { argb: "FF475569" } };
  dateCell.alignment = { horizontal: "left", vertical: "middle" };

  ws.pageSetup.printArea = `A1:${ws.getCell(dateRow, LAST).address}`;
  ws.pageSetup.printTitlesRow = `${HR_PERIOD}:${HR_LEAF}`;

  const buf = await wb.xlsx.writeBuffer();
  saveAs(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    opts.filename ?? `FireSafetyCompliance_${INTERVAL_TITLES[interval]}_${year}.xlsx`,
  );
}
