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

import { inventoryAPI } from "@/services/inventoryAPI";
import { unwrap } from "@/lib/api-envelope";
import { MONTHS } from "@/lib/fsims-constants";
import {
  bucketFor,
  breakdownFor,
  calendarDaysInMonth,
  CATEGORY_FIELDS,
  daysEncoded,
  fsecTotal,
  fsicTotal,
  inspectionTotal,
  noticesTotal,
} from "@/lib/inventoryHelpers";
import type { DailyInventoryDTO } from "@/types/inventoryType";

const CATEGORY_ORDER = ["INSPECTION", "FSEC", "FSIC", "NOTICES"] as const;
const FIELD_GROUPS = CATEGORY_ORDER.map((category) => ({
  category,
  fields: CATEGORY_FIELDS[category],
}));
const DETAIL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

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
  const [rows, setRows] = React.useState<DailyInventoryDTO[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await inventoryAPI.getMonthlyInventory(stationno, year, month);
      const { ok, data, error } = unwrap<DailyInventoryDTO[]>(resp);
      if (cancelled) return;
      if (!ok) toast.error(error || "Unable to load monthly inventory.");
      setRows(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month]);

  
  const totals = bucketFor(rows);
  const breakdown = breakdownFor(rows);
  const encoded = daysEncoded(rows);
  const daysTotal = calendarDaysInMonth(year, month);
  const fieldTotals = React.useMemo(() => {
    const totals: Record<string, number> = {};
    DETAIL_FIELDS.forEach((field) => {
      totals[String(field.key)] = rows.reduce(
        (sum, r) => sum + (Number(r[field.key as keyof DailyInventoryDTO]) || 0),
        0,
      );
    });
    return totals;
  }, [rows]);
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;

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
          <MetaField
            label="Last Updated"
            value={
              rows[0]
                ? new Date(
                    rows.map((r) => r.lastupdated).sort().slice(-1)[0],
                  ).toLocaleString()
                : "—"
            }
          />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Inspection" value={inspectionTotal(rows)} />
        <SummaryTile label="FSEC" value={fsecTotal(rows)} tone="primary" />
        <SummaryTile label="FSIC" value={fsicTotal(rows)} tone="success" />
        <SummaryTile label="Notices" value={noticesTotal(rows)} tone="warning" />
      </div>

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
                        {(Number(r[field.key as keyof DailyInventoryDTO]) || 0).toLocaleString()}
                      </td>
                    ))}
                    <td className="border-b px-3 py-1.5 text-right tabular-nums">
                      {DETAIL_FIELDS.reduce(
                        (sum, field) => sum + (Number(r[field.key as keyof DailyInventoryDTO]) || 0),
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
                            (rowSum, field) => rowSum + (Number(r[field.key as keyof DailyInventoryDTO]) || 0),
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

function SummaryTile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "primary" | "success" | "warning";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";
  return (
    <Card className="border-border/60 p-4 shadow-soft">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums tracking-tight ${toneCls}`}>
        {value.toLocaleString()}
      </div>
    </Card>
  );
}
