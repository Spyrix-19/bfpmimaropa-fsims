import * as React from "react";
import { Download, Eye, Plus } from "lucide-react";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchKey from "@/components/search-key";
import FilterField from "@/components/filter-field";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import ReadOnlyField from "@/pages/06_target-reference/components/ReadOnlyField";
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
  totalLabel,
  rows: initialRows,
  fields,
}: Props) {
  const [rows, setRows] = React.useState<BwcRow[]>(initialRows);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formRow, setFormRow] = React.useState<BwcRow | null>(null);
  const [viewRow, setViewRow] = React.useState<BwcRow | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<BwcRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [searchkey, setSearchkey] = React.useState("");
  const [selectedProvinces, setSelectedProvinces] = React.useState<SelectedLocation[]>([]);
  const [selectedStations, setSelectedStations] = React.useState<SelectedStation[]>([]);
  const { user, systemAccess } = useAuth();
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const scope = React.useMemo(
    () => resolveLocationScope(user, systemAccess?.roleno ?? 0),
    [user, systemAccess?.roleno],
  );

  React.useEffect(() => {
    if (scope.provinceLocked && scope.provinceno) {
      const locked: SelectedLocation = {
        locationno: scope.provinceno,
        locationname: scope.provincename,
      };
      const same =
        selectedProvinces.length === 1 && selectedProvinces[0].locationno === locked.locationno;
      if (!same) setSelectedProvinces([locked]);
    }

    if (scope.stationLocked && scope.stationno) {
      const locked: SelectedStation = {
        stationno: scope.stationno,
        stationname: scope.stationname,
        provinceno: scope.provinceno,
        provincename: scope.provincename,
      };
      const same =
        selectedStations.length === 1 && selectedStations[0].stationno === locked.stationno;
      if (!same) setSelectedStations([locked]);
    }
  }, [scope.provinceLocked, scope.provinceno, scope.provincename, scope.stationLocked, scope.stationno, scope.stationname, scope.provincename, selectedProvinces, selectedStations]);

  const filtered = React.useMemo(() => {
    const key = searchkey.trim().toLowerCase();
    const provinceNames = new Set(selectedProvinces.map((p) => p.locationname.toLowerCase()));
    const stationNames = new Set(selectedStations.map((s) => s.stationname.toLowerCase()));

    return rows.filter((r) => {
      if (selectedProvinces.length > 0 && !provinceNames.has(r.provincename.toLowerCase())) {
        return false;
      }
      if (selectedStations.length > 0 && !stationNames.has(r.stationname.toLowerCase())) {
        return false;
      }
      if (!key) return true;
      return `${r.stationname} ${r.cityname} ${r.provincename}`.toLowerCase().includes(key);
    });
  }, [rows, searchkey, selectedProvinces, selectedStations]);

  const total = filtered.length;
  const paged = React.useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const handleReset = () => {
    setSearchkey("");
    setSelectedProvinces([]);
    setSelectedStations([]);
    setPage(1);
  };

  const handleProvincesChange = (next: SelectedLocation[]) => {
    if (next.length === 0) {
      setSelectedProvinces([]);
      setSelectedStations([]);
      setPage(1);
      return;
    }
    const allowed = new Set(next.map((p) => p.locationno));
    setSelectedProvinces(next);
    setSelectedStations((prev) => prev.filter((s) => allowed.has(s.provinceno)));
    setPage(1);
  };

  const handleStationsChange = (next: SelectedStation[]) => {
    const merged = [...selectedProvinces];
    const known = new Set(merged.map((p) => p.locationno));
    next.forEach((s) => {
      if (!s.provinceno || known.has(s.provinceno)) return;
      known.add(s.provinceno);
      merged.push({ locationno: s.provinceno, locationname: s.provincename });
    });
    setSelectedProvinces(merged);
    setSelectedStations(next);
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
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={() => exportBwcLedger(filtered, fields, totalLabel, title)}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            <Download className="h-4 w-4" /> Export
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
            {scope.provinceLocked ? (
              <ReadOnlyField
                value={scope.provincename || "All provinces"}
                placeholder="All provinces"
                title="Restricted to your assigned province"
              />
            ) : (
              <LocationMultiSelect
                mode="location"
                value={selectedProvinces}
                locationtype="PROVINCE"
                parentcode={MIMAROPA_REGION_CODE}
                onChange={handleProvincesChange}
                placeholder="All provinces"
                hideCode
                useStationApi
                className="w-full"
              />
            )}
          </FilterField>
          <FilterField label="Station">
            {scope.stationLocked ? (
              <ReadOnlyField
                value={scope.stationname || "All stations"}
                placeholder="All stations"
                title="Restricted to your assigned station"
              />
            ) : (
              <StationMultiSelect
                mode="station"
                value={selectedStations}
                provinces={selectedProvinces.map((p) => ({ provinceno: p.locationno }))}
                onChange={handleStationsChange}
                placeholder="All stations"
                alwaysEnabled
                className="w-full"
              />
            )}
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
