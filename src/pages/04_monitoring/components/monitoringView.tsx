import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { stationAPI } from "@/services/stationAPI";
import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import { CATEGORY_FIELDS } from "@/lib/inventoryHelpers";
import ReadOnlyField from "@/pages/05_target-reference/components/ReadOnlyField";
import type { DailyInventoryDTO } from "@/types/inventoryType";
import type {
  TargetAccomplishmentModel,
} from "@/types/targetinventoryType";
import type { SearchStationModel } from "@/types/stationTypes";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";

const CATEGORY_ORDER = ["INSPECTION", "FSEC", "FSIC", "NOTICES"] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: CATEGORY_FIELDS[category],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

/** Group header tones — kept in lock-step with the Edit page (`monitoringEdit.tsx`)
 *  so both views share the same visual identity. */
const GROUP_TONE: Record<(typeof CATEGORY_ORDER)[number], string> = {
  INSPECTION: "bg-emerald-600 text-white",
  FSEC: "bg-sky-600 text-white",
  FSIC: "bg-indigo-600 text-white",
  NOTICES: "bg-amber-600 text-white",
};

/**
 * Shape of a single item in `data[0].fsisInventoryDetailList`. All numeric
 * count fields sit flat on the record (unlike Monthly, which nests issuance
 * counts inside `issuancelist`).
 */
interface FSISInventoryDetailItem {
  fsisno: string;
  dateinspected: string | Date;
  remarks?: string | null;

  inspectduringcount?: number | null;
  inspectaftercount?: number | null;
  inspectbplocount?: number | null;
  inspectgovcount?: number | null;
  inspectpezacount?: number | null;
  inspecttiezacount?: number | null;

  fsecbuildingcount?: number | null;
  fsecgovcount?: number | null;
  fsecpezacount?: number | null;
  fsectiezacount?: number | null;

  fsicoccupancycount?: number | null;
  fsicbplonewcount?: number | null;
  fsicbplorenewcount?: number | null;
  fsicgovcount?: number | null;
  fsicpezacount?: number | null;
  fsictiezacount?: number | null;

  nodcount?: number | null;
  ntccount?: number | null;
  ntcvcount?: number | null;
  avatementcount?: number | null;
  closurecount?: number | null;
}

interface FSISInventoryDetailStation {
  stationno: string;
  month?: number;
  year?: number;

  totaltargetbplo?: number;
  totaltargetgov?: number;
  totaltargetpeza?: number;
  totaltargettieza?: number;
  totalAccomplishmentbplo?: number;
  totalAccomplishmentgov?: number;
  totalAccomplishmentpeza?: number;
  totalAccomplishmenttieza?: number;

  fsisInventoryDetailList?: FSISInventoryDetailItem[] | null;
}

/** Map from our internal DailyInventoryDTO keys to the flat Detail API keys. */
const FIELD_TO_API: Record<string, keyof FSISInventoryDetailItem> = {
  insp_during: "inspectduringcount",
  insp_after: "inspectaftercount",
  insp_bplo: "inspectbplocount",
  insp_gov: "inspectgovcount",
  insp_peza: "inspectpezacount",
  insp_tieza: "inspecttiezacount",
  fsec_building: "fsecbuildingcount",
  fsec_gov: "fsecgovcount",
  fsec_peza: "fsecpezacount",
  fsec_tieza: "fsectiezacount",
  fsic_occupancy: "fsicoccupancycount",
  fsic_bplo_new: "fsicbplonewcount",
  fsic_bplo_renewal: "fsicbplorenewcount",
  fsic_gov: "fsicgovcount",
  fsic_peza: "fsicpezacount",
  fsic_tieza: "fsictiezacount",
  not_nod: "nodcount",
  not_ntc: "ntccount",
  not_ntcv: "ntcvcount",
  not_abatement: "avatementcount",
  not_closure: "closurecount",
};

type DayTotals = Partial<Record<keyof DailyInventoryDTO, number>>;

interface DaySlice {
  /** 1..31 — day-of-month. */
  day: number;
  /** Display label, e.g. "July 1". */
  label: string;
  /** YYYY-MM-DD local key (used internally only). */
  key: string;
  totals: DayTotals;
  remarks: string;
}

/** Local YYYY-MM-DD (no timezone shift). */
function toLocalKey(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * Normalize an incoming `dateinspected` (string like "2026-07-21T00:00:00"
 * or a Date) to a local YYYY-MM-DD key WITHOUT UTC drift. Strings that
 * already start with `YYYY-MM-DD` are trusted as calendar dates.
 */
function normalizeDateKey(v: string | Date | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return toLocalKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return toLocalKey(v.getFullYear(), v.getMonth() + 1, v.getDate());
  }
  return null;
}

/** Days in month — correct for leap years via day-0 trick. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build a per-day lookup keyed by YYYY-MM-DD from the API list.
 * Duplicate dates are aggregated by summing every numeric count field and
 * concatenating remarks with " · " separators (empty remarks skipped).
 */
function buildDailyLookup(
  list: FSISInventoryDetailItem[] | null | undefined,
): Map<string, { totals: DayTotals; remarks: string }> {
  const map = new Map<string, { totals: DayTotals; remarks: string }>();
  if (!Array.isArray(list)) return map;

  for (const rec of list) {
    const key = normalizeDateKey(rec?.dateinspected);
    if (!key) continue;

    let bucket = map.get(key);
    if (!bucket) {
      bucket = { totals: {}, remarks: "" };
      map.set(key, bucket);
    }

    for (const field of DETAIL_FIELDS) {
      const apiKey = FIELD_TO_API[String(field.key)];
      if (!apiKey) continue;
      const prev = Number(bucket.totals[field.key as keyof DailyInventoryDTO] ?? 0);
      bucket.totals[field.key as keyof DailyInventoryDTO] =
        prev + num(rec[apiKey]);
    }

    const r = (rec?.remarks ?? "").toString().trim();
    if (r) bucket.remarks = bucket.remarks ? `${bucket.remarks} · ${r}` : r;
  }

  return map;
}

/**
 * Read-only monthly overview:
 *
 *  1. `Monthly Target vs. Inspected` summary — driven by a Month dropdown
 *     that defaults to the current calendar month. The Year is locked to
 *     the Ledger record and displayed as a read-only field.
 *  2. Daily breakdown table — EVERY day of the selected month is rendered
 *     as its own row (July 1..31, Feb 1..28/29, etc.). Days without any
 *     API record still appear with zero values and empty remarks.
 */
function InventoryViewBody({
  stationno,
  year,
  initialMonth,
}: {
  stationno: string;
  year: number;
  initialMonth?: number;
}) {
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    if (initialMonth && initialMonth >= 1 && initialMonth <= 12) return initialMonth;
    return new Date().getMonth() + 1;
  });
  const [loading, setLoading] = React.useState(true);
  const [station, setStation] = React.useState<FSISInventoryDetailStation | null>(null);
  const [provinceno, setProvinceno] = React.useState<string | null>(null);

  // Resolve provinceno once per station — Detail endpoint requires it.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const sResp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      if (cancelled) return;
      const seed = Array.isArray(sData) ? sData[0] : undefined;
      setProvinceno(seed?.provinceno ?? EMPTY_GUID);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno]);

  // Fetch Detail whenever station / year / month changes.
  React.useEffect(() => {
    if (provinceno == null) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await targetinventoryAPI.getDetail(
        {
          Stationno: stationno || EMPTY_GUID,
          Provinceno: provinceno,
          Reportyear: year,
          Reportmonth: selectedMonth,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;

      const { ok, data, error } = unwrap<FSISInventoryDetailStation[]>(resp);
      if (!ok) toast.error(error || "Failed to load daily details.");
      const first = ok && Array.isArray(data) ? data[0] ?? null : null;
      setStation(first);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, provinceno, year, selectedMonth]);

  // Build every day of the selected month — always, even when the API
  // response is empty or the list is null.
  const slices = React.useMemo<DaySlice[]>(() => {
    const lookup = buildDailyLookup(station?.fsisInventoryDetailList);
    const total = daysInMonth(year, selectedMonth);
    const monthName = MONTHS[selectedMonth - 1]?.name ?? "";
    const out: DaySlice[] = [];
    for (let d = 1; d <= total; d++) {
      const key = toLocalKey(year, selectedMonth, d);
      const hit = lookup.get(key);
      out.push({
        day: d,
        label: `${monthName} ${d}, ${year}`,
        key,
        totals: hit?.totals ?? {},
        remarks: hit?.remarks ?? "",
      });
    }
    return out;
  }, [station, year, selectedMonth]);

  const summary = React.useMemo<TargetAccomplishmentModel | null>(() => {
    if (!station) return null;
    return {
      stationno: station.stationno,
      month: station.month ?? selectedMonth,
      year: station.year ?? year,
      totaltargetbplo: num(station.totaltargetbplo),
      totaltargetgov: num(station.totaltargetgov),
      totaltargetpeza: num(station.totaltargetpeza),
      totaltargettieza: num(station.totaltargettieza),
      totalAccomplishmentbplo: num(station.totalAccomplishmentbplo),
      totalAccomplishmentgov: num(station.totalAccomplishmentgov),
      totalAccomplishmentpeza: num(station.totalAccomplishmentpeza),
      totalAccomplishmenttieza: num(station.totalAccomplishmenttieza),
    };
  }, [station, year, selectedMonth]);

  const columnTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const field of DETAIL_FIELDS) {
      totals[String(field.key)] = slices.reduce(
        (sum, s) => sum + num(s.totals[field.key as keyof DailyInventoryDTO]),
        0,
      );
    }
    return totals;
  }, [slices]);

  const grandTotal = React.useMemo(
    () => Object.values(columnTotals).reduce((a, b) => a + b, 0),
    [columnTotals],
  );

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Monthly Target vs. Inspected — month selector, year locked. */}
      <Card className="border-border/60 p-4 shadow-soft">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Month
            </label>
            <Select
              value={String(selectedMonth)}
              onValueChange={(v) => setSelectedMonth(Number(v))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Year
            </label>
            <ReadOnlyField value={year} title="Year is locked to the selected ledger record" />
          </div>
        </div>

        <TargetAccomplishmentPanel
          stationno={stationno}
          year={year}
          month={selectedMonth}
          data={summary}
        />
      </Card>

      {/* 2. Daily breakdown — every day of the selected month. */}
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="max-h-[65vh] w-full max-w-full overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 min-w-[120px] border-b border-r bg-blue-700 px-3 py-2 text-left uppercase tracking-wider text-white"
                >
                  Date
                </th>
                {FIELD_GROUPS.map((group) => (
                  <th
                    key={group.category}
                    colSpan={group.fields.length}
                    className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${GROUP_TONE[group.category]}`}
                  >
                    {group.category}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-b border-r bg-slate-700 px-3 py-2 text-center uppercase tracking-wider text-white min-w-[80px]"
                >
                  TOTAL
                </th>
                <th
                  rowSpan={2}
                  className="border-b bg-slate-700 px-3 py-2 text-left uppercase tracking-wider text-white min-w-[200px]"
                >
                  REMARKS
                </th>
              </tr>
              <tr>
                {DETAIL_FIELDS.map((field) => (
                  <th
                    key={String(field.key)}
                    className="border-b border-r bg-emerald-100 px-1.5 py-1 text-right text-[10px] font-bold uppercase text-emerald-900 min-w-[72px] dark:bg-emerald-950/60 dark:text-emerald-100"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slices.map((slice, index) => {
                const rowTotal = DETAIL_FIELDS.reduce(
                  (sum, f) => sum + num(slice.totals[f.key as keyof DailyInventoryDTO]),
                  0,
                );
                // Solid zebra so the sticky Date column stays opaque
                // while horizontally scrolling — matches the Edit page.
                const zebra = index % 2 === 1 ? "bg-muted" : "bg-card";
                return (
                  <tr key={slice.key} className={zebra}>
                    <td
                      className={`sticky left-0 z-20 border-b border-r px-3 py-1.5 font-semibold ${zebra}`}
                    >
                      {slice.label}
                    </td>
                    {DETAIL_FIELDS.map((field) => {
                      const v = num(slice.totals[field.key as keyof DailyInventoryDTO]);
                      return (
                        <td
                          key={String(field.key)}
                          className="border-b border-r px-3 py-1.5 text-right tabular-nums"
                        >
                          {v.toLocaleString()}
                        </td>
                      );
                    })}
                    <td className="border-b px-3 py-1.5 text-right font-semibold tabular-nums">
                      {rowTotal.toLocaleString()}
                    </td>
                    <td
                      className="max-w-[280px] truncate border-b px-3 py-1.5 text-left text-muted-foreground"
                      title={slice.remarks || ""}
                    >
                      {slice.remarks || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {/* Monthly summary row — solid emphasis, centered totals. */}
              <tr className="border-t-2 border-border bg-accent font-bold text-foreground">
                <td className="sticky left-0 z-20 border-r-2 border-t-2 border-border bg-accent px-3 py-2.5 text-left font-bold uppercase tracking-wide">
                  Total
                </td>
                {DETAIL_FIELDS.map((field) => (
                  <td
                    key={String(field.key)}
                    className="border-r border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums"
                  >
                    {(columnTotals[String(field.key)] ?? 0).toLocaleString()}
                  </td>
                ))}
                <td className="border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums">
                  {grandTotal.toLocaleString()}
                </td>
                <td className="border-t-2 border-border bg-accent px-3 py-2.5" aria-hidden />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

/** Route page — kept for deep-linking / bookmarks. */
export default function InventoryView() {
  const { stationno = "", year = "", month = "" } = useParams();
  const navigate = useNavigate();
  const m = Number(month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance — Daily Details</h1>
            <p className="text-sm text-muted-foreground">
              Read-only day-by-day breakdown for the selected station and month.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <InventoryViewBody
        stationno={stationno}
        year={Number(year)}
        initialMonth={m >= 1 && m <= 12 ? m : undefined}
      />
    </div>
  );
}

/** Modal wrapper — used from the FSIS Inventory ledger. */
export function InventoryViewModal({
  open,
  onOpenChange,
  stationno,
  year,
  month,
  stationName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stationno: string;
  year: number;
  /**
   * Optional — when provided, the Month dropdown defaults to this value;
   * otherwise the current calendar month is used per spec.
   */
  month?: number;
  stationName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Eye className="h-5 w-5 text-primary" /> Fire Safety Compliance — Daily Details
          </DialogTitle>
          <DialogDescription>
            {stationName ? `${stationName} · ` : ""}
            {year} — read-only day-by-day breakdown for the selected month.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
          {open ? (
            <InventoryViewBody stationno={stationno} year={year} initialMonth={month} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
