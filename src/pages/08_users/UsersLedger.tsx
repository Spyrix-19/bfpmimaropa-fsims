import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Users, ShieldCheck, ShieldOff, Slash, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import GentableSearchSelect from "@/components/gentable-search-select";
import SearchKey from "@/components/search-key";
import PaginationControls from "@/components/pagination";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { useAuth, FSIMS_SYSTEMNO, resolveLocationScope } from "@/lib/auth";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import { userAPI } from "@/services/userAPI";
import type { UserModel, UserParams } from "@/types/userType";
import { subscribeUsers, emitUsersChanged } from "./usersBus";

type Variant = "available" | "active";

type Props = {
  variant: Variant;
  title: string;
  description: string;
};

/**
 * Province / Station editability follows the FSIMS authorization matrix:
 * - Role 1 (SUPER)                   → both editable
 * - stationtype 25 or 26             → both editable
 * - stationtype 27 + Role 3 (PERSONNEL) → both fixed
 * - stationtype 27 + non-PERSONNEL   → province fixed, station editable (scoped)
 * - stationtype 28-31                → both fixed
 */
function useFilterPermissions() {
  const { user, systemAccess } = useAuth();
  return React.useMemo(() => {
    const scope = resolveLocationScope(user, systemAccess?.roleno ?? 0);
    return {
      provinceEditable: !scope.provinceLocked,
      stationEditable: !scope.stationLocked,
    };
  }, [user, systemAccess]);
}

export default function UsersLedger({ variant, title, description }: Props) {
  const { user, systemAccess, isAdministrator } = useAuth();
  const { provinceEditable, stationEditable } = useFilterPermissions();

  // Filters — seed province/station from the authenticated user when fixed.
  const [provinceno, setProvinceno] = React.useState<string>(
    provinceEditable ? EMPTY_GUID : user?.provinceno || EMPTY_GUID,
  );
  const [provincename, setProvincename] = React.useState<string>(
    provinceEditable ? "" : user?.provincename || "",
  );
  const [stationno, setStationno] = React.useState<string>(
    stationEditable ? EMPTY_GUID : user?.stationno || EMPTY_GUID,
  );
  const [stationname, setStationname] = React.useState<string>(
    stationEditable ? "" : user?.stationname || "",
  );
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const [rows, setRows] = React.useState<UserModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [refreshTick, setRefreshTick] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

  const [target, setTarget] = React.useState<UserModel | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [activateTarget, setActivateTarget] = React.useState<UserModel | null>(null);
  const [selectedRole, setSelectedRole] = React.useState<string>("");
  const [selectedRoleName, setSelectedRoleName] = React.useState<string>("");
  const [activateConfirmOpen, setActivateConfirmOpen] = React.useState(false);
  const canShowSuperRole = React.useMemo(() => {
    const currentRole = systemAccess?.roleno ?? 0;
    const selectedStationType = activateTarget?.stationtype ?? 0;
    const restrictedStationTypes = [27, 28, 29, 30, 31];
    if (restrictedStationTypes.includes(selectedStationType)) return false;
    return currentRole === 1;
  }, [activateTarget?.stationtype, systemAccess?.roleno]);
  const filterAccountRoleRows = React.useCallback(
    (rows: import("@/types/gentableType").SearchGentableModel[]) =>
      rows.filter((row) => {
        const code = String(row.recordcode ?? "").trim().toUpperCase();
        const desc = String(row.description ?? "").trim().toUpperCase();
        const isSuperRow =
          code === "SUPER" ||
          desc === "SUPER ADMINISTRATOR" ||
          desc === "SUPER ADMIN" ||
          desc.includes("SUPER ADMINISTRATOR") ||
          desc.includes("SUPER ADMIN");
        return isSuperRow ? canShowSuperRole : true;
      }),
    [canShowSuperRole],
  );

  React.useEffect(() => subscribeUsers(refresh), [refresh]);

  // Load ledger. Server-side searchkey + provinceno; station is filtered locally
  // when the API doesn't accept a stationno filter.
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params: UserParams = {
        searchkey: search,
        systemno: FSIMS_SYSTEMNO,
        provinceno: provinceno && provinceno !== EMPTY_GUID ? provinceno : EMPTY_GUID,
        regionno: user.regionno || MIMAROPA_REGION_CODE,
        pageNumber: 1,
        pageSize: 1000,
      };
      const call =
        variant === "available"
          ? userAPI.getLedger(params, { suppressGlobalLoading: true })
          : userAPI.getActivatedLedger(params, { suppressGlobalLoading: true });
      const resp = await call;
      const { ok, data, error } = unwrap<UserModel[]>(resp);
      if (cancelled) return;
      if (!ok) {
        toast.error(error || "Unable to load users.");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, user, search, provinceno, refreshTick]);

  const filtered = React.useMemo(() => {
    if (!stationno || stationno === EMPTY_GUID) return rows;
    return rows.filter((r) => r.stationno === stationno);
  }, [rows, stationno]);

  React.useEffect(() => {
    setPage(1);
  }, [search, provinceno, stationno, pageSize]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const askConfirm = (r: UserModel) => {
    if (variant === "available") {
      setActivateTarget(r);
      setSelectedRole("");
      setSelectedRoleName("");
      return;
    }
    setTarget(r);
  };
  const confirm = async () => {
    if (!target || !user) return;
    setBusy(true);
    try {
      const resp =
        variant === "available"
          ? await userAPI.activate({
              accessno: target.accessno,
              memberno: target.memberno,
              systemno: FSIMS_SYSTEMNO,
              hasaccess: true,
              accountrole: target.roleno || 3,
              updatedby: user.memberno,
            })
          : await userAPI.deactivate({
              accessno: target.accessno,
              updatedby: user.memberno,
            });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(
          error ||
            (variant === "available"
              ? "Unable to activate user."
              : "Unable to deactivate user."),
        );
        return;
      }
      toast.success(
        variant === "available"
          ? `${target.fullname} has been activated.`
          : `${target.fullname} has been deactivated.`,
      );
      setTarget(null);
      refresh();
      emitUsersChanged();
    } finally {
      setBusy(false);
    }
  };

  const activateConfirmed = async () => {
    if (!activateTarget || !user) return;
    setBusy(true);
    try {
      const resp = await userAPI.activate({
        accessno: activateTarget.accessno,
        memberno: activateTarget.memberno,
        systemno: FSIMS_SYSTEMNO,
        hasaccess: true,
        accountrole: Number(selectedRole) || activateTarget.roleno || 3,
        updatedby: user.memberno,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to activate user.");
        return;
      }
      toast.success(`${activateTarget.fullname} has been activated.`);
      setActivateConfirmOpen(false);
      setActivateTarget(null);
      refresh();
      emitUsersChanged();
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const actionLabel = variant === "available" ? "Activate" : "Deactivate";
  const ActionIcon = variant === "available" ? ShieldCheck : ShieldOff;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="grid gap-3 border-border/60 p-4 md:grid-cols-2 lg:grid-cols-3">
        <FilterField label="Search">
          <SearchKey
            value={search}
            onChange={setSearch}
            placeholder="Search name, badge, rank…"
            widthClass="w-full"
          />
        </FilterField>
        <FilterField label="Province">
          <LocationSearchSelect
            value={provinceno}
            valueName={provincename}
            locationtype="PROVINCE"
            parentcode={MIMAROPA_REGION_CODE}
            showAllOption
            hideCode
            readOnly={!provinceEditable}
            onChange={(no, name) => {
              setProvinceno(no);
              setProvincename(name);
              // Reset station when province changes
              setStationno(EMPTY_GUID);
              setStationname("");
            }}
            placeholder="Select province"
          />
        </FilterField>
        <FilterField label="Station">
          <StationSearchSelect
            value={stationno}
            valueName={stationname}
            provinceno={provinceno && provinceno !== EMPTY_GUID ? provinceno : undefined}
            showAllOption
            readOnly={!stationEditable}
            disabled={
              stationEditable && (!provinceno || provinceno === EMPTY_GUID)
            }
            onChange={(no, name) => {
              setStationno(no);
              setStationname(name);
            }}
            placeholder={
              stationEditable && (!provinceno || provinceno === EMPTY_GUID)
                ? "Select province first"
                : "Select station"
            }
          />
        </FilterField>
      </Card>

      {loading ? (
        <Card className="flex items-center justify-center gap-2 border-border/60 p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
        </Card>
      ) : paged.length === 0 ? (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          {variant === "available"
            ? "No available users match the current filters."
            : "No active users match the current filters."}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-4 md:hidden">
            {paged.map((r) => {
              const disabled = variant === "active" && isAdministrator() && r.roleno === 1;
              const displayName = `${r.rankcode ? `${r.rankcode} ` : ""}${r.fullname}`;
              return (
                <Card
                  key={r.accessno || `${r.memberno}-${r.systemno}`}
                  className="flex flex-col overflow-hidden border-border/60 shadow-soft transition-shadow hover:shadow-elegant"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
                    <AvatarWithFallback
                      entity={r}
                      src={r.profileurl || undefined}
                      name={r.fullname}
                      className="h-14 w-14 shrink-0 rounded-full ring-2 ring-primary/20"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary tabular-nums">
                          {r.badgeno || "—"}
                        </span>
                        {variant === "active" && r.rolename ? (
                          <span className="inline-flex items-center rounded-full tone-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {r.rolename}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 truncate text-sm font-bold">{displayName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.stationname || "—"} · {r.provincename || "—"}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="flex-1 space-y-3 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-card/80 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          Station
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <AvatarWithFallback
                            src={r.logourl || undefined}
                            name={r.stationname}
                            className="h-8 w-8 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-foreground">
                              {r.stationname || "—"}
                            </div>
                            <div className="truncate text-[10px] text-muted-foreground">
                              {r.stationcode || "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-card/80 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                          Province
                        </div>
                        <div className="mt-2 truncate text-xs font-semibold text-foreground">
                          {r.provincename || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer with action */}
                  <div className="flex items-center justify-end gap-2 border-t bg-muted/20 p-2">
                    {disabled ? (
                      <Button size="sm" disabled className="gap-1.5">
                        <Slash className="h-4 w-4" />
                        {actionLabel}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant={variant === "available" ? "default" : "destructive"}
                        onClick={() => askConfirm(r)}
                        className="gap-1.5"
                      >
                        <ActionIcon className="h-4 w-4" />
                        {actionLabel}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>


          <Card className="overflow-hidden border-border/60 shadow-soft hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Action</th>
                    <th className="px-3 py-2 text-left font-semibold">Member Name</th>
                    {variant === "available" ? null : (
                      <th className="px-3 py-2 text-left font-semibold">Role</th>
                    )}
                    <th className="px-3 py-2 text-left font-semibold">Stations</th>
                    <th className="px-3 py-2 text-left font-semibold">Province</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr
                      key={r.accessno || `${r.memberno}-${r.systemno}`}
                      className="border-t border-border/60 hover:bg-muted/30"
                    >
                      <td className="px-3 py-2">
                        {variant === "active" && isAdministrator() && r.roleno === 1 ? (
                          <Button size="sm" disabled className="gap-1.5">
                            <Slash className="h-4 w-4" />
                            {actionLabel}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={variant === "available" ? "default" : "destructive"}
                            onClick={() => askConfirm(r)}
                            className="gap-1.5"
                          >
                            <ActionIcon className="h-4 w-4" />
                            {actionLabel}
                          </Button>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <AvatarWithFallback
                            entity={r}
                            src={r.profileurl || undefined}
                            name={r.fullname}
                            className="h-8 w-8 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <div className="truncate font-medium">
                                {r.rankcode ? `${r.rankcode} ` : ""}
                                {r.fullname}
                              </div>
                            </div>
                            <div className="text-[12px] text-muted-foreground tabular-nums">{r.badgeno || "—"}</div>
                          </div>
                        </div>
                      </td>

                      {variant === "available" ? null : (
                        <td className="px-3 py-2">
                          {r.rolename ? (
                            <div className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                              {r.rolename}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}

                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <AvatarWithFallback
                            src={r.logourl || undefined}
                            name={r.stationname}
                            className="h-8 w-8 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="truncate">{r.stationname || "—"}</div>
                            <div className="truncate text-[11px] text-muted-foreground">{r.stationcode || "—"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2 text-muted-foreground">{r.provincename || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="border-t border-border/60 pt-3">
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        ContentIcon={AlertTriangle}
        contentIconBgClass={variant === "available" ? "tone-warning-soft" : "tone-danger-soft"}
        contentIconColorClass={variant === "available" ? "text-warning" : "text-destructive"}
        title={variant === "available" ? "Activate User?" : "Deactivate User?"}
        description={
          target
            ? variant === "available"
              ? `Grant ${target.fullname} access to FSIMS?`
              : `Revoke ${target.fullname}'s access to FSIMS?`
            : ""
        }
        confirmLabel={
          busy
            ? variant === "available"
              ? "Activating…"
              : "Deactivating…"
            : actionLabel
        }
        confirmVariant={variant === "available" ? "success" : "destructive"}
        onConfirm={confirm}
      />

      {/* Activation modal: select role before activating */}
      <Dialog open={!!activateTarget} onOpenChange={(o) => !o && setActivateTarget(null)}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] w-full max-w-[min(100vw-1rem,640px)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm sm:h-11 sm:w-11">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-base font-semibold text-foreground sm:text-lg">
                  Activate User
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground/90 sm:text-sm">
                  Assign a role to the user before activation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activateTarget ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                  <Card className="min-w-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-xs">
                      Personnel Information
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <AvatarWithFallback
                        entity={activateTarget}
                        src={activateTarget.profileurl || undefined}
                        name={activateTarget.fullname}
                        className="h-12 w-12 shrink-0 sm:h-14 sm:w-14"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {activateTarget.rankcode ? `${activateTarget.rankcode} ` : ""}
                          {activateTarget.fullname}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground tabular-nums sm:text-sm">
                          {activateTarget.badgeno || "—"}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="min-w-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-xs">
                      Station Information
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <AvatarWithFallback
                        src={activateTarget.logourl || undefined}
                        name={activateTarget.stationname}
                        className="h-10 w-10 shrink-0 sm:h-12 sm:w-12"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {activateTarget.stationname || "—"}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground tabular-nums sm:text-sm">
                          {activateTarget.stationcode || "—"}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="min-w-0 rounded-2xl border border-border/70 bg-background p-3 shadow-sm sm:p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground sm:text-xs">
                    Role Selection
                  </div>
                  <div className="mt-3">
                    <GentableSearchSelect
                      tablename="ACCOUNT ROLE"
                      value={selectedRole}
                      valueName={selectedRoleName}
                      onChange={(detno, description) => {
                        setSelectedRole(detno);
                        setSelectedRoleName(description);
                      }}
                      placeholder="Select role"
                      hideCode
                      rowFilter={filterAccountRoleRows}
                    />
                  </div>
                </Card>
              </div>

              <DialogFooter className="shrink-0 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
                <Button
                  variant="outline"
                  onClick={() => setActivateTarget(null)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  disabled={!selectedRole}
                  onClick={() => setActivateConfirmOpen(true)}
                  className="w-full sm:w-auto"
                >
                  Activate
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={activateConfirmOpen}
        onOpenChange={(o) => !o && setActivateConfirmOpen(false)}
        title={activateTarget ? `Activate ${activateTarget.fullname}?` : "Activate user?"}
        description={
          activateTarget
            ? `This will assign the role "${selectedRoleName || "(unspecified)"}" to ${activateTarget.fullname} and activate the account.`
            : "Confirm activation."
        }
        ContentIcon={ShieldCheck}
        confirmLabel={busy ? "Activating…" : "Activate"}
        confirmVariant="success"
        onConfirm={activateConfirmed}
      />
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
