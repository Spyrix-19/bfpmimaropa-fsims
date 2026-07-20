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
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { stationAPI } from "@/services/stationAPI";
import { targetinventoryAPI } from "@/services/targetinventoryAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import { MONTHS } from "@/lib/fsims-constants";
import { useAuth } from "@/lib/auth";
import TargetAccomplishmentPanel from "./TargetAccomplishmentPanel";
import GentableSearchSelect from "@/components/gentable-search-select";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { isReportMonthLocked } from "@/pages/05_target-reference/helpers";
import { FSIS_ISSUANCE_TABLE } from "./issuanceMode";

import type {
  DailyInventoryDTO,
  DailyInventoryUpsertDTO,
} from "@/types/inventoryType";
import type {
  FSISInventoryMonthlyItem,
  FSISInventoryLedgerDailyItem,
  TargetAccomplishmentModel,
} from "@/types/targetinventoryType";
import type { FSISUpdateInventoryDTO } from "@/types/targetinventoryType";

type FieldKey = keyof Pick<
  DailyInventoryDTO,
  | "insp_during"
  | "insp_after"
  | "insp_bplo"
  | "insp_gov"
  | "insp_peza"
  | "insp_tieza"
  | "fsec_building"
  | "fsec_gov"
  | "fsec_peza"
  | "fsec_tieza"
  | "fsic_occupancy"
  | "fsic_bplo_new"
  | "fsic_bplo_renewal"
  | "fsic_gov"
  | "fsic_peza"
  | "fsic_tieza"
  | "not_nod"
  | "not_ntc"
  | "not_ntcv"
  | "not_abatement"
  | "not_closure"
>;

type Field = { key: FieldKey; label: string; group: string };
const FIELDS: Field[] = [
  { key: "insp_during", label: "During", group: "Inspection" },
  { key: "insp_after", label: "After", group: "Inspection" },
  { key: "insp_bplo", label: "1st BPLO", group: "Inspection" },
  { key: "insp_gov", label: "1st GOV", group: "Inspection" },
  { key: "insp_peza", label: "1st PEZA", group: "Inspection" },
  { key: "insp_tieza", label: "1st TIEZA", group: "Inspection" },
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

/** Group -> whether it is gated by the row's Mode of Issuance. */
function isGatedGroup(group: string): boolean {
  return group === "FSEC" || group === "FSIC" || group === "Notices";
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

type MonthRow = Record<FieldKey, number> & { remarks: string; fsicmode: number };

function emptyMonthRow(): MonthRow {
  const base = {} as Record<FieldKey, number>;
  for (const f of FIELDS) base[f.key] = 0;
  return { ...base, remarks: "", fsicmode: 0 };
}

/** Aggregate a Monthly-endpoint ledger daily list into one editable row.
 *
 *  API shape (see /FSISInventory/Monthly):
 *    fsisInventoryLedgerList[] -> per-day row carrying `inspect*count` + `remarks`
 *      .issuancelist[]         -> per-issuance row carrying fsicmode + FSEC/FSIC/Notices counts
 *
 *  We sum inspection counts across daily rows, and FSEC/FSIC/Notices counts
 *  across every nested issuance row. fsicmode is seeded from the first
 *  issuance found (all issuances for a month share the same mode in practice). */
function ledgerToMonthRow(list: FSISInventoryLedgerDailyItem[] | undefined): MonthRow {
  const row = emptyMonthRow();
  if (!list || list.length === 0) return row;
  let firstMode = 0;
  for (const l of list) {
    row.insp_during += Number(l.inspectduringcount ?? 0) || 0;
    row.insp_after += Number(l.inspectaftercount ?? 0) || 0;
    row.insp_bplo += Number(l.inspectbplocount ?? 0) || 0;
    row.insp_gov += Number(l.inspectgovcount ?? 0) || 0;
    row.insp_peza += Number(l.inspectpezacount ?? 0) || 0;
    row.insp_tieza += Number(l.inspecttiezacount ?? 0) || 0;

    const issuances = Array.isArray(l.issuancelist) ? l.issuancelist : [];
    // Fallback: if API returns issuance counts flat on the daily row (older
    // shape / mocks), treat the daily row itself as a single issuance.
    const source = issuances.length > 0 ? issuances : [l as unknown as typeof issuances[number]];
    for (const iss of source) {
      row.fsec_building += Number(iss.fsecbuildingcount ?? 0) || 0;
      row.fsec_gov += Number(iss.fsecgovcount ?? 0) || 0;
      row.fsec_peza += Number(iss.fsecpezacount ?? 0) || 0;
      row.fsec_tieza += Number(iss.fsectiezacount ?? 0) || 0;
      row.fsic_occupancy += Number(iss.fsicoccupancycount ?? 0) || 0;
      row.fsic_bplo_new += Number(iss.fsicbplonewcount ?? 0) || 0;
      row.fsic_bplo_renewal += Number(iss.fsicbplorenewcount ?? 0) || 0;
      row.fsic_gov += Number(iss.fsicgovcount ?? 0) || 0;
      row.fsic_peza += Number(iss.fsicpezacount ?? 0) || 0;
      row.fsic_tieza += Number(iss.fsictiezacount ?? 0) || 0;
      row.not_nod += Number(iss.nodcount ?? 0) || 0;
      row.not_ntc += Number(iss.ntccount ?? 0) || 0;
      row.not_ntcv += Number(iss.ntcvcount ?? 0) || 0;
      row.not_abatement += Number(iss.avatementcount ?? 0) || 0;
      row.not_closure += Number(iss.closurecount ?? 0) || 0;
      if (!firstMode) firstMode = Number(iss.fsicmode ?? 0) || 0;
    }
  }
  // Prefer the most recent non-empty remarks as the aggregated month remark.
  const withRemarks = list.filter((l) => (l.remarks ?? "").trim().length > 0);
  row.remarks = withRemarks.length > 0 ? withRemarks[withRemarks.length - 1].remarks : "";
  row.fsicmode = firstMode || Number((list[0] as { fsicmode?: number })?.fsicmode ?? 0) || 0;
  return row;
}


function rowsEqual(a: MonthRow, b: MonthRow): boolean {
  if ((a.remarks ?? "") !== (b.remarks ?? "")) return false;
  if ((a.fsicmode ?? 0) !== (b.fsicmode ?? 0)) return false;
  for (const f of FIELDS) if (a[f.key] !== b[f.key]) return false;
  return true;
}

function computeAccomplishmentForRow(r: MonthRow) {
  const bplo = r.insp_bplo + r.fsic_bplo_new + r.fsic_bplo_renewal;
  const gov = r.insp_gov + r.fsec_gov + r.fsic_gov;
  const peza = r.insp_peza + r.fsec_peza + r.fsic_peza;
  const tieza = r.insp_tieza + r.fsec_tieza + r.fsic_tieza;
  return { bplo, gov, peza, tieza };
}

/**
 * Editor body — restores the original tabular layout:
 *
 *  1. `Monthly Target vs. Inspected` summary fixed to the selected record's
 *     year and month (no month/year selectors).
 *  2. January–December editable table with one row per month. The yearly
 *     total is rendered below the December row.
 */
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
  const selectedMonthLocked = React.useMemo(
    () => isReportMonthLocked(Number(year), Number(month)),
    [year, month],
  );
  const isRowLocked = React.useCallback(
    (mv: number) => isReportMonthLocked(Number(year), Number(mv)),
    [year],
  );

  const [rows, setRows] = React.useState<Record<number, MonthRow>>(() => {
    const init: Record<number, MonthRow> = {};
    for (const m of MONTHS) init[m.value] = emptyMonthRow();
    return init;
  });
  const [initialRows, setInitialRows] = React.useState<Record<number, MonthRow>>(() => {
    const init: Record<number, MonthRow> = {};
    for (const m of MONTHS) init[m.value] = emptyMonthRow();
    return init;
  });
  const [monthlySelected, setMonthlySelected] = React.useState<FSISInventoryMonthlyItem | null>(
    null,
  );
  const [monthlyRecords, setMonthlyRecords] = React.useState<Record<number, FSISInventoryMonthlyItem | null>>(
    () => {
      const init: Record<number, FSISInventoryMonthlyItem | null> = {};
      for (const m of MONTHS) init[m.value] = null;
      return init;
    },
  );
  const [stationInfo, setStationInfo] = React.useState<Partial<SearchStationModel> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Per-row Mode of Issuance display name (looked up from GentableSearchSelect).
  // Values are stored in each row's `fsicmode`. Names are UI-only and are
  // seeded lazily by the picker's onChange.
  const [modeNames, setModeNames] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Resolve station/province context first — Monthly endpoint requires
      // Provinceno and the saved rows need full station identity.
      const sResp = await stationAPI.search({ pageNumber: 1, pageSize: 1, searchKey: stationno });
      const { data: sData } = unwrap<SearchStationModel[]>(sResp);
      const seedStation = Array.isArray(sData) ? sData[0] : undefined;
      const provinceno = seedStation?.provinceno ?? EMPTY_GUID;

      // Fetch every month in parallel — the yearly table is always fully
      // populated, even for months with no server-side record.
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

      const built: Record<number, MonthRow> = {};
      const records: Record<number, FSISInventoryMonthlyItem | null> = {};
      let selected: FSISInventoryMonthlyItem | null = null;
      let firstError: string | null = null;
      responses.forEach((resp, index) => {
        const monthValue = MONTHS[index].value;
        const { ok, data, error } = unwrap<FSISInventoryMonthlyItem[]>(resp);
        if (!ok && !firstError) firstError = error || null;
        const record = ok && Array.isArray(data) ? data[0] ?? null : null;
        built[monthValue] = ledgerToMonthRow(record?.fsisInventoryLedgerList);
        records[monthValue] = record;
        if (monthValue === month && record) selected = record;
      });
      if (firstError) toast.error(firstError);

      setStationInfo(seedStation ?? null);
      setRows(built);
      // Deep-copy the initial snapshot so change detection is reliable.
      const snap: Record<number, MonthRow> = {};
      for (const m of MONTHS) snap[m.value] = { ...built[m.value] };
      setInitialRows(snap);
      setMonthlySelected(selected);
      setMonthlyRecords(records);

      // No global mode seeding needed — each row carries its own fsicmode
      // via `ledgerToMonthRow` above.
      setModeNames({});

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [stationno, year, month]);

  const updateCell = (monthValue: number, field: FieldKey | "remarks", value: string) => {
    if (isRowLocked(monthValue)) return;
    setRows((prev) => {
      const cur = prev[monthValue] ?? emptyMonthRow();
      let next: MonthRow;
      if (field === "remarks") {
        next = { ...cur, remarks: value };
      } else {
        const num = value === "" ? 0 : Math.max(0, Number(value) || 0);
        next = { ...cur, [field]: num } as MonthRow;
      }
      return { ...prev, [monthValue]: next };
    });
  };

  const updateRowMode = (monthValue: number, detno: string, name: string) => {
    if (isRowLocked(monthValue)) return;
    const modeNo = Number(detno) || 0;
    setRows((prev) => {
      const cur = prev[monthValue] ?? emptyMonthRow();
      const next: MonthRow = { ...cur, fsicmode: modeNo };
      // When mode is cleared, zero the gated (FSEC/FSIC/Notices) fields for
      // this row — matches the Add page rule where those inputs are disabled
      // (and thus effectively zero) until a mode is picked.
      if (!modeNo) {
        for (const f of FIELDS) if (isGatedGroup(f.group)) next[f.key] = 0;
      }
      return { ...prev, [monthValue]: next };
    });
    setModeNames((prev) => ({ ...prev, [monthValue]: name }));
  };

  const columnTotals = React.useMemo(() => {
    const totals = {} as Record<FieldKey, number>;
    for (const f of FIELDS) totals[f.key] = 0;
    for (const m of MONTHS) {
      const r = rows[m.value];
      if (!r) continue;
      for (const f of FIELDS) totals[f.key] += Number(r[f.key]) || 0;
    }
    return totals;
  }, [rows]);

  const grandTotal = React.useMemo(
    () => Object.values(columnTotals).reduce((a, b) => a + b, 0),
    [columnTotals],
  );

  // Live summary — targets stay pinned to the server's Monthly response for
  // the selected month while accomplishments recompute from that month's
  // in-progress edits.
  const summaryData = React.useMemo<TargetAccomplishmentModel | null>(() => {
    if (!monthlySelected) return null;
    const live = computeAccomplishmentForRow(rows[month] ?? emptyMonthRow());
    return {
      stationno: monthlySelected.stationno,
      month: monthlySelected.month ?? month,
      year: monthlySelected.year ?? year,
      totaltargetbplo: Number(monthlySelected.totaltargetbplo ?? 0) || 0,
      totaltargetgov: Number(monthlySelected.totaltargetgov ?? 0) || 0,
      totaltargetpeza: Number(monthlySelected.totaltargetpeza ?? 0) || 0,
      totaltargettieza: Number(monthlySelected.totaltargettieza ?? 0) || 0,
      totalAccomplishmentbplo: live.bplo,
      totalAccomplishmentgov: live.gov,
      totalAccomplishmentpeza: live.peza,
      totalAccomplishmenttieza: live.tieza,
    };
  }, [monthlySelected, rows, month, year]);

  const buildDto = (monthValue: number, r: MonthRow): DailyInventoryUpsertDTO => {
    const iso = `${year}-${pad2(monthValue)}-01`;
    return {
      stationno,
      stationcode: stationInfo?.stationcode ?? "",
      stationname: stationInfo?.stationname ?? stationno,
      cityno: stationInfo?.cityno ?? "",
      cityname: stationInfo?.cityname ?? "",
      provinceno: stationInfo?.provinceno ?? "",
      provincename: stationInfo?.provincename ?? "",
      dateinspected: iso,
      insp_during: r.insp_during,
      insp_after: r.insp_after,
      insp_bplo: r.insp_bplo,
      insp_gov: r.insp_gov,
      insp_peza: r.insp_peza,
      insp_tieza: r.insp_tieza,
      fsec_building: r.fsec_building,
      fsec_gov: r.fsec_gov,
      fsec_peza: r.fsec_peza,
      fsec_tieza: r.fsec_tieza,
      fsic_occupancy: r.fsic_occupancy,
      fsic_bplo_new: r.fsic_bplo_new,
      fsic_bplo_renewal: r.fsic_bplo_renewal,
      fsic_gov: r.fsic_gov,
      fsic_peza: r.fsic_peza,
      fsic_tieza: r.fsic_tieza,
      not_nod: r.not_nod,
      not_ntc: r.not_ntc,
      not_ntcv: r.not_ntcv,
      not_abatement: r.not_abatement,
      not_closure: r.not_closure,
      remarks: r.remarks,
      encodedby: user?.memberno ?? "anon",
      encodedbyname: user?.fullname ?? "Anonymous",
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = MONTHS.filter(
        (m) =>
          !isRowLocked(m.value) &&
          !rowsEqual(rows[m.value], initialRows[m.value] ?? emptyMonthRow()),
      );
      if (changed.length === 0) {
        toast.info("No changes to save.");
        return;
      }
      const payload: FSISUpdateInventoryDTO = {
        stationno,
        updatedby: user?.memberno ?? "anon",
        encodedby: user?.memberno ?? "anon",
        fsisUpdateInventoryList: changed.map((m) => {
          const r = rows[m.value];
          const existing = monthlyRecords[m.value]?.fsisInventoryLedgerList?.[0];
          const modeNo = Number(r.fsicmode);
          return {
            fsisno: existing?.fsisno ?? EMPTY_GUID,
            dateinspected: existing?.dateinspected ?? `${year}-${pad2(m.value)}-01`,
            inspectduringcount: r.insp_during,
            inspectaftercount: r.insp_after,
            inspectbplocount: r.insp_bplo,
            inspectgovcount: r.insp_gov,
            inspectpezacount: r.insp_peza,
            inspecttiezacount: r.insp_tieza,
            fsicmode: Number.isFinite(modeNo) && modeNo > 0
              ? modeNo
              : Number(existing?.fsicmode ?? 0) || 0,
            fsecbuildingcount: r.fsec_building,
            fsecgovcount: r.fsec_gov,
            fsecpezacount: r.fsec_peza,
            fsectiezacount: r.fsec_tieza,
            fsicoccupancycount: r.fsic_occupancy,
            fsicbplonewcount: r.fsic_bplo_new,
            fsicbplorenewcount: r.fsic_bplo_renewal,
            fsicgovcount: r.fsic_gov,
            fsicpezacount: r.fsic_peza,
            fsictiezacount: r.fsic_tieza,
            nodcount: r.not_nod,
            ntccount: r.not_ntc,
            ntcvcount: r.not_ntcv,
            avatementcount: r.not_abatement,
            closurecount: r.not_closure,
            remarks: r.remarks,
          };
        }),
      };
      const resp = await targetinventoryAPI.update(payload);
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Failed to save changes.");
      } else {
        toast.success(`Saved ${changed.length} month${changed.length === 1 ? "" : "s"}.`);
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </Card>
      ) : (
        <>
          {selectedMonthLocked && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This reporting month is already completed and cannot be edited. Records are shown for reference only.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <TargetAccomplishmentPanel
              stationno={stationno}
              year={year}
              month={month}
              data={summaryData}
            />
            <p className="text-xs text-muted-foreground">
              Displays the Monthly Target vs. Inspected summary for the selected reporting
              month. The values below represent the annual Fire Safety Compliance record for
              the selected year.
            </p>
          </div>

          <Card className="overflow-hidden border-border/60 shadow-soft">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="min-w-max border-separate border-spacing-0 text-[11px]">
                <thead>
                  {/* HR1 — macro grouping: Daily Inspection / Daily Issuance */}
                  <tr>
                    <th
                      rowSpan={3}
                      className="sticky left-0 z-40 min-w-[120px] border-b border-r bg-blue-700 px-3 py-2 text-left uppercase tracking-wider text-white"
                    >
                      Month
                    </th>
                    <th
                      colSpan={6}
                      className="border-b border-r bg-emerald-800 px-2 py-2 text-center uppercase tracking-wider text-white"
                    >
                      Daily Inspection Activities
                    </th>
                    <th
                      colSpan={1 + 4 + 6 + 5}
                      className="border-b border-r bg-indigo-800 px-2 py-2 text-center uppercase tracking-wider text-white"
                    >
                      Daily Issuance Activities
                    </th>
                    <th
                      rowSpan={3}
                      className="border-b border-r bg-slate-700 px-3 py-2 text-left uppercase tracking-wider text-white min-w-[180px]"
                    >
                      Remarks
                    </th>
                  </tr>
                  {/* HR2 — category banners; Mode column spans HR2+HR3 */}
                  <tr>
                    {GROUPS.map((g, gi) => {
                      if (g.label === "FSEC") {
                        // Insert the Mode of Issuance column banner just before FSEC.
                        return (
                          <React.Fragment key={g.label}>
                            <th
                              rowSpan={2}
                              className="border-b border-r bg-fuchsia-700 px-2 py-2 text-center uppercase tracking-wider text-white min-w-[200px]"
                            >
                              Mode of Issuance
                            </th>
                            <th
                              colSpan={g.span}
                              className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${g.tone}`}
                            >
                              {g.label}
                            </th>
                          </React.Fragment>
                        );
                      }
                      return (
                        <th
                          key={g.label}
                          colSpan={g.span}
                          className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${g.tone}`}
                        >
                          {g.label}
                        </th>
                      );
                    })}
                  </tr>
                  {/* HR3 — field labels */}
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
                  {MONTHS.map((m, i) => {
                    // Solid (non-transparent) zebra so the sticky Month
                    // column never lets scrolling columns bleed through.
                    const zebra = i % 2 === 1 ? "bg-muted" : "bg-card";
                    const r = rows[m.value] ?? emptyMonthRow();
                    const rowLocked = isRowLocked(m.value);
                    const gatedDisabled = rowLocked || !r.fsicmode;
                    return (
                      <tr key={m.value} className={zebra}>
                        <td
                          className={`sticky left-0 z-20 border-b border-r px-3 py-1.5 font-semibold ${zebra}`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            {rowLocked ? (
                              <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            ) : null}
                            {m.name}
                          </span>
                        </td>
                        {FIELDS.map((f, fi) => {
                          const gated = isGatedGroup(f.group);
                          const disabled = rowLocked || (gated && !r.fsicmode);
                          // Insert Mode of Issuance cell just before the first FSEC field.
                          const modeCell =
                            f.group === "FSEC" && fi > 0 && FIELDS[fi - 1].group !== "FSEC" ? (
                              <td key={`mode-${m.value}`} className="border-b border-r p-1">
                                <GentableSearchSelect
                                  tablename={FSIS_ISSUANCE_TABLE}
                                  value={r.fsicmode ? String(r.fsicmode) : undefined}
                                  valueName={modeNames[m.value] ?? ""}
                                  placeholder="Select mode"
                                  hideCode
                                  disabled={rowLocked}
                                  readOnly={rowLocked}
                                  onChange={(detno, description) =>
                                    updateRowMode(m.value, detno, description)
                                  }
                                />
                              </td>
                            ) : null;
                          return (
                            <React.Fragment key={f.key}>
                              {modeCell}
                              <td className="border-b border-r p-0">
                                <Input
                                  type="number"
                                  min={0}
                                  value={String(r[f.key] ?? 0)}
                                  disabled={disabled}
                                  readOnly={disabled}
                                  onChange={(e) => updateCell(m.value, f.key, e.target.value)}
                                  className="h-8 w-[70px] rounded-none border-0 bg-transparent text-right tabular-nums focus-visible:ring-1 disabled:opacity-60"
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="border-b border-r p-0">
                          <Input
                            type="text"
                            value={r.remarks ?? ""}
                            disabled={rowLocked}
                            readOnly={rowLocked}
                            onChange={(e) => updateCell(m.value, "remarks", e.target.value)}
                            className="h-8 w-[220px] rounded-none border-0 bg-transparent focus-visible:ring-1"
                            placeholder="Notes…"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* Yearly summary row — solid emphasis, centered totals. */}
                  <tr className="border-t-2 border-border bg-accent font-bold text-foreground">
                    <td className="sticky left-0 z-20 border-r-2 border-t-2 border-border bg-accent px-3 py-2.5 text-left font-bold uppercase tracking-wide">
                      Total
                    </td>
                    {FIELDS.map((f, fi) => {
                      const modeCell =
                        f.group === "FSEC" && fi > 0 && FIELDS[fi - 1].group !== "FSEC" ? (
                          <td
                            key={`mode-total`}
                            className="border-r border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums"
                          >
                            —
                          </td>
                        ) : null;
                      return (
                        <React.Fragment key={f.key}>
                          {modeCell}
                          <td className="border-r border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums">
                            {(columnTotals[f.key] ?? 0).toLocaleString()}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="border-t-2 border-border bg-accent px-3 py-2.5 text-center font-bold tabular-nums">
                      {grandTotal.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              Enter monthly totals. Locked months are shown for reference only.
              Issuance-gated fields (FSEC, FSIC, Notices) unlock once a Mode of Issuance is chosen for that month.
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
              {saving ? "Saving…" : "Save Changes"}
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
  const y = Number(year);
  const m = Number(month);
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
    return () => {
      cancelled = true;
    };
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
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[1100px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Fire Safety Compliance Editor
              </DialogTitle>
              <DialogDescription>
                {stationName ? `${stationName} · ` : ""}
                {monthName} {year} — yearly editable overview.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-5 py-4">
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
