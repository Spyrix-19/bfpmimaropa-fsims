import * as React from "react";
import { ShieldCheck, Check, X as XIcon, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { MIMAROPA_REGION_CODE, MONTHS } from "@/lib/fsims-constants";
import { LocationMultiSelect, type SelectedLocation } from "@/components/location-multi-select";
import { StationMultiSelect, type SelectedStation } from "@/components/station-multi-select";
import { Button } from "@/components/ui/button";
import FilterField from "@/components/filter-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTHS as MONTHS_CONST } from "@/lib/fsims-constants";
import { useAuth } from "@/lib/auth";
import { buildYears } from "@/lib/utils";
import ResetFiltersButton from "@/components/reset-filters-button";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import PaginationControls from "@/components/pagination";
import { usePagination } from "@/hooks/usePagination";
import { STATUS_PILL_BASE, statusTone } from "@/lib/theme";
import { formatDate, formatDateTime } from "@/lib/date-format";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import ConfirmDialog from "@/components/ui/confirm-dialog";

import ReasonRemarksDialog from "@/pages/06_target-reference/revision/ReasonRemarksDialog";
import { type RevisionModule } from "@/pages/06_target-reference/revision/types";

import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";

interface TargetRevisionRequestsProps {
  /** Restrict the ledger to a specific source module. Omit to show all. */
  moduleFilter?: RevisionModule;
  /** Optional override for the page heading. */
  title?: string;
  /** Optional override for the subheading. */
  description?: string;
}

const STATUS_APPROVED = 153;
const STATUS_REJECTED = 154;
const STATUS_CANCELLED = 155;

/** Map source module → API RequestType. */
function requestTypeFor(module: RevisionModule): string {
  if (module === "monitoring") return "COMPLIANCE";
  if (module === "notice") return "NOTICE";
  return "TARGET";
}

function monthYearLabel(year: number, month: number): string {
  const name = MONTHS.find((m) => m.value === Number(month))?.name ?? "";
  return `${name} ${year}`.toUpperCase().trim();
}

export default function TargetRevisionRequests({
  moduleFilter,
  title,
  description,
}: TargetRevisionRequestsProps = {}) {
  const { user, systemAccess } = useAuth();
  const roleno = Number(systemAccess?.roleno ?? 0);
  const stationtype = Number(user?.stationtype ?? 0);
  const isAuthorizedAdmin =
    (roleno === 1 || roleno === 2) && (stationtype === 25 || stationtype === 26);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = React.useState<string>(String(currentYear));
  const [month, setMonth] = React.useState<string>("all");
  const [provinces, setProvinces] = React.useState<SelectedLocation[]>([]);
  const [stations, setStations] = React.useState<SelectedStation[]>([]);
  const [activeTab, setActiveTab] = React.useState<RevisionModule>(
    moduleFilter ?? "target-reference",
  );
  const effectiveModule: RevisionModule = moduleFilter ?? activeTab;

  const YEARS = React.useMemo(buildYears, []);
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

  const [rows, setRows] = React.useState<FSISEditRequestModel[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  // Reset page when filters/module change.
  React.useEffect(() => {
    setPage(1);
  }, [year, month, provinces, stations, effectiveModule, pageSize, setPage]);

  // Fetch ledger via API.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const stationno = stations.length === 1 ? stations[0].stationno : EMPTY_GUID;
      const provinceno = provinces.length === 1 ? provinces[0].locationno : EMPTY_GUID;
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno,
          reportyear: year !== "all" ? Number(year) : 0,
          reportmonth: month !== "all" ? Number(month) : 0,
          provinceno,
          requesttype: requestTypeFor(effectiveModule),
          pagenumber: page,
          pagesize: pageSize,
        },
        { suppressGlobalLoading: true },
      );
      if (cancelled) return;
      const { ok, data, total: t, error } = unwrap<FSISEditRequestModel[]>(resp);
      if (!ok) {
        toast.error(error || "Unable to load revision requests.");
        setRows([]);
        setTotal(0);
      } else {
        let list = Array.isArray(data) ? data : [];
        // Client-side narrowing when user selected multiple provinces/stations,
        // since the API accepts a single filter.
        if (provinces.length > 1) {
          const allow = new Set(provinces.map((p) => p.locationno));
          list = list.filter((r) => allow.has(r.provinceno));
        }
        if (stations.length > 1) {
          const allow = new Set(stations.map((s) => s.stationno));
          list = list.filter((r) =>
            allow.has((r as unknown as { stationno?: string }).stationno ?? ""),
          );
        }
        setRows(list);
        setTotal(t || list.length);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month, provinces, stations, effectiveModule, page, pageSize, refreshTick]);

  const handleResetFilters = () => {
    setYear(String(currentYear));
    setMonth("all");
    setProvinces([]);
    setStations([]);
  };

  // Row action state.
  const [rejectTarget, setRejectTarget] = React.useState<FSISEditRequestModel | null>(null);
  const [approveTarget, setApproveTarget] = React.useState<FSISEditRequestModel | null>(null);
  const [busy, setBusy] = React.useState(false);

  const dateColumnHeader =
    effectiveModule === "monitoring"
      ? "Inspected Date"
      : effectiveModule === "notice"
        ? "Date Accomplished"
        : "Target Date";

  const doStatus = async (r: FSISEditRequestModel, statusno: number, remarks: string) => {
    setBusy(true);
    try {
      const stationno = r.stationno ?? "";
      const resp = await revisionrequestAPI.status({
        requestno: r.requestno,
        stationno,
        requesttype: r.requesttype,
        remarks,
        statusno,
        taggedby: user?.memberno ?? "",
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to update request.");
        return false;
      }
      const label =
        statusno === STATUS_APPROVED
          ? "Request approved."
          : statusno === STATUS_REJECTED
            ? "Request rejected."
            : "Request cancelled.";
      toast.success(label);
      refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title ?? "Target Revision Requests"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {description ??
              "Review, approve, or deny revision requests submitted against locked Target Reference months."}
          </p>
        </div>
      </div>

      {!moduleFilter && (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 p-1">
          {(
            [
              { value: "target-reference", label: "Target Reference" },
              { value: "monitoring", label: "Monitoring (Compliance)" },
              { value: "notice", label: "Accomplished Notice" },
            ] as { value: RevisionModule; label: string }[]
          ).map((t) => {
            const active = activeTab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setActiveTab(t.value)}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground hover:shadow-sm"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterField label="Year">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Month">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS_CONST.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Provinces">
            <LocationMultiSelect
              mode="location"
              value={provinces}
              locationtype="PROVINCE"
              parentcode={MIMAROPA_REGION_CODE}
              onChange={(sel) => {
                setProvinces(sel);
                if (sel.length > 0) {
                  const allowed = new Set(sel.map((p) => p.locationno));
                  setStations((prev) => prev.filter((s) => allowed.has(s.provinceno)));
                }
              }}
              placeholder="All provinces"
              hideCode
              className="h-9"
            />
          </FilterField>
          <FilterField label="Stations">
            <StationMultiSelect
              mode="station"
              value={stations}
              provinces={provinces.map((p) => ({ provinceno: p.locationno }))}
              reportyear={year !== "all" ? Number(year) : 0}
              onChange={setStations}
              placeholder="All stations"
              alwaysEnabled
              className="h-9"
            />
          </FilterField>
          <div className="flex items-end justify-end">
            <ResetFiltersButton onReset={handleResetFilters} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-border/60">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-muted/50 uppercase tracking-wider text-[10px] text-primary">
            <tr>
              {["Action", "Station", dateColumnHeader, "Status", "Requested", "Remarks"].map(
                (h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap border-b border-border/60 px-3 py-2 text-left font-semibold"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </span>
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  No revision requests match the current filters.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => {
                const isPending = String(r.statuscode ?? "").toUpperCase() === "PENDING";
                const isApproved = String(r.statuscode ?? "").toUpperCase() === "APPROVED";
                return (
                  <tr
                    key={r.requestno}
                    className="border-b border-border/40 hover:bg-muted/30 align-top"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {isAuthorizedAdmin && isPending && (
                          <>
                            <EditButton
                              variant="square"
                              tooltip="Approve Request"
                              ariaLabel="Approve Request"
                              icon={<Check className="h-4 w-4" />}
                              onClick={() => setApproveTarget(r)}
                            />
                            <DeleteButton
                              variant="square"
                              tooltip="Reject Request"
                              ariaLabel="Reject Request"
                              icon={<XIcon className="h-4 w-4" />}
                              onClick={() => setRejectTarget(r)}
                            />
                          </>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AvatarWithFallback
                          src={r.logourl || undefined}
                          name={r.stationname}
                          className="h-8 w-8 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="truncate">{r.stationname || "—"}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {r.stationcode || "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">
                      {["ISSUANCE", "NOTICE"].includes(String(r.requesttype ?? "").toUpperCase())
                        ? formatDate(r.dateinspected, "—")
                        : r.dateinspected
                          ? formatDate(r.dateinspected, "—")
                          : monthYearLabel(r.reportyear, r.reportmonth)}
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={cn(STATUS_PILL_BASE, statusTone(r.statuscode || r.statusname))}
                      >
                        {r.statusname || r.statuscode || "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <div className="font-medium">{r.requestedbyname || r.fullname || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDateTime(r.daterequested, "—")}
                      </div>
                    </td>

                    <td className="px-3 py-2 whitespace-pre-wrap break-words max-w-[320px]">
                      {r.remarks || "—"}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border/60 pt-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Approve confirm */}
      <ConfirmDialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
        title="Approve Revision Request?"
        description={
          approveTarget
            ? `Approve the revision request for ${approveTarget.stationname} — ${monthYearLabel(
                approveTarget.reportyear,
                approveTarget.reportmonth,
              )}?`
            : ""
        }
        ContentIcon={Check}
        contentIconBgClass="tone-success-soft"
        contentIconColorClass="text-success"
        confirmLabel={busy ? "Approving…" : "Approve"}
        confirmVariant="success"
        onConfirm={async () => {
          if (!approveTarget) return;
          const ok = await doStatus(approveTarget, STATUS_APPROVED, approveTarget.remarks || "");
          if (ok) setApproveTarget(null);
        }}
      />

      {/* Reject */}
      <ReasonRemarksDialog
        open={!!rejectTarget}
        onOpenChange={(v) => !v && setRejectTarget(null)}
        title="Reject Revision Request"
        description="Provide the reason for rejection. Both fields are required."
        reasonLabel="Reason for Rejection"
        confirmLabel="Reject Request"
        confirmVariant="destructive"
        onConfirm={async ({ reason, remarks }) => {
          if (!rejectTarget) return;
          const combined = [reason, remarks].filter(Boolean).join(" — ");
          const ok = await doStatus(rejectTarget, STATUS_REJECTED, combined);
          if (ok) setRejectTarget(null);
        }}
      />
    </div>
  );
}
