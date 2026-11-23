import * as React from "react";
import { Building2, Eye, Map, MapPin, MapPinned, RefreshCw, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OptionButton from "@/components/option-button";
import { LedgerMessageRow, LedgerShell, LedgerTable } from "@/components/shared/LedgerShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { InlineLoader } from "@/components/shared/InlineLoader";
import { Card } from "@/components/ui/card";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import FilterField from "@/components/filter-field";
import GentableSelect from "@/components/gentable-select";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import SecureDeleteDialog from "@/components/secure-delete-dialog";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { usePagination } from "@/hooks/usePagination";
import { toast } from "@/lib/toast";
import { useAuth, resolveLocationScope } from "@/lib/auth";
import { MIMAROPA_REGION_CODE, EMPTY_GUID } from "@/lib/fsims-constants";
import { unwrap } from "@/lib/api-envelope";
import { businessAPI } from "@/services/establistmentAPI";
import type { BusinessEstablishmentModel } from "@/types/establishmentType";
import BusinessFormModal from "./components/newestablishmentmodal";
import BusinessDetailsModal from "./components/viewestablishmentmodal";
import { BUSINESS_STATUS_TABLE, useBusinessOptions } from "./business-options";

const COLUMNS = ["Action", "Business", "Owner / Contact", "Station", "Status", "Landmark", "Address"];
const hasCoords = (r: BusinessEstablishmentModel) => {
  const lat = Number(r.latitude); const lng = Number(r.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
};

export default function BusinessEstablishments() {
  const { user, systemAccess } = useAuth();
  const locationScope = React.useMemo(() => resolveLocationScope(user, systemAccess?.roleno ?? 0), [user, systemAccess?.roleno]);
  const statusOptions = useBusinessOptions(BUSINESS_STATUS_TABLE);
  const [search, setSearch] = React.useState("");
  const [statusno, setStatusno] = React.useState(0);
  const [provinceno, setProvinceno] = React.useState("");
  const [provincename, setProvincename] = React.useState("");
  const [stationno, setStationno] = React.useState("");
  const [stationname, setStationname] = React.useState("");
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });
  const [rows, setRows] = React.useState<BusinessEstablishmentModel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState("");
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshTick((v) => v + 1), []);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BusinessEstablishmentModel | null>(null);
  const [viewing, setViewing] = React.useState<BusinessEstablishmentModel | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<BusinessEstablishmentModel | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const hasProvince = !!provinceno && provinceno !== EMPTY_GUID;
  const hasStation = !!stationno && stationno !== EMPTY_GUID;
  const activeFilterCount = (hasProvince ? 1 : 0) + (hasStation ? 1 : 0) + (statusno > 0 ? 1 : 0);

  React.useEffect(() => { if (locationScope.provinceLocked) { setProvinceno(locationScope.provinceno); setProvincename(locationScope.provincename); } }, [locationScope]);
  React.useEffect(() => { if (locationScope.stationLocked) { setStationno(locationScope.stationno); setStationname(locationScope.stationname); } }, [locationScope]);
  React.useEffect(() => setPage(1), [search, pageSize, statusno, provinceno, stationno, setPage]);

  React.useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError("");

      try {
        const resp = await businessAPI.getLedger({
          searchkey: search.trim() || undefined,
          stationno: hasStation ? stationno : undefined,
          provinceno: hasProvince ? provinceno : undefined,
          statusno: statusno > 0 ? String(statusno) : undefined,
          pagenumber: page,
          pagesize: pageSize,
        }, {
          signal: controller.signal,
          suppressGlobalLoading: true,
          suppressErrorToast: true,
        });

        const { ok, data, total: t, canceled: requestCanceled, error } = unwrap<BusinessEstablishmentModel[]>(resp);
        if (cancelled || requestCanceled) return;

        if (!ok) {
          setRows([]);
          setTotal(0);
          setLoadError(error || "Unable to load business establishment records.");
        } else {
          const emptyRows = Array.isArray(data) ? data : [];
          setRows(emptyRows);
          setTotal(typeof t === "number" ? t : emptyRows.length);
          setLoadError("");
        }
      } catch {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setLoadError("Unable to load business establishment records.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [search, statusno, provinceno, stationno, page, pageSize, refreshTick, hasProvince, hasStation]);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (row: BusinessEstablishmentModel) => { setEditing(row); setFormOpen(true); };
  const openView = (row: BusinessEstablishmentModel) => { setViewing(row); setDetailsOpen(true); };

  const confirmDelete = async () => {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    try {
      const resp = await businessAPI.delete({ establishmentno: deleteTarget.establishmentno, deletedby: String(user.memberno ?? ""), roleno: Number(systemAccess?.roleno ?? 0) || 0 });
      const { ok, error } = unwrap(resp);
      if (!ok) { toast.error(error || "Unable to delete this business establishment."); return; }
      toast.success(`${deleteTarget.establishmentname} has been deleted.`);
      setDeleteTarget(null); refresh();
    } finally { setDeleting(false); }
  };

  const addressOf = (row: BusinessEstablishmentModel) => {
    const regionZip = [row.regionname, row.zipcode].filter(Boolean).join(" ").trim();
    return [row.streetaddress, row.barangayname, row.cityname, row.provincename, regionZip]
      .filter((p) => typeof p === "string" && p.trim())
      .map((p) => p.trim())
      .join(", ") || "—";
  };
  const ownerOf = (row: BusinessEstablishmentModel) => row.fullname?.trim() || [row.firstname, row.miname, row.lastname, row.suffix].filter(Boolean).join(" ") || "—";
  const openMaps = (row: BusinessEstablishmentModel) => { if (!hasCoords(row)) { toast.error("No coordinate available for this establishment."); return; } window.open(`https://www.google.com/maps?q=${row.latitude},${row.longitude}`, "_blank", "noopener,noreferrer"); };
  const coordinateOf = (row: BusinessEstablishmentModel) =>
    hasCoords(row)
      ? `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`
      : "—";

  const RowOptions = ({ row }: { row: BusinessEstablishmentModel }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <OptionButton variant="square" aria-label="More establishment actions" tooltip="More actions" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem onSelect={() => openMaps(row)}>
          <MapPinned className="mr-2 h-4 w-4" /> View map
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const rowActions = (row: BusinessEstablishmentModel) => (
    <div className="flex items-center gap-1.5">
      <EditButton icon={<Eye />} ariaLabel="View establishment" tooltip="View" onClick={() => openView(row)} />
      <EditButton ariaLabel="Edit establishment" tooltip="Edit" onClick={() => openEdit(row)} />
      <DeleteButton
        ariaLabel="Delete establishment"
        tooltip={row.isrequired ? "Required establishments cannot be deleted" : "Delete"}
        disabled={row.isrequired}
        onClick={() => setDeleteTarget(row)}
      />
      <RowOptions row={row} />
    </div>
  );

  const resetFilters = () => {
    setStatusno(0);
    if (locationScope.provinceLocked) { setProvinceno(locationScope.provinceno); setProvincename(locationScope.provincename); } else { setProvinceno(""); setProvincename(""); }
    if (locationScope.stationLocked) { setStationno(locationScope.stationno); setStationname(locationScope.stationname); } else { setStationno(""); setStationname(""); }
  };

  const filters = <>
    <FilterField label="Province"><LocationSearchSelect locationtype="PROVINCE" parentcode={MIMAROPA_REGION_CODE} value={provinceno} valueName={provincename || locationScope.provincename} hideCode showAllOption disabled={locationScope.provinceLocked} onChange={(no, name) => { setProvinceno(no || ""); setProvincename(no ? name : ""); setStationno(""); setStationname(""); }} placeholder="All provinces" /></FilterField>
    <FilterField label="Station"><StationSearchSelect key={`station-${provinceno}`} value={stationno} valueName={stationname || locationScope.stationname} provinceno={hasProvince ? provinceno : undefined} showAllOption disabled={locationScope.stationLocked} onChange={(no, name) => { setStationno(no || ""); setStationname(no ? name : ""); }} placeholder="All stations" /></FilterField>
    <FilterField label="Status"><GentableSelect<number> value={statusno} onChange={(v) => setStatusno(Number(v) || 0)} options={statusOptions} placeholder="All" aria-label="Filter by status" /></FilterField>
  </>;

  const hasRows = !loading && !loadError && rows.length > 0;
  return <LedgerShell title="Business Establishments" icon={Building2} description="Establishment registry, fire safety compliance and mapped locations." search={search} onSearchChange={setSearch} searchPlaceholder="Search code, establishment, owner or address…" filters={filters} activeFilterCount={activeFilterCount} onReset={activeFilterCount > 0 ? resetFilters : undefined} addLabel="Add Record" onAdd={openAdd} exportName="Business Establishments" page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} extras={<><BusinessFormModal open={formOpen} onOpenChange={setFormOpen} record={editing} onSaved={refresh} /><BusinessDetailsModal open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) setViewing(null); }} record={viewing} /><SecureDeleteDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }} title="Delete business establishment" subject={deleteTarget ? `${deleteTarget.establishmentcode ? `${deleteTarget.establishmentcode} — ` : ""}${deleteTarget.establishmentname}` : undefined} description="This business establishment record will be permanently removed. This action cannot be undone." confirmLabel={deleting ? "Deleting…" : "Delete"} deleting={deleting} onConfirm={confirmDelete} /></>}>
    {hasRows ? <div className="space-y-3 p-3 md:hidden">{rows.map((row) => <Card key={row.establishmentno} className="border-border/60 p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{row.establishmentcode}</span><div className="mt-1 truncate text-sm font-bold">{row.establishmentname}</div></div><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{row.statusname || "—"}</span></div><p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span>{addressOf(row)}</span></p><div className="mt-3 flex justify-end border-t pt-3">{rowActions(row)}</div></Card>)}</div> : null}
    <div className={hasRows ? "hidden md:block" : ""}><div className="w-full md:min-w-[1200px]"><LedgerTable columns={COLUMNS}>{loading ? <LedgerMessageRow colSpan={COLUMNS.length}><InlineLoader label="Loading business establishments…" /></LedgerMessageRow> : loadError ? <LedgerMessageRow colSpan={COLUMNS.length}><EmptyState message="Unable to load business establishments."><span className="text-xs">{loadError}</span><button type="button" onClick={refresh} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"><RefreshCw className="h-3.5 w-3.5" /> Try again</button></EmptyState></LedgerMessageRow> : rows.length === 0 ? <LedgerMessageRow colSpan={COLUMNS.length}><EmptyState message={search.trim() || activeFilterCount ? "No business establishments match your search or filters." : "No business establishment records yet."} /></LedgerMessageRow> : rows.map((row) => <tr key={row.establishmentno} className="border-t border-border/60 align-top hover:bg-muted/30"><td className="px-3 py-3">{rowActions(row)}</td><td className="px-3 py-3"><div className="flex min-w-[260px] items-center gap-3"><AvatarWithFallback entity={row} name={row.establishmentname} src={row.stationlogourl} className="h-12 w-12 border border-border bg-muted/40" /><div className="min-w-0"><div className="truncate text-sm font-semibold">{row.establishmentname || "—"}</div><div className="truncate text-xs text-muted-foreground">{row.establishmentcode || "—"}</div></div></div></td><td className="px-3 py-3 text-sm text-muted-foreground"><div className="min-w-[180px]"><div className="text-foreground">{ownerOf(row)}</div><div className="text-xs">{[row.contactno, row.emailaddress].filter(Boolean).join(" / ") || "—"}</div></div></td><td className="px-3 py-3 text-sm text-muted-foreground"><div className="min-w-[150px]">{row.stationname || "—"}</div></td><td className="px-3 py-3"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">{row.statusname || "—"}</span></td><td className="px-3 py-3 text-sm text-muted-foreground"><div className="min-w-[140px] break-words">{row.landmark?.trim() || "—"}</div></td><td className="px-3 py-3 text-sm text-muted-foreground"><div className="min-w-[220px] space-y-1.5"><div className="break-words">{addressOf(row)}</div><button type="button" onClick={() => openMaps(row)} disabled={!hasCoords(row)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] font-medium text-primary disabled:opacity-50"><Map className="h-3.5 w-3.5" /><span>{hasCoords(row) ? `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}` : "—"}</span></button></div></td></tr>)}</LedgerTable></div></div>
  </LedgerShell>;
}
