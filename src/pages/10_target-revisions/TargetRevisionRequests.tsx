import * as React from "react";
import {
  Filter,
  ShieldCheck,
  Eye,
  Check,
  X as XIcon,
  Ban,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MONTHS } from "@/lib/fsims-constants";
import { useAuth } from "@/lib/auth";
import { buildYears } from "@/lib/utils";

import RevisionStatusBadge from "@/pages/05_target-reference/revision/RevisionStatusBadge";
import ReasonRemarksDialog from "@/pages/05_target-reference/revision/ReasonRemarksDialog";
import { useRevisionStore } from "@/pages/05_target-reference/revision/useRevisionStore";
import {
  adminCancelRequest,
  approveRequest,
  denyRequest,
  getAuditForRequest,
  getSettings,
  isMonthLocked,
  listRequests,
  updateSettings,
} from "@/pages/05_target-reference/revision/mockStore";
import {
  REVISION_STATUS_LABEL,
  type RevisionRequest,
  type RevisionStatus,
} from "@/pages/05_target-reference/revision/types";

const STATUS_OPTIONS: (RevisionStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "APPROVED",
  "DENIED",
  "CANCELLED",
  "COMPLETED",
  "EXPIRED",
];

function fmtDT(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function AuditTimeline({ requestId }: { requestId: string }) {
  useRevisionStore();
  const entries = getAuditForRequest(requestId);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No audit entries.</p>;
  }
  return (
    <ol className="relative ml-2 border-l border-border/60">
      {entries.map((e) => (
        <li key={e.id} className="ml-4 py-2">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-primary bg-background" />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold">{e.action.replaceAll("_", " ")}</span>
            <span className="text-muted-foreground">by {e.actorName}</span>
            <span className="text-muted-foreground">· {fmtDT(e.createdAt)}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {e.oldStatus ?? "—"} → <strong>{e.newStatus}</strong>
          </div>
          {e.reason && (
            <div className="mt-1 text-xs">
              <span className="font-semibold">Reason:</span> {e.reason}
            </div>
          )}
          {e.remarks && (
            <div className="text-xs">
              <span className="font-semibold">Remarks:</span> {e.remarks}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  useRevisionStore();
  const s = getSettings();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Target Reference Settings
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Configure monthly locking behavior. Values apply immediately.
          </p>
        </DialogHeader>
        <div className="grid gap-3 px-5 py-4 text-xs">
        {[
          ["enableMonthlyLock", "Enable Monthly Lock"],
          ["allowRevisionRequests", "Allow Revision Requests"],
          ["requireAdministratorApproval", "Require Administrator Approval"],
          ["requireReason", "Require Reason"],
          ["autoRelockAfterSave", "Auto Relock After Save"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={Boolean((s as unknown as Record<string, unknown>)[key as string])}
              onChange={(e) => updateSettings({ [key]: e.target.checked } as never)}
            />
          </label>
        ))}
        <label className="flex items-center justify-between gap-3">
          <span>Lock Day of Following Month</span>
          <Input
            type="number"
            min={1}
            max={28}
            value={s.lockDayOfFollowingMonth}
            onChange={(e) =>
              updateSettings({
                lockDayOfFollowingMonth: Math.max(1, Math.min(28, Number(e.target.value) || 1)),
              })
            }
            className="h-8 w-20"
          />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Lock Time (server clock)</span>
          <Input
            type="time"
            value={s.lockTime}
            onChange={(e) => updateSettings({ lockTime: e.target.value || "23:59" })}
            className="h-8 w-32"
          />
        </label>
        </div>
        <DialogFooter className="border-t bg-muted/30 px-5 py-3">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TargetRevisionRequests() {
  useRevisionStore();
  const { user, systemAccess } = useAuth();
  const roleno = Number(systemAccess?.roleno ?? 0);
  const stationtype = Number(user?.stationtype ?? 0);
  const isAuthorizedAdmin =
    (roleno === 1 || roleno === 2) && (stationtype === 25 || stationtype === 26);

  // Defense-in-depth: even though the route guard already blocks unauthorized
  // users, re-check on render before exposing admin actions.
  const [status, setStatus] = React.useState<RevisionStatus | "ALL">("ALL");
  const [year, setYear] = React.useState<string>("all");
  const [month, setMonth] = React.useState<string>("all");
  const [province, setProvince] = React.useState("");
  const [station, setStation] = React.useState("");
  const [requestedBy, setRequestedBy] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [denyId, setDenyId] = React.useState<string | null>(null);
  const [cancelId, setCancelId] = React.useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const YEARS = React.useMemo(buildYears, []);

  const all = listRequests();

  const rows = all.filter((r) => {
    if (status !== "ALL" && r.status !== status) return false;
    if (year !== "all" && String(r.reportyear) !== year) return false;
    if (month !== "all" && String(r.reportmonth) !== month) return false;
    if (province && !r.provincename.toLowerCase().includes(province.toLowerCase()))
      return false;
    if (
      station &&
      !`${r.stationcode} ${r.stationname}`.toLowerCase().includes(station.toLowerCase())
    )
      return false;
    if (
      requestedBy &&
      !r.requestedByName.toLowerCase().includes(requestedBy.toLowerCase())
    )
      return false;
    if (dateFrom) {
      const t = Date.parse(r.requestedAt);
      if (!Number.isNaN(t) && t < Date.parse(dateFrom + "T00:00:00")) return false;
    }
    if (dateTo) {
      const t = Date.parse(r.requestedAt);
      if (!Number.isNaN(t) && t > Date.parse(dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const detail = detailId ? all.find((r) => r.id === detailId) : null;

  const handleApprove = (r: RevisionRequest) => {
    if (!isAuthorizedAdmin) return;
    const res = approveRequest(r.id, {
      userId: user?.memberno ?? "unknown",
      name: user?.fullname || user?.name || "Administrator",
    });
    if (!res.ok) toast.error(res.error);
    else toast.success("Request approved. Month temporarily unlocked.");
  };

  const monthName = (m: number) => MONTHS.find((x) => x.value === m)?.name ?? String(m);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Target Revision Requests
          </h1>
          <p className="text-xs text-muted-foreground">
            Review, approve, or deny revision requests submitted against locked
            Target Reference months.
          </p>
        </div>
        {isAuthorizedAdmin && (
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Settings
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-[11px]">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as never)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "ALL" ? "All statuses" : REVISION_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Province</Label>
            <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Contains…" className="h-9" />
          </div>
          <div>
            <Label className="text-[11px]">Station</Label>
            <Input value={station} onChange={(e) => setStation(e.target.value)} placeholder="Code or name…" className="h-9" />
          </div>
          <div>
            <Label className="text-[11px]">Requested By</Label>
            <Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} placeholder="Name…" className="h-9" />
          </div>
          <div>
            <Label className="text-[11px]">Date From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-[11px]">Date To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-border/60">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-muted/50 uppercase tracking-wider text-[10px] text-primary">
            <tr>
              {[
                "Status",
                "Requested",
                "Year",
                "Month",
                "Province",
                "City",
                "Station Code",
                "Station Name",
                "Requested By",
                "Reason",
                "Lock",
                "Reviewed By",
                "Reviewed",
                "Decision Remarks",
                "Actions",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap border-b border-border/60 px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={15} className="py-10 text-center text-muted-foreground">
                  No revision requests match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const locked = isMonthLocked(r.stationno, r.reportyear, r.reportmonth);
              return (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-2 py-1.5"><RevisionStatusBadge status={r.status} /></td>
                  <td className="whitespace-nowrap px-2 py-1.5">{fmtDT(r.requestedAt)}</td>
                  <td className="px-2 py-1.5">{r.reportyear}</td>
                  <td className="px-2 py-1.5">{monthName(r.reportmonth)}</td>
                  <td className="px-2 py-1.5">{r.provincename || "—"}</td>
                  <td className="px-2 py-1.5">{r.cityname || "—"}</td>
                  <td className="px-2 py-1.5">{r.stationcode || "—"}</td>
                  <td className="px-2 py-1.5">{r.stationname || "—"}</td>
                  <td className="px-2 py-1.5">{r.requestedByName}</td>
                  <td className="max-w-[240px] truncate px-2 py-1.5" title={r.reason}>{r.reason}</td>
                  <td className="px-2 py-1.5">{locked ? "Locked" : "Unlocked"}</td>
                  <td className="px-2 py-1.5">{r.reviewedByName || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{fmtDT(r.reviewedAt)}</td>
                  <td className="max-w-[200px] truncate px-2 py-1.5" title={r.decisionRemarks}>
                    {r.decisionRemarks || "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDetailId(r.id)}
                        title="View details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {isAuthorizedAdmin && r.status === "PENDING" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                            onClick={() => handleApprove(r)}
                            title="Approve"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-700 hover:bg-rose-50 dark:text-rose-300"
                            onClick={() => setDenyId(r.id)}
                            title="Deny"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelId(r.id)}
                            title="Cancel"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {isAuthorizedAdmin && r.status === "APPROVED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCancelId(r.id)}
                          title="Cancel"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Request Details
            </SheetTitle>
            {detail && (
              <SheetDescription>
                {detail.stationcode ? detail.stationcode + " · " : ""}
                {detail.stationname} · {monthName(detail.reportmonth)} {detail.reportyear}
              </SheetDescription>
            )}
          </SheetHeader>
          {detail && (
            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center gap-2">
                <RevisionStatusBadge status={detail.status} />
                <span className="text-muted-foreground">
                  Requested {fmtDT(detail.requestedAt)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><div className="text-muted-foreground">Requested By</div><div className="font-medium">{detail.requestedByName}</div></div>
                <div><div className="text-muted-foreground">Reviewed By</div><div className="font-medium">{detail.reviewedByName || "—"}</div></div>
                <div><div className="text-muted-foreground">Reviewed At</div><div className="font-medium">{fmtDT(detail.reviewedAt)}</div></div>
                <div><div className="text-muted-foreground">Completed At</div><div className="font-medium">{fmtDT(detail.completedAt)}</div></div>
              </div>
              <div>
                <div className="text-muted-foreground">Reason</div>
                <div className="rounded border border-border/60 bg-muted/30 p-2">{detail.reason || "—"}</div>
              </div>
              {detail.remarks && (
                <div>
                  <div className="text-muted-foreground">Remarks</div>
                  <div className="rounded border border-border/60 bg-muted/30 p-2">{detail.remarks}</div>
                </div>
              )}
              {detail.decisionReason && (
                <div>
                  <div className="text-muted-foreground">Decision Reason</div>
                  <div className="rounded border border-border/60 bg-muted/30 p-2">{detail.decisionReason}</div>
                </div>
              )}
              {detail.decisionRemarks && (
                <div>
                  <div className="text-muted-foreground">Decision Remarks</div>
                  <div className="rounded border border-border/60 bg-muted/30 p-2">{detail.decisionRemarks}</div>
                </div>
              )}
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Audit History
                </div>
                <AuditTimeline requestId={detail.id} />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Deny */}
      <ReasonRemarksDialog
        open={!!denyId}
        onOpenChange={(v) => !v && setDenyId(null)}
        title="Deny Revision Request"
        description="Provide the reason for denial. Both fields are required."
        reasonLabel="Reason for Denial"
        confirmLabel="Deny Request"
        confirmVariant="destructive"
        onConfirm={({ reason, remarks }) => {
          if (!denyId || !isAuthorizedAdmin) return;
          const res = denyRequest(denyId, {
            userId: user?.memberno ?? "unknown",
            name: user?.fullname || user?.name || "Administrator",
            reason,
            remarks,
          });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Request denied.");
            setDenyId(null);
          }
        }}
      />

      {/* Admin cancel */}
      <ReasonRemarksDialog
        open={!!cancelId}
        onOpenChange={(v) => !v && setCancelId(null)}
        title="Cancel Revision Request"
        description="Provide the reason for cancellation. Both fields are required."
        reasonLabel="Cancellation Reason"
        confirmLabel="Cancel Request"
        confirmVariant="destructive"
        onConfirm={({ reason, remarks }) => {
          if (!cancelId || !isAuthorizedAdmin) return;
          const res = adminCancelRequest(cancelId, {
            userId: user?.memberno ?? "unknown",
            name: user?.fullname || user?.name || "Administrator",
            reason,
            remarks,
          });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Request cancelled.");
            setCancelId(null);
          }
        }}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}