import * as React from "react";
import { Download, LayoutGrid, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
import { MATRIX_TONE } from "@/lib/theme";
import { MONTH_NAMES } from "@/lib/complianceHelpers";
import { MONTH_COLORS } from "@/pages/04_compliance/components/monthColors";
import {
  exportComplianceMatrix,
  type ComplianceExportStation,
} from "@/pages/04_compliance/components/matrixExport";
import { noticeAPI } from "@/services/noticeAPI";
import { unwrap } from "@/lib/api-envelope";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import type { NoticeRecord } from "@/pages/05_notices/Notice";
import type { NoticeCategory, NoticeDetailModel } from "@/types/noticeType";


/* -------------------------------------------------------------------------
 * Column identity — mirrors the Fire Safety Compliance matrix layout so both
 * modules share the same visual contract (Station + Mode of Issuance sticky
 * columns, Quarter → Month → Category headers, then quarter / semester /
 * annual roll-ups).
 * ---------------------------------------------------------------------- */

const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  quarter: MATRIX_TONE.quarter,
  month: MATRIX_TONE.month,
  cat: MATRIX_TONE.catNotice,
  catSub: MATRIX_TONE.catNoticeSub,
  semester: MATRIX_TONE.semester,
  annual: MATRIX_TONE.annual,
  totalRow: MATRIX_TONE.provTotalRow,
};

const QUARTERS = [
  { label: "Quarter 1", months: [1, 2, 3] },
  { label: "Quarter 2", months: [4, 5, 6] },
  { label: "Quarter 3", months: [7, 8, 9] },
  { label: "Quarter 4", months: [10, 11, 12] },
];

const NOTICE_CATEGORIES: NoticeCategory[] = ["NOD", "NTC", "NTCV", "Abatement", "Closure"];

const CATEGORY_LABEL: Record<NoticeCategory, string> = {
  NOD: "NOD",
  NTC: "NTC",
  NTCV: "NTCV",
  Abatement: "Abatement",
  Closure: "Closure",
};

/** Category → `noticeaccomlist` count field returned by the Export endpoint. */
const ACCOM_FIELD: Record<NoticeCategory, string> = {
  NOD: "nodcount",
  NTC: "ntccount",
  NTCV: "ntcvcount",
  Abatement: "abatementcount",
  Closure: "closurecount",
};



type IssuanceMode = "MANUAL" | "FSIS";
const ISSUANCE_MODES: { key: IssuanceMode; label: string }[] = [
  { key: "MANUAL", label: "MANUAL" },
  { key: "FSIS", label: "FSIS" },
];

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const AGGREGATES = [
  { key: "q1", label: "Quarter 1 Total", months: [1, 2, 3], tone: STYLE.quarter },
  { key: "q2", label: "Quarter 2 Total", months: [4, 5, 6], tone: STYLE.quarter },
  { key: "q3", label: "Quarter 3 Total", months: [7, 8, 9], tone: STYLE.quarter },
  { key: "q4", label: "Quarter 4 Total", months: [10, 11, 12], tone: STYLE.quarter },
  { key: "sem1", label: "1st Semester", months: [1, 2, 3, 4, 5, 6], tone: STYLE.semester },
  { key: "sem2", label: "2nd Semester", months: [7, 8, 9, 10, 11, 12], tone: STYLE.semester },
  { key: "annual", label: "Annual", months: ALL_MONTHS, tone: STYLE.annual },
] as const;

type CategoryCounts = Record<NoticeCategory, number>;
type MonthBuckets = Record<number, CategoryCounts>;

function emptyCounts(): CategoryCounts {
  return NOTICE_CATEGORIES.reduce((acc, c) => ({ ...acc, [c]: 0 }), {} as CategoryCounts);
}

function bucketAt(months: MonthBuckets, month: number): CategoryCounts {
  return (months[month] ??= emptyCounts());
}

/**
 * Resolve the calendar month a ledger line belongs to. Day lines are keyed by
 * `yyyy-mm-dd`, monthly lines by `yyyy-mm`; aggregated (quarter / semester /
 * annual) lines cannot be attributed to a single month and are skipped.
 */
function lineMonth(key: string): number {
  const match = /^\d{4}-(\d{2})(?:-\d{2})?$/.exec(key);
  if (!match) return 0;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? month : 0;
}

function buildModeMonths(record: NoticeRecord): Record<IssuanceMode, MonthBuckets> {
  const modeMonths: Record<IssuanceMode, MonthBuckets> = { MANUAL: {}, FSIS: {} };
  for (const line of record.lines ?? []) {
    const month = lineMonth(line.key) || record.reportMonth;
    if (month < 1 || month > 12) continue;
    const manual = bucketAt(modeMonths.MANUAL, month);
    const fsis = bucketAt(modeMonths.FSIS, month);
    for (const category of NOTICE_CATEGORIES) {
      manual[category] += line.manual[category] ?? 0;
      fsis[category] += line.fsis[category] ?? 0;
    }
  }
  return modeMonths;
}

function sumMonthsOf(months: MonthBuckets, list: readonly number[]): CategoryCounts {
  const out = emptyCounts();
  for (const m of list) {
    const bucket = months[m];
    if (!bucket) continue;
    for (const category of NOTICE_CATEGORIES) out[category] += bucket[category] ?? 0;
  }
  return out;
}

function combineMonths(modeMonths: Record<IssuanceMode, MonthBuckets>): MonthBuckets {
  const out: MonthBuckets = {};
  for (const mode of ISSUANCE_MODES) {
    const src = modeMonths[mode.key];
    for (const key of Object.keys(src)) {
      const month = Number(key);
      const dst = bucketAt(out, month);
      for (const category of NOTICE_CATEGORIES) dst[category] += src[month][category] ?? 0;
    }
  }
  return out;
}

/* -------------------------------------------------------------------------
 * Excel export — POST /FSISNotice/Export, then plotted through the shared
 * compliance-matrix workbook writer so both modules produce the same layout
 * (Station Information | Mode of Issuance | Quarter → Month → Category …).
 * ---------------------------------------------------------------------- */

const EXPORT_FIELDS = NOTICE_CATEGORIES.map((c) => ({
  key: ACCOM_FIELD[c],
  label: CATEGORY_LABEL[c],
  category: "NOTICES",
}));

const FSIC_MODE_CODE: Record<IssuanceMode, number> = { MANUAL: 96, FSIS: 97 };

function emptyExportBucket(): Record<string, number> {
  return Object.fromEntries(NOTICE_CATEGORIES.map((c) => [ACCOM_FIELD[c], 0]));
}

function exportBucketAt(
  months: Record<number, Record<string, number>>,
  month: number,
): Record<string, number> {
  return (months[month] ??= emptyExportBucket());
}

interface NoticeMatrixModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: NoticeRecord | null;
}

export function NoticeMatrixModal({ open, onOpenChange, record }: NoticeMatrixModalProps) {
  const { user } = useAuth();
  const [exporting, setExporting] = React.useState(false);
  const modeMonths = React.useMemo(
    () => (record ? buildModeMonths(record) : { MANUAL: {}, FSIS: {} }),
    [record],
  );
  const combined = React.useMemo(() => combineMonths(modeMonths), [modeMonths]);

  const handleExport = async () => {
    if (!record) return;
    const year = Number(record.reportYear) || new Date().getFullYear();
    setExporting(true);
    try {
      const resp = await noticeAPI.export({
        searchkey: "",
        reportyear: year,
        provinces: [{ provinceno: record.provinceno, stationnos: [record.stationno] }],
      });
      const { ok, data, error } = unwrap<NoticeDetailModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export Accomplished Notices Matrix.");
        return;
      }

      const stations = Array.isArray(data) ? data : [];
      if (stations.length === 0) {
        toast.info("No accomplished notices to export.");
        return;
      }

      // province → stations, each station carrying MANUAL + FSIS month rows.
      const byProvince = new Map<string, ComplianceExportStation[]>();
      for (const station of stations) {
        const combinedMonths: Record<number, Record<string, number>> = {};
        const perMode: Record<IssuanceMode, Record<number, Record<string, number>>> = {
          MANUAL: {},
          FSIS: {},
        };

        for (const entry of station.noticedetallist ?? []) {
          const month = Number(String(entry.dateaccomplish ?? "").slice(5, 7));
          if (!(month >= 1 && month <= 12)) continue;
          for (const accom of entry.noticeaccomlist ?? []) {
            const mode = ISSUANCE_MODES.find(
              (m) => FSIC_MODE_CODE[m.key] === Number(accom.fsicmode),
            )?.key;
            if (!mode) continue;
            const modeBucket = exportBucketAt(perMode[mode], month);
            const allBucket = exportBucketAt(combinedMonths, month);
            for (const category of NOTICE_CATEGORIES) {
              const field = ACCOM_FIELD[category];
              const value =
                Number((accom as unknown as Record<string, unknown>)[field] ?? 0) || 0;
              modeBucket[field] += value;
              allBucket[field] += value;
            }
          }
        }

        const provinceName = station.provincename || record.province || "Unknown Province";
        const bucket = byProvince.get(provinceName) ?? [];
        bucket.push({
          stationno: station.stationno,
          stationCode: station.stationcode ?? "",
          stationName: station.stationname ?? "",
          cityName: station.cityname ?? "",
          months: combinedMonths,
          modes: ISSUANCE_MODES.map((m) => ({ label: m.label, months: perMode[m.key] })),
        });
        byProvince.set(provinceName, bucket);
      }

      await exportComplianceMatrix({
        year,
        groups: Array.from(byProvince.entries()).map(([province, list]) => ({
          province,
          stations: list.sort((a, b) => (a.stationCode || "").localeCompare(b.stationCode || "")),
        })),
        fields: EXPORT_FIELDS,
        title: `ACCOMPLISHED NOTICES MATRIX — ${year}`,
        sheetName: `Notices Matrix ${year}`,
        signatory: {
          rank:
            (user as unknown as { rankcode?: string; rankname?: string })?.rankcode ??
            (user as unknown as { rankname?: string })?.rankname ??
            "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: (user as unknown as { designation?: string })?.designation ?? "",
        },
        filename: `AccomplishedNoticesMatrix_${year}.xlsx`,
      });
      toast.success("Accomplished Notices Matrix exported.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Accomplished Notices Matrix.");
    } finally {
      setExporting(false);
    }
  };

  if (!record) return null;


  const catSpan = NOTICE_CATEGORIES.length;
  const totalCols = 2 + 12 * catSpan + AGGREGATES.length * catSpan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Accomplished Notices Matrix</DialogTitle>
              <p className="text-xs text-muted-foreground">
                Manual and FSIS issuance — {record.reportYear}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {exporting ? "Exporting…" : "Export"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-2"
            >
              Close
            </Button>
          </div>

        </DialogHeader>

        {/* Filters — read-only scope, mirrors the compliance matrix filter bar */}
        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Year
              </div>
              <ReadOnlyField value={String(record.reportYear)} placeholder="Year" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              <ReadOnlyField value={record.province} placeholder="All provinces" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                City / Municipality
              </div>
              <ReadOnlyField value={record.municipality} placeholder="All municipalities" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Station
              </div>
              <ReadOnlyField value={record.stationname} placeholder="All stations" />
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <MatrixHeader catSpan={catSpan} />
            <tbody>
              <tr>
                <td
                  colSpan={2}
                  className={`sticky left-0 z-10 border-b border-t-2 border-t-slate-400/60 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] ${MATRIX_TONE.provHeaderRow}`}
                >
                  {record.province || "Province"}
                </td>
                <td
                  colSpan={totalCols - 2}
                  aria-hidden="true"
                  className="border-b border-t-2 border-grid-strong group-row"
                />
              </tr>

              {ISSUANCE_MODES.map((mode, mi) => (
                <ModeRow
                  key={mode.key}
                  record={record}
                  modeLabel={mode.label}
                  months={modeMonths[mode.key] ?? {}}
                  showStation={mi === 0}
                  rowBg={mi % 2 === 1 ? "bg-muted" : "bg-card"}
                />
              ))}

              <TotalRow months={combined} />
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatrixHeader({ catSpan }: { catSpan: number }) {
  return (
    <thead className="sticky top-0 z-30">
      <tr>
        <th
          rowSpan={3}
          className={`sticky left-0 top-0 z-40 min-w-[240px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Station
        </th>
        <th
          rowSpan={3}
          className={`sticky left-[240px] top-0 z-40 min-w-[120px] border-b border-r px-3 py-2 text-center uppercase tracking-wider ${STYLE.stationHead}`}
        >
          Mode of Issuance
        </th>
        {QUARTERS.map((q) => (
          <th
            key={q.label}
            colSpan={3 * catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.quarter}`}
          >
            {q.label}
          </th>
        ))}
        {AGGREGATES.map((a) => (
          <th
            key={`agg-${a.key}`}
            rowSpan={2}
            colSpan={catSpan}
            className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${a.tone}`}
          >
            {a.label}
          </th>
        ))}
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.map((mv, i) => {
            const color = MONTH_COLORS[mv - 1];
            return (
              <th
                key={`m-${mv}`}
                colSpan={catSpan}
                style={{ backgroundColor: color.bg, color: color.text }}
                className={`border-b px-2 py-1.5 text-center font-semibold uppercase ${
                  i === 2 ? "border-r-2 border-r-white/30" : "border-r"
                }`}
              >
                {MONTH_NAMES[mv - 1]}
              </th>
            );
          }),
        )}
      </tr>
      <tr>
        {QUARTERS.flatMap((q) =>
          q.months.flatMap((mv, monthIdx) =>
            NOTICE_CATEGORIES.map((category, ci) => (
              <th
                key={`c-${mv}-${category}`}
                className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                  ci === NOTICE_CATEGORIES.length - 1 && monthIdx === 2
                    ? "border-r-2 border-r-white/30"
                    : "border-r"
                } ${STYLE.catSub}`}
              >
                {CATEGORY_LABEL[category]}
              </th>
            )),
          ),
        )}
        {AGGREGATES.flatMap((a) =>
          NOTICE_CATEGORIES.map((category, ci) => (
            <th
              key={`c-${a.key}-${category}`}
              className={`border-b px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                ci === NOTICE_CATEGORIES.length - 1 ? "border-r-2 border-r-white/40" : "border-r"
              } ${STYLE.catSub}`}
            >
              {CATEGORY_LABEL[category]}
            </th>
          )),
        )}
      </tr>
    </thead>
  );
}

function ValueCell({
  value,
  bold,
  boundary,
  rowClass,
}: {
  value: number;
  bold?: boolean;
  boundary?: boolean;
  rowClass?: string;
}) {
  return (
    <td
      className={`border-b px-2 py-1.5 text-center tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${value === 0 && !bold ? "text-muted-foreground/60" : ""} ${
        rowClass ?? ""
      }`}
    >
      {value.toLocaleString()}
    </td>
  );
}

function DataCells({ months, rowClass }: { months: MonthBuckets; rowClass?: string }) {
  return (
    <>
      {ALL_MONTHS.map((mv) => {
        const bucket = months[mv];
        const quarterEnd = mv % 3 === 0;
        return NOTICE_CATEGORIES.map((category, i) => (
          <ValueCell
            key={`m-${mv}-${category}`}
            value={bucket?.[category] ?? 0}
            boundary={i === NOTICE_CATEGORIES.length - 1 && quarterEnd}
            rowClass={rowClass}
          />
        ));
      })}
      {AGGREGATES.map((a) => {
        const totals = sumMonthsOf(months, a.months);
        return NOTICE_CATEGORIES.map((category, i) => (
          <ValueCell
            key={`a-${a.key}-${category}`}
            value={totals[category]}
            bold
            boundary={i === NOTICE_CATEGORIES.length - 1}
            rowClass={rowClass}
          />
        ));
      })}
    </>
  );
}

function ModeRow({
  record,
  modeLabel,
  months,
  showStation,
  rowBg,
}: {
  record: NoticeRecord;
  modeLabel: string;
  months: MonthBuckets;
  showStation: boolean;
  rowBg: string;
}) {
  return (
    <tr className={rowBg}>
      {showStation ? (
        <td
          rowSpan={3}
          className={`sticky left-0 z-20 min-w-[240px] border-b border-r px-3 py-2 ${rowBg}`}
        >
          <div className="flex items-center gap-2">
            <AvatarWithFallback
              entity={{ name: record.stationname }}
              name={record.stationname}
              className="h-8 w-8 shrink-0 rounded-full ring-1 ring-primary/20"
            />
            <div className="min-w-0">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {record.stationcode}
              </span>
              <div className="truncate text-[11px] font-semibold">{record.stationname}</div>
            </div>
          </div>
        </td>
      ) : null}
      <td
        className={`sticky left-[240px] z-20 min-w-[120px] border-b border-r px-3 py-2 text-center text-[11px] font-semibold uppercase ${rowBg}`}
      >
        {modeLabel}
      </td>
      <DataCells months={months} />
    </tr>
  );
}

function TotalRow({ months }: { months: MonthBuckets }) {
  return (
    <tr>
      <td
        className={`sticky left-[240px] z-20 min-w-[120px] border-b border-r px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider ${STYLE.totalRow}`}
      >
        Total
      </td>
      <DataCells months={months} rowClass={STYLE.totalRow} />
    </tr>
  );
}

export default NoticeMatrixModal;
