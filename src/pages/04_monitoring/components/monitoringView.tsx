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
  FSISInventoryMonthlyItem,
  FSISInventoryLedgerDailyItem,
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

/** Sum every Monthly-endpoint ledger daily item into a single per-field row.
 *  The keys mirror `DailyInventoryDTO` so the same DETAIL_FIELDS drive both
 *  the table columns and totals. */
function aggregateMonth(
  list: FSISInventoryLedgerDailyItem[] | undefined,
): Partial<Record<keyof DailyInventoryDTO, number>> {
  const acc: Record<string, number> = {};
  for (const l of list ?? []) {
    acc.insp_during = (acc.insp_during ?? 0) + (Number(l.inspectduringcount ?? 0) || 0);
    acc.insp_after = (acc.insp_after ?? 0) + (Number(l.inspectaftercount ?? 0) || 0);
    acc.insp_bplo = (acc.insp_bplo ?? 0) + (Number(l.inspectbplocount ?? 0) || 0);
    acc.insp_gov = (acc.insp_gov ?? 0) + (Number(l.inspectgovcount ?? 0) || 0);
    acc.insp_peza = (acc.insp_peza ?? 0) + (Number(l.inspectpezacount ?? 0) || 0);
    acc.insp_tieza = (acc.insp_tieza ?? 0) + (Number(l.inspecttiezacount ?? 0) || 0);
    acc.fsec_building = (acc.fsec_building ?? 0) + (Number(l.fsecbuildingcount ?? 0) || 0);
    acc.fsec_gov = (acc.fsec_gov ?? 0) + (Number(l.fsecgovcount ?? 0) || 0);
    acc.fsec_peza = (acc.fsec_peza ?? 0) + (Number(l.fsecpezacount ?? 0) || 0);
    acc.fsec_tieza = (acc.fsec_tieza ?? 0) + (Number(l.fsectiezacount ?? 0) || 0);
    acc.fsic_occupancy = (acc.fsic_occupancy ?? 0) + (Number(l.fsicoccupancycount ?? 0) || 0);
    acc.fsic_bplo_new = (acc.fsic_bplo_new ?? 0) + (Number(l.fsicbplonewcount ?? 0) || 0);
    acc.fsic_bplo_renewal =
      (acc.fsic_bplo_renewal ?? 0) + (Number(l.fsicbplorenewcount ?? 0) || 0);
    acc.fsic_gov = (acc.fsic_gov ?? 0) + (Number(l.fsicgovcount ?? 0) || 0);
    acc.fsic_peza = (acc.fsic_peza ?? 0) + (Number(l.fsicpezacount ?? 0) || 0);
    acc.fsic_tieza = (acc.fsic_tieza ?? 0) + (Number(l.fsictiezacount ?? 0) || 0);
    acc.not_nod = (acc.not_nod ?? 0) + (Number(l.nodcount ?? 0) || 0);
    acc.not_ntc = (acc.not_ntc ?? 0) + (Number(l.ntccount ?? 0) || 0);
    acc.not_ntcv = (acc.not_ntcv ?? 0) + (Number(l.ntcvcount ?? 0) || 0);
    acc.not_abatement = (acc.not_abatement ?? 0) + (Number(l.avatementcount ?? 0) || 0);
    acc.not_closure = (acc.not_closure ?? 0) + (Number(l.closurecount ?? 0) || 0);
  }
  return acc as Partial<Record<keyof DailyInventoryDTO, number>>;
}

interface MonthSlice {
  month: number;
  record: FSISInventoryMonthlyItem | null;
  totals: Partial<Record<keyof DailyInventoryDTO, number>>;
}

function toSummary(
  record: FSISInventoryMonthlyItem | null,
  year: number,
  month: number,
): TargetAccomplishmentModel | null {
  if (!record) return null;
  return {
    stationno: record.stationno,
    month: record.month ?? month,
    year: record.year ?? year,
    totaltargetbplo: Number(record.totaltargetbplo ?? 0) || 0,
    totaltargetgov: Number(record.totaltargetgov ?? 0) || 0,
    totaltargetpeza: Number(record.totaltargetpeza ?? 0) || 0,
    totaltargettieza: Number(record.totaltargettieza ?? 0) || 0,
    totalAccomplishmentbplo: Number(record.totalAccomplishmentbplo ?? 0) || 0,
    totalAccomplishmentgov: Number(record.totalAccomplishmentgov ?? 0) || 0,
    totalAccomplishmentpeza: Number(record.totalAccomplishmentpeza ?? 0) || 0,
    totalAccomplishmenttieza: Number(record.totalAccomplishmenttieza ?? 0) || 0,
  };
}

/**
 * Read-only yearly overview:
 *
 *  1. `Monthly Target vs. Inspected` summary — driven by a Month dropdown that
 *     defaults to the current calendar month. The Year is locked to the
 *     Ledger record and displayed as a read-only field.
 *  2. January–December table — every month rendered as its own row so months
 *     without data still appear (with zero values), giving a complete
 *     yearly overview.
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
  const [slices, setSlices] = React.useState<MonthSlice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedMonth, setSelectedMonth] = React.useState<number>(() => {
    if (initialMonth && initialMonth >= 1 && initialMonth <= 12) return initialMonth;
    return new Date().getMonth() + 1;
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Resolve provinceno — Monthly endpoint requires it.
      const sResp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seedStation = Array.isArray(sData) ? sData[0] : undefined;
      const provinceno = seedStation?.provinceno ?? EMPTY_GUID;

      // Fire all 12 months in parallel — every month must be present in the
      // yearly table even when the server returns no record.
      const responses = await Promise.all(
        MONTHS.map((m) =>
          targetinventoryAPI.getMonthly(
            {
              Stationno: stationno || EMPTY_GUID,
              Provinceno: provinceno,
              Reportyear: year,
              Reportmonth: m.value,
            },
            { suppressGlobalLoading: true },
          ),
        ),
      );
      if (cancelled) return;

      let firstError: string | null = null;
      const built: MonthSlice[] = responses.map((resp, index) => {
        const { ok, data, error } = unwrap<FSISInventoryMonthlyItem[]>(resp);
        if (!ok && !firstError) firstError = error || null;
        const record = ok && Array.isArray(data) ? data[0] ?? null : null;
        return {
          month: MONTHS[index].value,
          record,
          totals: aggregateMonth(record?.fsisInventoryLedgerList),
        };
      });

      if (firstError) toast.error(firstError);
      setSlices(built);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year]);

  const currentSlice = slices.find((s) => s.month === selectedMonth) ?? null;
  const summary = currentSlice ? toSummary(currentSlice.record, year, selectedMonth) : null;

  const columnTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    for (const field of DETAIL_FIELDS) {
      totals[String(field.key)] = slices.reduce(
        (sum, s) => sum + (Number(s.totals[field.key as keyof DailyInventoryDTO]) || 0),
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

      {/* 2. January–December yearly overview. */}
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="max-h-[65vh] overflow-auto">
          <table className="min-w-max border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 min-w-[120px] border-b border-r bg-blue-700 px-3 py-2 text-left uppercase tracking-wider text-white"
                >
                  Month
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
                  className="border-b border-r bg-slate-700 px-3 py-2 text-right uppercase tracking-wider text-white min-w-[80px]"
                >
                  TOTAL
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
                  (sum, f) =>
                    sum + (Number(slice.totals[f.key as keyof DailyInventoryDTO]) || 0),
                  0,
                );
                const zebra = index % 2 === 1 ? "bg-muted/40" : "bg-card";
                return (
                  <tr key={slice.month} className={zebra}>
                    <td
                      className={`sticky left-0 z-10 border-b border-r px-3 py-1.5 font-semibold ${zebra}`}
                    >
                      {MONTHS[slice.month - 1].name}
                    </td>
                    {DETAIL_FIELDS.map((field) => {
                      const v =
                        Number(slice.totals[field.key as keyof DailyInventoryDTO]) || 0;
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
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                <td className="sticky left-0 z-10 border-r bg-muted/60 px-3 py-2">
                  Total
                </td>
                {DETAIL_FIELDS.map((field) => (
                  <td
                    key={String(field.key)}
                    className="border-r px-3 py-2 text-right tabular-nums"
                  >
                    {(columnTotals[String(field.key)] ?? 0).toLocaleString()}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">
                  {grandTotal.toLocaleString()}
                </td>
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
            <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance — Yearly Details</h1>
            <p className="text-sm text-muted-foreground">
              Read-only breakdown for the selected station and year.
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
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Fire Safety Compliance — Yearly Details
          </DialogTitle>
          <DialogDescription>
            {stationName ? `${stationName} · ` : ""}
            {year} — read-only yearly overview (January to December).
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <InventoryViewBody stationno={stationno} year={year} initialMonth={month} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
