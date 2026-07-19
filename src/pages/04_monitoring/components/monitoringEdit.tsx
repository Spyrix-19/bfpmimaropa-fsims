import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Save, Table2 } from "lucide-react";
import { toast } from "sonner";
import { inventoryAPI } from "@/services/inventoryAPI";
import { unwrap } from "@/lib/api-envelope";
import { stationAPI } from "@/services/stationAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import { MONTHS } from "@/lib/fsims-constants";
import { calendarDaysInMonth, ALL_NUMERIC_FIELDS } from "@/lib/inventoryHelpers";
import { useAuth } from "@/lib/auth";

import type {
  DailyInventoryDTO,
  DailyInventoryUpsertDTO,
} from "@/types/inventoryType";

type Field = { key: keyof DailyInventoryDTO; label: string; group: string };
const FIELDS: Field[] = [
  { key: "insp_during", label: "During", group: "Inspection" },
  { key: "insp_after", label: "After", group: "Inspection" },
  { key: "insp_bplo", label: "BPLO", group: "Inspection" },
  { key: "insp_gov", label: "Gov", group: "Inspection" },
  { key: "insp_peza", label: "PEZA", group: "Inspection" },
  { key: "insp_tieza", label: "TIEZA", group: "Inspection" },
  { key: "fsec_building", label: "Building", group: "FSEC" },
  { key: "fsec_gov", label: "Gov", group: "FSEC" },
  { key: "fsec_peza", label: "PEZA", group: "FSEC" },
  { key: "fsec_tieza", label: "TIEZA", group: "FSEC" },
  { key: "fsic_occupancy", label: "Occupancy", group: "FSIC" },
  { key: "fsic_bplo_new", label: "BPLO New", group: "FSIC" },
  { key: "fsic_bplo_renewal", label: "BPLO Renew", group: "FSIC" },
  { key: "fsic_gov", label: "Gov", group: "FSIC" },
  { key: "fsic_peza", label: "PEZA", group: "FSIC" },
  { key: "fsic_tieza", label: "TIEZA", group: "FSIC" },
  { key: "not_nod", label: "NOD", group: "Notices" },
  { key: "not_ntc", label: "NTC", group: "Notices" },
  { key: "not_ntcv", label: "NTCV", group: "Notices" },
  { key: "not_abatement", label: "Avatement", group: "Notices" },
  { key: "not_closure", label: "Closure", group: "Notices" },
];

const GROUPS = [
  { label: "Inspection", tone: "bg-emerald-600 text-white", span: 6 },
  { label: "FSEC", tone: "bg-sky-600 text-white", span: 4 },
  { label: "FSIC", tone: "bg-indigo-600 text-white", span: 6 },
  { label: "Notices", tone: "bg-amber-600 text-white", span: 5 },
];

function pad2(n: number) { return n < 10 ? `0${n}` : String(n); }

function emptyRowFor(stationInfo: {
  stationno: string; stationcode: string; stationname: string;
  cityno: string; cityname: string; provinceno: string; provincename: string;
}, iso: string, encodedby: string, encodedbyname: string): DailyInventoryUpsertDTO {
  return {
    stationno: stationInfo.stationno,
    stationcode: stationInfo.stationcode,
    stationname: stationInfo.stationname,
    cityno: stationInfo.cityno,
    cityname: stationInfo.cityname,
    provinceno: stationInfo.provinceno,
    provincename: stationInfo.provincename,
    dateinspected: iso,
    insp_during: 0, insp_after: 0, insp_bplo: 0, insp_gov: 0, insp_peza: 0, insp_tieza: 0,
    fsec_building: 0, fsec_gov: 0, fsec_peza: 0, fsec_tieza: 0,
    fsic_occupancy: 0, fsic_bplo_new: 0, fsic_bplo_renewal: 0, fsic_gov: 0, fsic_peza: 0, fsic_tieza: 0,
    not_nod: 0, not_ntc: 0, not_ntcv: 0, not_abatement: 0, not_closure: 0,
    remarks: "",
    encodedby,
    encodedbyname,
  };
}

/** Shared editor body — used by the route page and the modal wrapper. */
function InventoryEditBody({
  stationno,
  year,
  month,
  onSaved,
  onCancel,
}: {
  stationno: string;
  year: number;
  month: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const daysInMonth = calendarDaysInMonth(year, month);

  const [rows, setRows] = React.useState<DailyInventoryUpsertDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await inventoryAPI.getMonthlyInventory(stationno, year, month);
      const { data } = unwrap<DailyInventoryDTO[]>(resp);
      const existing = new Map((data ?? []).map((r) => [r.dateinspected, r]));

      // Prefer station info from the loaded records; fall back to a live
      // Station API lookup when this month has no records yet.
      let seed: SearchStationModel | Partial<SearchStationModel> | undefined =
        (data ?? []).find((r) => r.stationno === stationno);
      if (!seed) {
        const sResp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
        const { data: sData } = unwrap<SearchStationModel[]>(sResp);
        seed = Array.isArray(sData) ? sData[0] : undefined;
      }
      const info = seed
        ? {
            stationno: seed.stationno ?? stationno,
            stationcode: seed.stationcode ?? "",
            stationname: seed.stationname ?? stationno,
            cityno: seed.cityno ?? "",
            cityname: seed.cityname ?? "",
            provinceno: seed.provinceno ?? "",
            provincename: seed.provincename ?? "",
          }
        : {
            stationno,
            stationcode: "",
            stationname: stationno,
            cityno: "",
            cityname: "",
            provinceno: "",
            provincename: "",
          };


      const built: DailyInventoryUpsertDTO[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = `${year}-${pad2(month)}-${pad2(d)}`;
        const hit = existing.get(iso);
        if (hit) {
          const { inventoryno: _n, lastupdated: _u, deletedat: _d, ...rest } = hit;
          built.push(rest);
        } else {
          built.push(
            emptyRowFor(info, iso, user?.memberno ?? "anon", user?.fullname ?? "Anonymous"),
          );
        }
      }
      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stationno, year, month, daysInMonth, user?.memberno, user?.fullname]);

  const updateCell = (idx: number, field: keyof DailyInventoryDTO, value: string) => {
    setRows((prev) => {
      const next = prev.slice();
      const num = value === "" ? 0 : Math.max(0, Number(value) || 0);
      (next[idx] as unknown as Record<string, unknown>)[field as string] =
        field === "remarks" ? value : num;
      return next;
    });
  };

  const rowTotal = (r: DailyInventoryUpsertDTO): number =>
    ALL_NUMERIC_FIELDS.reduce(
      (s, k) => s + (Number((r as unknown as Record<string, unknown>)[k as string] ?? 0) || 0),
      0,
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      const dirty = rows.filter((r) => rowTotal(r) > 0 || (r.remarks && r.remarks.length > 0));
      const resp = await inventoryAPI.updateMonthlyInventory(stationno, year, month, dirty);
      const { ok, error } = unwrap(resp);
      if (!ok) toast.error(error || "Unable to save monthly inventory.");
      else {
        toast.success(`Saved ${dirty.length} daily record${dirty.length === 1 ? "" : "s"}.`);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading month…
        </Card>
      ) : (
        <>

          <Card className="overflow-hidden border-border/60 shadow-soft">
            <div className="max-h-[65vh] overflow-auto">
              <table className="min-w-max border-separate border-spacing-0 text-[11px]">
                <thead className="sticky top-0 z-30">
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-40 min-w-[110px] border-b border-r bg-blue-700 px-3 py-2 text-left uppercase tracking-wider text-white"
                  >
                    Date
                  </th>
                  {GROUPS.map((g) => (
                    <th
                      key={g.label}
                      colSpan={g.span}
                      className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${g.tone}`}
                    >
                      {g.label}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="border-b border-r bg-slate-700 px-3 py-2 text-left uppercase tracking-wider text-white min-w-[180px]"
                  >
                    Remarks
                  </th>
                </tr>
                <tr>
                  {FIELDS.map((f) => (
                    <th
                      key={f.key}
                      className="border-b border-r bg-emerald-100 px-1.5 py-1 text-right text-[10px] font-bold uppercase text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
                    >
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const zebra = i % 2 === 1 ? "bg-muted/40" : "bg-card";
                  return (
                    <tr key={r.dateinspected} className={zebra}>
                      <td
                        className={`sticky left-0 z-10 border-b border-r px-3 py-1.5 font-semibold tabular-nums ${zebra}`}
                      >
                        {r.dateinspected}
                      </td>
                      {FIELDS.map((f) => (
                        <td key={f.key} className="border-b border-r p-0">
                          <Input
                            type="number"
                            min={0}
                            value={String(
                              (r as unknown as Record<string, unknown>)[f.key as string] ?? 0,
                            )}
                            onChange={(e) => updateCell(i, f.key, e.target.value)}
                            className="h-8 w-[70px] rounded-none border-0 bg-transparent text-right tabular-nums focus-visible:ring-1"
                          />
                        </td>
                      ))}
                      <td className="border-b border-r p-0">
                        <Input
                          type="text"
                          value={r.remarks ?? ""}
                          onChange={(e) => updateCell(i, "remarks", e.target.value)}
                          className="h-8 w-[220px] rounded-none border-0 bg-transparent focus-visible:ring-1"
                          placeholder="Notes…"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            Enter values per day. Empty rows are ignored; existing records are UPSERTed on save.
          </div>
        </Card>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={onCancel} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-elegant"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : "Save Month"}
          </Button>
        </div>
      </>
      )}
    </div>
  );
}

/** Route page — kept for deep-linking. */
export default function InventoryEdit() {
  const { stationno = "", year = "", month = "" } = useParams();
  const navigate = useNavigate();
  const y = Number(year), m = Number(month);
  const monthName = MONTHS.find((mo) => mo.value === m)?.name ?? m;
  const [seed, setSeed] = React.useState<SearchStationModel | null>(null);
  React.useEffect(() => {
    if (!stationno) return;
    let cancelled = false;
    (async () => {
      const resp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
      const { data } = unwrap<SearchStationModel[]>(resp);
      if (cancelled) return;
      setSeed(Array.isArray(data) && data[0] ? data[0] : null);
    })();
    return () => { cancelled = true; };
  }, [stationno]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Table2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Fire Safety Compliance Editor</h1>
            <p className="text-sm text-muted-foreground">
              {seed?.stationname ?? stationno} · {seed?.provincename ?? ""} — {monthName} {y}
            </p>
          </div>
        </div>
      </div>

      <InventoryEditBody
        stationno={stationno}
        year={y}
        month={m}
        onSaved={() => navigate("/monitoring")}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}

/** Modal wrapper — used from the FSIS Inventory ledger. */
export function InventoryEditModal({
  open,
  onOpenChange,
  stationno,
  year,
  month,
  stationName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stationno: string;
  year: number;
  month: number;
  stationName?: string;
  onSaved?: () => void;
}) {
  const monthName = MONTHS.find((mo) => mo.value === month)?.name ?? month;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[980px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">Fire Safety Compliance Editor</DialogTitle>
              <DialogDescription>
                {stationName ? `${stationName} · ` : ""}
                {monthName} {year} — Excel-style daily encoding.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
          {open ? (
            <InventoryEditBody
              stationno={stationno}
              year={year}
              month={month}
              onSaved={() => {
                onSaved?.();
                onOpenChange(false);
              }}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
