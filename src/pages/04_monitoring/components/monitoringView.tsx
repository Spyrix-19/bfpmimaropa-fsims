import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  CATEGORY_FIELDS,
  calendarDaysInMonth,
} from "@/lib/inventoryHelpers";
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

/** Map a Monthly ledger daily item -> the DailyInventoryDTO field keys the
 *  read-only table already renders. Server field names differ from the daily
 *  inventory endpoint, so translate rather than reshape the UI. */
function ledgerToRow(
  ledger: FSISInventoryLedgerDailyItem,
): Partial<DailyInventoryDTO> & { dateinspected: string; inventoryno: string } {
  const iso = (ledger.dateinspected ?? "").slice(0, 10);
  return {
    inventoryno: ledger.fsisno,
    dateinspected: iso,
    insp_during: Number(ledger.inspectduringcount ?? 0) || 0,
    insp_after: Number(ledger.inspectaftercount ?? 0) || 0,
    insp_bplo: Number(ledger.inspectbplocount ?? 0) || 0,
    insp_gov: Number(ledger.inspectgovcount ?? 0) || 0,
    insp_peza: Number(ledger.inspectpezacount ?? 0) || 0,
    insp_tieza: Number(ledger.inspecttiezacount ?? 0) || 0,
    fsec_building: Number(ledger.fsecbuildingcount ?? 0) || 0,
    fsec_gov: Number(ledger.fsecgovcount ?? 0) || 0,
    fsec_peza: Number(ledger.fsecpezacount ?? 0) || 0,
    fsec_tieza: Number(ledger.fsectiezacount ?? 0) || 0,
    fsic_occupancy: Number(ledger.fsicoccupancycount ?? 0) || 0,
    fsic_bplo_new: Number(ledger.fsicbplonewcount ?? 0) || 0,
    fsic_bplo_renewal: Number(ledger.fsicbplorenewcount ?? 0) || 0,
    fsic_gov: Number(ledger.fsicgovcount ?? 0) || 0,
    fsic_peza: Number(ledger.fsicpezacount ?? 0) || 0,
    fsic_tieza: Number(ledger.fsictiezacount ?? 0) || 0,
    not_nod: Number(ledger.nodcount ?? 0) || 0,
    not_ntc: Number(ledger.ntccount ?? 0) || 0,
    not_ntcv: Number(ledger.ntcvcount ?? 0) || 0,
    not_abatement: Number(ledger.avatementcount ?? 0) || 0,
    not_closure: Number(ledger.closurecount ?? 0) || 0,
    remarks: ledger.remarks ?? "",
  };
}

/**
 * Read-only monthly breakdown body — used both by the route page and by
 * the modal wrapper. All chrome (headline / back button / dialog frame) is
 * supplied by the caller.
 */
function InventoryViewBody({
  stationno,
  year,
  month,
}: {
  stationno: string;
  year: number;
  month: number;
}) {
  const [monthly, setMonthly] = React.useState<FSISInventoryMonthlyItem | null>(null);
  const [rows, setRows] = React.useState<Array<Partial<DailyInventoryDTO> & { dateinspected: string; inventoryno: string }>>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Resolve provinceno — Monthly endpoint requires it.
      const sResp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seedStation = Array.isArray(sData) ? sData[0] : undefined;

      const resp = await targetinventoryAPI.getMonthly({
        Stationno: stationno || EMPTY_GUID,
        Provinceno: seedStation?.provinceno ?? EMPTY_GUID,
        Reportyear: year,
        Reportmonth: month,
      });
      const { ok, data, error } = unwrap<FSISInventoryMonthlyItem[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load monthly monitoring record.");

      const record = Array.isArray(data) ? data[0] ?? null : null;
      const list = record?.fsisInventoryLedgerList ?? [];
      const mapped = list
        .map(ledgerToRow)
        .filter((r) => r.dateinspected)
        .sort((a, b) => a.dateinspected.localeCompare(b.dateinspected));

      setMonthly(record);
      setRows(mapped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month]);

  const encoded = rows.length;
  const daysTotal = calendarDaysInMonth(year, month);
  const fieldTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    DETAIL_FIELDS.forEach((field) => {
      totals[String(field.key)] = rows.reduce(
        (sum, r) => sum + (Number((r as Record<string, unknown>)[field.key as string]) || 0),
        0,
      );
    });
    return totals;
  }, [rows]);
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;

  const summaryData = React.useMemo<TargetAccomplishmentModel | null>(() => {
    if (!monthly) return null;
    return {
      stationno: monthly.stationno,
      month: monthly.month ?? month,
      year: monthly.year ?? year,
      totaltargetbplo: Number(monthly.totaltargetbplo ?? 0) || 0,
      totaltargetgov: Number(monthly.totaltargetgov ?? 0) || 0,
      totaltargetpeza: Number(monthly.totaltargetpeza ?? 0) || 0,
      totaltargettieza: Number(monthly.totaltargettieza ?? 0) || 0,
      totalAccomplishmentbplo: Number(monthly.totalAccomplishmentbplo ?? 0) || 0,
      totalAccomplishmentgov: Number(monthly.totalAccomplishmentgov ?? 0) || 0,
      totalAccomplishmentpeza: Number(monthly.totalAccomplishmentpeza ?? 0) || 0,
      totalAccomplishmenttieza: Number(monthly.totalAccomplishmenttieza ?? 0) || 0,
    };
  }, [monthly, month, year]);

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/60 p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <MetaField label="Period" value={`${monthName} ${year}`} />
          <MetaField label="Days Encoded" value={`${encoded} / ${daysTotal}`} />
        </div>
      </Card>

      <TargetAccomplishmentPanel
        stationno={stationno}
        year={year}
        month={month}
        data={summaryData}
      />

      <Card className="overflow-hidden border-border/60 shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-max border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30 bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-40 min-w-[110px] border-b border-r bg-blue-700 px-3 py-2 text-left text-white"
                >
                  Date
                </th>
                {FIELD_GROUPS.map((group) => (
                  <th
                    key={group.category}
                    colSpan={group.fields.length}
                    className="border-b border-r px-2 py-2 text-center font-semibold"
                  >
                    {group.category}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-b border-r bg-slate-700 px-3 py-2 text-left text-white"
                >
                  TOTAL
                </th>
              </tr>
              <tr>
                {DETAIL_FIELDS.map((field) => (
                  <th
                    key={String(field.key)}
                    className="border-b border-r bg-emerald-100 px-1.5 py-1 text-right text-[10px] font-bold uppercase text-emerald-900"
                  >
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={DETAIL_FIELDS.length + 2} className="px-3 py-10 text-center text-muted-foreground">
                    No daily records encoded for this month.
                  </td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <tr key={r.inventoryno} className={index % 2 === 1 ? "bg-muted/40" : "bg-card"}>
                    <td className="sticky left-0 z-10 border-b border-r px-3 py-1.5 font-semibold bg-card tabular-nums">
                      {r.dateinspected}
                    </td>
                    {DETAIL_FIELDS.map((field) => (
                      <td key={String(field.key)} className="border-b border-r px-3 py-1.5 text-right tabular-nums">
                        {(Number((r as Record<string, unknown>)[field.key as string]) || 0).toLocaleString()}
                      </td>
                    ))}
                    <td className="border-b px-3 py-1.5 text-right tabular-nums">
                      {DETAIL_FIELDS.reduce(
                        (sum, field) => sum + (Number((r as Record<string, unknown>)[field.key as string]) || 0),
                        0,
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-semibold">
                  <td className="border-r px-3 py-2">Total</td>
                  {DETAIL_FIELDS.map((field) => (
                    <td key={String(field.key)} className="border-r px-3 py-2 text-right tabular-nums">
                      {fieldTotals[String(field.key)]?.toLocaleString() ?? "0"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums">
                    {rows
                      .reduce(
                        (sum, r) =>
                          sum +
                          DETAIL_FIELDS.reduce(
                            (rowSum, field) =>
                              rowSum + (Number((r as Record<string, unknown>)[field.key as string]) || 0),
                            0,
                          ),
                        0,
                      )
                      .toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Eye className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory — Monthly Details</h1>
            <p className="text-sm text-muted-foreground">
              Read-only breakdown of daily FSIS accomplishments.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <InventoryViewBody stationno={stationno} year={Number(year)} month={Number(month)} />
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
  month: number;
  stationName?: string;
}) {
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" /> Inventory — Monthly Details
          </DialogTitle>
          <DialogDescription>
            {stationName ? `${stationName} · ` : ""}
            {monthName} {year} — read-only breakdown of daily FSIS accomplishments.
          </DialogDescription>
        </DialogHeader>
        {open ? <InventoryViewBody stationno={stationno} year={year} month={month} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px]">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
