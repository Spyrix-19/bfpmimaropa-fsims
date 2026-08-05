import * as React from "react";
import { AlertTriangle, Download, Loader2, Eye, Plus, Radio } from "lucide-react";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchKey from "@/components/search-key";
import FilterField from "@/components/filter-field";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { resolveLocationScope, useAuth } from "@/lib/auth";
import ResetFiltersButton from "@/components/reset-filters-button";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import PaginationControls from "@/components/pagination";
import { usePagination } from "@/hooks/usePagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { StatBox } from "@/components/stat-box";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import SecureDeleteDialog from "@/components/secure-delete-dialog";
import { bwcAPI } from "@/services/bwcAPI";
import type { SearchStationModel } from "@/types/stationTypes";
import BwcModal, { type BwcFormSubmit } from "./components/issuedbwcmodal";
import BwcView from "./components/issuedbwcview";
import { exportBwcLedger, num, rowTotal } from "./bwcexport";

/* ---------------------------------------------------------------- types -- */

/** Station identity fields returned with every ledger row. */
export interface StationInfo {
  stationno: string;
  stationname: string;
  unitcode: string;
  provincename: string;
  cityname: string;
  logourl?: string | null;
}

/** A numeric metric column shared by the ledger, modal and view. */
export interface BwcField {
  key: string;
  label: string;
  tone?: "muted" | "success" | "destructive" | "primary";
  /** Helper hint rendered under the input inside the add/edit modal. */
  hint?: string;
}

/** A BWC row: station identity + record key + numeric metrics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BwcRow = StationInfo & Record<string, any> & { recordno: string; remarks?: string };

interface BwcProvinceParam {
  provinceno: string;
  stationnos: string[];
}

/** Maps an API ledger/detail model into the flat row shape used by the UI. */
function toBwcRow(model: unknown): BwcRow {
  const m = (model ?? {}) as Record<string, unknown>;
  return {
    ...(m as object),
    recordno: String(m.bwcno ?? ""),
    stationno: String(m.stationno ?? ""),
    stationname: String(m.stationname ?? ""),
    unitcode: String(m.stationcode ?? m.unitcode ?? ""),
    cityname: String(m.cityname ?? ""),
    provincename: String(m.provincename ?? ""),
    logourl: (m.logourl as string) ?? null,
    remarks: String(m.remarks ?? ""),
  } as BwcRow;
}

/* ------------------------------------------------------------- constants -- */

const TITLE = "Issued BWC";
const DESCRIPTION = "Station-level inventory of issued body-worn cameras.";
const ENTITY_LABEL = "BWC";
const ADD_LABEL = "Add BWC";
const TOTAL_LABEL = "Total Issued";
const ICON = <Radio className="h-5 w-5 text-primary" />;

const FIELDS: BwcField[] = [
  {
    key: "operationalcount",
    label: "Working",
    tone: "success",
    hint: "Units currently serviceable.",
  },
  {
    key: "nonoperationalcount",
    label: "BER",
    tone: "destructive",
    hint: "Beyond economical repair.",
  },
];

/** Add/Edit is limited to Personnel (roleno 3) outside station types 25/26/27. */
const RESTRICTED_STATION_TYPES = [25, 26, 27];

/* ------------------------------------------------------------ subviews --- */

/** Locked filter display matching the height/styling of the select triggers. */
function LockedFilter({
  value,
  placeholder,
  title,
}: {
  value?: string;
  placeholder: string;
  title?: string;
}) {
  const text = value || placeholder;
  return (
    <div
      title={title}
      aria-readonly="true"
      className={cn(
        "flex h-10 w-full min-w-0 items-center rounded-md border bg-muted/40 px-3 text-left text-sm",
        value ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="truncate">{text}</span>
    </div>
  );
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

/* ----------------------------------------------------------------- page --- */

export default function IssuedBwcPage() {
  const [rows, setRows] = React.useState<BwcRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formRow, setFormRow] = React.useState<BwcRow | null>(null);
  const [existingRecord, setExistingRecord] = React.useState<BwcRow | null>(null);
  const [existingRecordDialogOpen, setExistingRecordDialogOpen] = React.useState(false);
  const [existingStationLabel, setExistingStationLabel] = React.useState("");
  const [viewRow, setViewRow] = React.useState<BwcRow | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [deleteRow, setDeleteRow] = React.useState<BwcRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [searchkey, setSearchkey] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchkey, 350);
  const [selectedProvinces, setSelectedProvinces] = React.useState<SelectedLocation[]>([]);
  const [selectedStations, setSelectedStations] = React.useState<SelectedStation[]>([]);
  const { user, systemAccess } = useAuth();
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const canManage =
    (systemAccess?.roleno ?? 0) === 3 &&
    !RESTRICTED_STATION_TYPES.includes(Number(user?.stationtype ?? 0));

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
  }, [
    scope.provinceLocked,
    scope.provinceno,
    scope.provincename,
    scope.stationLocked,
    scope.stationno,
    scope.stationname,
    selectedProvinces,
    selectedStations,
  ]);

  /** Province/station selection collapsed into the API's provinces payload. */
  const provinceParams = React.useMemo<BwcProvinceParam[]>(() => {
    const map = new Map<string, string[]>();
    selectedProvinces.forEach((p) => map.set(p.locationno, []));
    selectedStations.forEach((s) => {
      if (!s.provinceno) return;
      const list = map.get(s.provinceno) ?? [];
      list.push(s.stationno);
      map.set(s.provinceno, list);
    });
    return Array.from(map.entries()).map(([provinceno, stationnos]) => ({
      provinceno,
      stationnos,
    }));
  }, [selectedProvinces, selectedStations]);

  const provinceKey = JSON.stringify(provinceParams);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      const resp = await bwcAPI.getLedger(
        {
          parameters: {
            searchkey: debouncedSearch.trim(),
            provinces: JSON.parse(provinceKey) as BwcProvinceParam[],
          },
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true, signal: controller.signal },
      );
      const { ok, data, total: apiTotal, error, canceled } = unwrap<unknown[]>(resp);
      if (cancelled || canceled) return;
      if (!ok) {
        toast.error(error || "Unable to load issued bwc records.");
        setRows([]);
        setTotal(0);
      } else {
        const list = Array.isArray(data) ? data : [];
        setRows(list.map(toBwcRow));
        setTotal(apiTotal || list.length);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [debouncedSearch, provinceKey, page, pageSize, refreshTick]);

  const refresh = () => setRefreshTick((t) => t + 1);

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
    setExistingRecord(null);
    setExistingRecordDialogOpen(false);
    setFormRow(null);
    setFormOpen(true);
  };

  const openEdit = (row: BwcRow) => {
    setExistingRecord(null);
    setExistingRecordDialogOpen(false);
    setFormRow(row);
    setFormOpen(true);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setExistingRecord(null);
      setExistingRecordDialogOpen(false);
      setExistingStationLabel("");
    }
  };

  /** Loads the full record from the Detail endpoint before showing it. */
  const openView = async (row: BwcRow) => {
    setViewRow(row);
    setViewOpen(true);
    if (!row.recordno) return;
    const resp = await bwcAPI.getDetail({ bwcno: row.recordno }, { suppressGlobalLoading: true });
    const { ok, data } = unwrap<unknown>(resp);
    if (ok && data) setViewRow(toBwcRow(data));
  };

  const checkExistingRecord = React.useCallback(async (stationno: string, stationname?: string) => {
    const trimmed = stationno.trim();
    if (!trimmed) return null;

    const existsResp = await bwcAPI.CheckExist(
      { stationno: trimmed },
      { suppressGlobalLoading: true, suppressErrorToast: true },
    );
    const exists = unwrap<boolean>(existsResp);
    if (!exists.ok) {
      toast.error(exists.error || "Unable to check existing bwc record.");
      return null;
    }
    if (exists.data !== true) return null;

    const resp = await bwcAPI.getLedger(
      { parameters: { searchkey: trimmed, provinces: [] }, pagenumber: 1, pagesize: 50 },
      { suppressGlobalLoading: true, suppressErrorToast: true },
    );
    const { ok, data, error } = unwrap<unknown[]>(resp);
    if (!ok) {
      toast.error(error || "Unable to check existing bwc record.");
      return null;
    }

    const list = (Array.isArray(data) ? data : []).map(toBwcRow);
    const existing = list.find((row) => String(row.stationno ?? "") === trimmed);
    if (!existing?.recordno) return null;

    const detailResp = await bwcAPI.getDetail(
      { bwcno: existing.recordno },
      { suppressGlobalLoading: true, suppressErrorToast: true },
    );
    const detail = unwrap<unknown>(detailResp);
    if (!detail.ok || !detail.data) return toBwcRow(existing);

    setExistingStationLabel(stationname || existing.stationname || trimmed);
    return toBwcRow(detail.data);
  }, []);

  const handleStationSelection = async (
    stationno: string,
    stationname: string,
    _province?: string,
    _picked?: SearchStationModel,
  ) => {
    if (formRow) return;
    const trimmed = stationno.trim();
    if (!trimmed) {
      setExistingRecord(null);
      setExistingRecordDialogOpen(false);
      setExistingStationLabel("");
      return;
    }

    const existing = await checkExistingRecord(trimmed, stationname);
    if (existing?.recordno) {
      setExistingRecord(existing);
      setExistingStationLabel(stationname || existing.stationname || trimmed);
      setExistingRecordDialogOpen(true);
      return;
    }

    setExistingRecord(null);
    setExistingRecordDialogOpen(false);
    setExistingStationLabel("");
  };

  const handleExistingRecordConfirm = () => {
    setExistingRecordDialogOpen(false);
    if (existingRecord) setFormRow(existingRecord);
  };

  const handleSubmit = async (payload: BwcFormSubmit): Promise<boolean> => {
    const resp = await bwcAPI.create({
      bwcno: payload.recordno || EMPTY_GUID,
      stationno: payload.stationno,
      operationalcount: Number(payload.values.operationalcount ?? 0) || 0,
      nonoperationalcount: Number(payload.values.nonoperationalcount ?? 0) || 0,
      remarks: payload.remarks,
      encodedby: user?.memberno ?? "",
    });
    const { ok, error } = unwrap(resp);
    if (!ok) {
      toast.error(error || "Unable to save the bwc record.");
      return false;
    }
    toast.success(payload.recordno ? "BWC record updated." : "BWC record added.");
    refresh();
    return true;
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const resp = await bwcAPI.delete({
        bwcno: deleteRow.recordno,
        deletedby: user?.memberno ?? "",
        roleno: Number(systemAccess?.roleno ?? 0) || 0,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to delete the bwc record.");
        return;
      }
      toast.success("BWC record deleted.");
      setDeleteRow(null);
      refresh();
    } finally {
      setDeleting(false);
    }
  };

  /** Export pulls the same ledger endpoint with paging disabled. */
  const handleExport = async () => {
    setExporting(true);
    try {
      const resp = await bwcAPI.getLedger(
        {
          parameters: { searchkey: debouncedSearch.trim(), provinces: provinceParams },
          pagenumber: 0,
          pagesize: 0,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      const { ok, data, error } = unwrap<unknown[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to export issued bwc records.");
        return;
      }
      await exportBwcLedger(
        (Array.isArray(data) ? data : []).map(toBwcRow),
        FIELDS,
        TOTAL_LABEL,
        TITLE,
        {
          rank: user?.rankcode ?? user?.rankname ?? "",
          fullname: user?.fullname ?? user?.name ?? "",
          designation: user?.designation ?? "",
        },
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            {ICON}
            {TITLE}
          </h1>
          <p className="text-xs text-muted-foreground">{DESCRIPTION}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
            className="w-full justify-center gap-2 !text-primary [&_svg]:text-primary hover:!bg-primary hover:!text-white hover:[&_svg]:text-white sm:w-auto"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}{" "}
            {exporting ? "Exporting…" : "Export"}
          </Button>
          {canManage && (
            <Button onClick={openAdd} className="w-full justify-center gap-2 sm:w-auto">
              <Plus className="h-4 w-4" /> {ADD_LABEL}
            </Button>
          )}
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
              <LockedFilter
                value={scope.provincename}
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
                className="w-full"
              />
            )}
          </FilterField>
          <FilterField label="Station">
            {scope.stationLocked ? (
              <LockedFilter
                value={scope.stationname}
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

      {loading ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          Loading records…
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          No stations found. Adjust your filters and try again.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card
              key={row.recordno || row.stationno}
              className="group space-y-4 border-border/60 bg-card p-4 shadow-soft"
            >
              <StationHeading station={row} />
              <div className="grid grid-cols-3 gap-2">
                {FIELDS.map((f) => (
                  <StatBox key={f.key} label={f.label} value={num(row, f.key)} tone={f.tone} />
                ))}
                <StatBox label={TOTAL_LABEL} value={rowTotal(row, FIELDS)} tone="primary" />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
                <EditButton
                  icon={<Eye />}
                  ariaLabel="View"
                  tooltip="View"
                  onClick={() => openView(row)}
                />
                {canManage && <EditButton tooltip="Edit" onClick={() => openEdit(row)} />}
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

      <BwcModal
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        row={formRow}
        fields={FIELDS}
        entityLabel={ENTITY_LABEL}
        totalLabel={TOTAL_LABEL}
        icon={ICON}
        onSubmit={handleSubmit}
        onStationSelected={handleStationSelection}
      />

      <BwcView
        open={viewOpen}
        onOpenChange={setViewOpen}
        row={viewRow}
        fields={FIELDS}
        entityLabel={ENTITY_LABEL}
        totalLabel={TOTAL_LABEL}
        icon={ICON}
        onEdit={canManage ? () => viewRow && openEdit(viewRow) : undefined}
      />

      <ConfirmDialog
        open={existingRecordDialogOpen}
        onOpenChange={setExistingRecordDialogOpen}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-warning-soft"
        contentIconColorClass="text-warning"
        title={`${ENTITY_LABEL} Record Already Exists`}
        description={`A ${ENTITY_LABEL.toLowerCase()} record already exists for ${existingStationLabel || "this station"}. Do you want to open and edit the existing record?`}
        confirmLabel="Use Existing"
        showCancel
        onConfirm={handleExistingRecordConfirm}
      />

      <SecureDeleteDialog
        open={deleteRow != null}
        onOpenChange={(o) => !o && setDeleteRow(null)}
        subject={deleteRow ? `${deleteRow.stationname} — ${ENTITY_LABEL} record` : undefined}
        description="This permanently removes the bwc record for this station."
        deleting={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}