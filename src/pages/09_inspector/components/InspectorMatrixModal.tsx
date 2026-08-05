import * as React from "react";
import { Download, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import ResetFiltersButton from "@/components/reset-filters-button";
import SearchKey from "@/components/search-key";
import { MATRIX_TONE } from "@/lib/theme";
import { exportInspectorMatrix } from "./inspectorMatrixExport";
import type { InspectorField, InspectorRow } from "./inspectorTypes";
import { num, rowTotal } from "./inspectorTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  totalLabel: string;
  fields: InspectorField[];
  rows: InspectorRow[];
}

const STYLE = {
  stationHead: MATRIX_TONE.stationHead,
  group: MATRIX_TONE.quarter,
  cat: MATRIX_TONE.cat,
  annual: MATRIX_TONE.annual,
  provHeaderRow: MATRIX_TONE.provHeaderRow,
  provTotalRow: MATRIX_TONE.provTotalRow,
  grandTotalRow: MATRIX_TONE.provTotalRowStrong,
};

function NumCell({
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
      className={`border-b px-3 py-1.5 text-center tabular-nums ${
        boundary ? "border-r-2 border-r-slate-300 dark:border-r-slate-700" : "border-r"
      } ${bold ? "font-bold" : ""} ${
        value === 0 && !bold ? "text-muted-foreground/60" : ""
      } ${rowClass ?? ""}`}
    >
      {value.toLocaleString()}
    </td>
  );
}

export default function InspectorMatrixModal({
  open,
  onOpenChange,
  title,
  totalLabel,
  fields,
  rows,
}: Props) {
  const [searchkey, setSearchkey] = React.useState("");
  const [province, setProvince] = React.useState("ALL");

  const provinces = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.provincename))).sort(),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const key = searchkey.trim().toLowerCase();
    return rows.filter((r) => {
      if (province !== "ALL" && r.provincename !== province) return false;
      if (!key) return true;
      return `${r.stationname} ${r.cityname} ${r.provincename} ${r.unitcode}`
        .toLowerCase()
        .includes(key);
    });
  }, [rows, province, searchkey]);

  const groups = React.useMemo(() => {
    const map = new Map<string, InspectorRow[]>();
    filtered.forEach((r) => {
      const list = map.get(r.provincename) ?? [];
      list.push(r);
      map.set(r.provincename, list);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provincename, stations]) => ({
        provincename,
        stations: stations.slice().sort((a, b) => a.stationname.localeCompare(b.stationname)),
      }));
  }, [filtered]);

  const totalCols = fields.length + 2;

  const sumOf = (list: InspectorRow[], key: string) => list.reduce((sum, r) => sum + num(r, key), 0);
  const sumTotal = (list: InspectorRow[]) => list.reduce((sum, r) => sum + rowTotal(r, fields), 0);

  const handleReset = () => {
    setSearchkey("");
    setProvince("ALL");
  };

  const handleExport = () => exportInspectorMatrix(groups, fields, totalLabel, title);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex h-[90vh] w-[95vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b bg-card px-5 py-3 text-left">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <LayoutGrid className="h-4 w-4 text-primary" />
              {title}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Stations grouped by Province — {filtered.length} station(s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogHeader>

        <div className="border-b bg-card px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Search Key
              </div>
              <SearchKey
                value={searchkey}
                onChange={setSearchkey}
                placeholder="Search station, city, or unit code"
                widthClass="w-full"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Province
              </div>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="All Provinces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Provinces</SelectItem>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-start lg:col-span-2 lg:justify-end">
              <ResetFiltersButton onReset={handleReset} />
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th
                  rowSpan={2}
                  className={`sticky left-0 top-0 z-40 min-w-[280px] border-b border-r px-3 py-2 text-left uppercase tracking-wider ${STYLE.stationHead}`}
                >
                  Station Information
                </th>
                <th
                  colSpan={fields.length}
                  className={`border-b border-r px-2 py-2 text-center uppercase tracking-wider ${STYLE.group}`}
                >
                  Recorded Breakdown
                </th>
                <th
                  rowSpan={2}
                  className={`border-b border-r px-3 py-2 text-center uppercase tracking-wider ${STYLE.annual}`}
                >
                  {totalLabel}
                </th>
              </tr>
              <tr>
                {fields.map((f, i) => (
                  <th
                    key={f.key}
                    className={`border-b px-3 py-1.5 text-center text-[10px] font-bold uppercase ${
                      i === fields.length - 1 ? "border-r-2 border-r-white/30" : "border-r"
                    } ${STYLE.cat}`}
                  >
                    {f.shortLabel ?? f.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td
                    colSpan={totalCols}
                    className="border-b bg-card px-4 py-10 text-center text-sm text-muted-foreground"
                  >
                    No stations found. Adjust your filters and try again.
                  </td>
                </tr>
              )}

              {groups.map((g) => (
                <React.Fragment key={g.provincename}>
                  <tr>
                    <td
                      className={`sticky left-0 z-10 border-b border-t-2 border-t-slate-400/60 px-3 py-1.5 text-[12px] uppercase tracking-[0.2em] ${STYLE.provHeaderRow}`}
                    >
                      {g.provincename}
                    </td>
                    <td
                      colSpan={totalCols - 1}
                      aria-hidden="true"
                      className="border-b border-t-2 border-grid-strong group-row"
                    />
                  </tr>

                  {g.stations.map((r, idx) => {
                    const rowBg = idx % 2 === 1 ? "bg-muted" : "bg-card";
                    return (
                      <tr key={r.stationno} className={rowBg}>
                        <td className={`sticky left-0 z-10 border-b border-r px-3 py-2 ${rowBg}`}>
                          <div className="flex items-center gap-2">
                            <AvatarWithFallback
                              name={r.stationname}
                              src={r.logourl ?? null}
                              alt={r.stationname}
                              className="h-8 w-8 shrink-0 rounded-full ring-1 ring-primary/20"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold leading-tight">
                                {r.stationname}
                              </div>
                              <div className="truncate text-[10px] font-medium text-primary">
                                {r.unitcode}
                              </div>
                              <div className="truncate text-[10px] text-muted-foreground">
                                {r.cityname}, {r.provincename}
                              </div>
                            </div>
                          </div>
                        </td>
                        {fields.map((f, i) => (
                          <NumCell
                            key={f.key}
                            value={num(r, f.key)}
                            boundary={i === fields.length - 1}
                          />
                        ))}
                        <NumCell value={rowTotal(r, fields)} bold />
                      </tr>
                    );
                  })}

                  <tr className={STYLE.provTotalRow}>
                    <td
                      className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-[11px] uppercase tracking-[0.15em] ${STYLE.provTotalRow}`}
                    >
                      {g.provincename} Total
                    </td>
                    {fields.map((f, i) => (
                      <NumCell
                        key={f.key}
                        value={sumOf(g.stations, f.key)}
                        bold
                        boundary={i === fields.length - 1}
                        rowClass={STYLE.provTotalRow}
                      />
                    ))}
                    <NumCell value={sumTotal(g.stations)} bold rowClass={STYLE.provTotalRow} />
                  </tr>
                </React.Fragment>
              ))}

              {groups.length > 0 && (
                <tr className={STYLE.grandTotalRow}>
                  <td
                    className={`sticky left-0 z-10 border-b border-r px-3 py-2 text-[11px] uppercase tracking-[0.2em] ${STYLE.grandTotalRow}`}
                  >
                    Regional Grand Total
                  </td>
                  {fields.map((f, i) => (
                    <NumCell
                      key={f.key}
                      value={sumOf(filtered, f.key)}
                      bold
                      boundary={i === fields.length - 1}
                      rowClass={STYLE.grandTotalRow}
                    />
                  ))}
                  <NumCell value={sumTotal(filtered)} bold rowClass={STYLE.grandTotalRow} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
