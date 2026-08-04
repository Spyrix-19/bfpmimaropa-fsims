import * as React from "react";
import { Download, Eye, LayoutGrid, Plus } from "lucide-react";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SearchKey from "@/components/search-key";
import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import PaginationControls from "@/components/pagination";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "@/lib/toast";
import { StatBox } from "@/components/stat-box";
import BwcDeleteDialog from "./BwcDeleteDialog";
import BwcFormModal from "./BwcFormModal";
import BwcDetailsModal from "./BwcDetailsModal";
import BwcMatrixModal from "./BwcMatrixModal";
import { exportBwcLedger } from "./bwcExport";
import type { BwcField, BwcRow } from "./bwcTypes";
import { num, rowTotal } from "./bwcTypes";
import type { StationInfo } from "@/mock/logistics.mock";

interface Props {
  title: string;
  description: string;
  icon: React.ReactNode;
  /** Singular entity label, e.g. "BWC" or "Inspector". */
  entityLabel: string;
  addLabel: string;
  matrixLabel: string;
  matrixTitle: string;
  totalLabel: string;
  rows: BwcRow[];
  fields: BwcField[];
}

function StationHeading({ station }: { station: StationInfo }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <AvatarWithFallback
        name={station.stationname}
        src={station.logourl ?? null}
        alt={station.stationname}
        className="h-9 w-9 shrink-0 border border-border/60"
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">{station.stationname}</div>
        <div className="truncate text-xs font-medium text-primary">{station.unitcode}</div>
        <div className="truncate text-xs text-muted-foreground">
          {station.cityname}, {station.provincename}
        </div>
      </div>
    </div>
  );
}

export default function BwcLedger({
  title,
  description,
  icon,
  entityLabel,
  addLabel,
  matrixLabel,
  matrixTitle,
  totalLabel,
  rows: initialRows,
  fields,
}: Props) {
  const [rows, setRows] = React.useState<BwcRow[]>(initialRows);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formRow, setFormRow] = React.useState<BwcRow | null>(null);
  const [viewRow, setViewRow] = React.useState<BwcRow | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<BwcRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [searchkey, setSearchkey] = React.useState("");
  const [province, setProvince] = React.useState("ALL");
  const [station, setStation] = React.useState("ALL");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const provinces = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.provincename))).sort(),
    [rows],
  );
  const stations = React.useMemo(
    () =>
      rows
        .filter((r) => province === "ALL" || r.provincename === province)
        .map((r) => r.stationname)
        .sort(),
    [rows, province],
  );

  const filtered = React.useMemo(() => {
    const key = searchkey.trim().toLowerCase();
    return rows.filter((r) => {
      if (province !== "ALL" && r.provincename !== province) return false;
      if (station !== "ALL" && r.stationname !== station) return false;
      if (!key) return true;
      return `${r.stationname} ${r.cityname} ${r.provincename}`.toLowerCase().includes(key);
    });
  }, [rows, searchkey, province, station]);

  const total = filtered.length;
  const paged = React.useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const handleReset = () => {
    setSearchkey("");
    setProvince("ALL");
    setStation("ALL");
    setPage(1);
  };

  const openAdd = () => {
    setFormRow(null);
    setFormOpen(true);
  };
  const openEdit = (row: BwcRow) => {
    setFormRow(row);
    setFormOpen(true);
  };
  const openView = (row: BwcRow) => {
    setViewRow(row);
    setViewOpen(true);
  };

  const handleSubmit = (next: BwcRow) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.stationno === next.stationno);
      return exists
        ? prev.map((r) => (r.stationno === next.stationno ? { ...r, ...next } : r))
        : [...prev, next];
    });
    toast.success(formRow ? `${entityLabel} record updated.` : `${entityLabel} record added.`);
  };

  const handleDelete = () => {
    if (!deleteRow) return;
    setDeleting(true);
    window.setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.stationno !== deleteRow.stationno));
      setDeleting(false);
      setDeleteRow(null);
      toast.success(`${entityLabel} record deleted.`);
    }, 300);
  };

  const stationCatalog = React.useMemo(
    () => [...rows].sort((a, b) => a.stationname.localeCompare(b.stationname)),
    [rows],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            {icon}
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => exportBwcLedger(filtered, fields, totalLabel, title)}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button
            variant="outline"
            onClick={() => setMatrixOpen(true)}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <LayoutGrid className="h-4 w-4" /> {matrixLabel}
          </Button>
          <Button onClick={openAdd} className="w-full justify-center gap-2 sm:w-auto">
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        </div>
      </div>

      <Card className="border-border/60 p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <FilterField label="Search Key">
            <SearchKey
              value={searchkey}
              onChange={(v) => {
                setSearchkey(v);
                setPage(1);
              }}
              placeholder="Search station, city, or province"
              widthClass="w-full"
            />
          </FilterField>
          <FilterField label="Province">
            <Select
              value={province}
              onValueChange={(v) => {
                setProvince(v);
                setStation("ALL");
                setPage(1);
              }}
            >
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
          </FilterField>
          <FilterField label="Station">
            <Select
              value={station}
              onValueChange={(v) => {
                setStation(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="All Stations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stations</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <div className="flex justify-end">
            <ResetFiltersButton onReset={handleReset} />
          </div>
        </div>
      </Card>

      {paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No stations found. Adjust your filters and try again.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {paged.map((row) => (
            <Card
              key={row.stationno}
              className="group space-y-4 border-border/60 bg-card p-4 shadow-soft"
            >
              <StationHeading station={row} />
              <div className="grid grid-cols-3 gap-2">
                {fields.map((f) => (
                  <StatBox key={f.key} label={f.label} value={num(row, f.key)} tone={f.tone} />
                ))}
                <StatBox label={totalLabel} value={rowTotal(row, fields)} tone="primary" />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <EditButton
                  icon={<Eye />}
                  ariaLabel="View"
                  tooltip="View"
                  onClick={() => openView(row)}
                />
                <EditButton tooltip="Edit" onClick={() => openEdit(row)} />
                <DeleteButton tooltip="Delete" onClick={() => setDeleteRow(row)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="border-t border-border/60 pt-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <BwcFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        row={formRow}
        stations={stationCatalog}
        fields={fields}
        entityLabel={entityLabel}
        totalLabel={totalLabel}
        icon={icon}
        onSubmit={handleSubmit}
      />

      <BwcDetailsModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        row={viewRow}
        fields={fields}
        entityLabel={entityLabel}
        totalLabel={totalLabel}
        icon={icon}
        onEdit={() => viewRow && openEdit(viewRow)}
      />

      <BwcMatrixModal
        open={matrixOpen}
        onOpenChange={setMatrixOpen}
        title={matrixTitle}
        totalLabel={totalLabel}
        fields={fields}
        rows={rows}
      />

      <BwcDeleteDialog
        row={deleteRow}
        onOpenChange={(o) => !o && setDeleteRow(null)}
        entityLabel={entityLabel}
        deleting={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
