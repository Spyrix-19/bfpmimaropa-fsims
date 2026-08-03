import * as React from "react";
import { usePagination } from "@/hooks/usePagination";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import {
  Loader2,
  Users,
  ShieldCheck,
  ShieldOff,
  Slash,
  AlertTriangle,
  UserCog,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import GentableSearchSelect from "@/components/gentable-search-select";
import OptionButton from "@/components/option-button";
import OfficeSearchSelect from "@/components/office-search-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SearchKey from "@/components/search-key";
import PaginationControls from "@/components/pagination";
import LocationSearchSelect from "@/components/location-search-select";
import StationSearchSelect from "@/components/station-search-select";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import FilterField from "@/components/filter-field";
import ResetFiltersButton from "@/components/reset-filters-button";
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
  const { page, setPage, pageSize, setPageSize } = usePagination({ initialPageSize: 10 });

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

  // Role-update dialog (active users only)
  const [roleTarget, setRoleTarget] = React.useState<UserModel | null>(null);
  const [newRole, setNewRole] = React.useState<string>("");
  const [newRoleName, setNewRoleName] = React.useState<string>("");

  // Station-assignment dialog (active users only)
  const [stationTarget, setStationTarget] = React.useState<UserModel | null>(null);
  const [newStationno, setNewStationno] = React.useState<string>("");
  const [newStationname, setNewStationname] = React.useState<string>("");
  const [newOfficeno, setNewOfficeno] = React.useState<string>("");
  const [newOfficename, setNewOfficename] = React.useState<string>("");
  const [newDesignation, setNewDesignation] = React.useState<string>("");

  const currentRoleNo = systemAccess?.roleno ?? 0;

  /**
   * Account-role options follow the authorization matrix:
   * - SUPER (1)     → all roles (SUPER hidden for restricted station types)
   * - ADMIN (2)     → everything except SUPER
   * - PERSONNEL (3) → PERSONNEL only
   */
  const makeRoleFilter = React.useCallback(
    (stationtype: number | undefined) =>
      (rows: import("@/types/gentableType").SearchGentableModel[]) =>
        rows.filter((row) => {
          const code = String(row.recordcode ?? "").trim().toUpperCase();
          const desc = String(row.description ?? "").trim().toUpperCase();
          const isSuperRow =
            code === "SUPER" || desc.includes("SUPER ADMIN");
          const isPersonnelRow =
            code === "PERSONNEL" || desc.includes("PERSONNEL");

          if (currentRoleNo === 3) return isPersonnelRow;
          if (isSuperRow) {
            if (currentRoleNo !== 1) return false;
            const restricted = [27, 28, 29, 30, 31];
            return !restricted.includes(Number(stationtype ?? 0));
          }
          return true;
        }),
    [currentRoleNo],
  );

  const filterAccountRoleRows = React.useMemo(
    () => makeRoleFilter(activateTarget?.stationtype),
    [makeRoleFilter, activateTarget?.stationtype],
  );
  const filterUpdateRoleRows = React.useMemo(
    () => makeRoleFilter(roleTarget?.stationtype),
    [makeRoleFilter, roleTarget?.stationtype],
  );

  const openRoleDialog = (r: UserModel) => {
    setRoleTarget(r);
    setNewRole(r.roleno ? String(r.roleno) : "");
    setNewRoleName(r.rolename || "");
  };

  const openStationDialog = (r: UserModel) => {
    setStationTarget(r);
    setNewStationno(r.stationno || "");
    setNewStationname(r.stationname || "");
    setNewOfficeno("");
    setNewOfficename("");
    setNewDesignation("");
  };

  const submitRoleUpdate = async () => {
    if (!roleTarget || !user || !newRole) return;
    setBusy(true);
    try {
      const resp = await userAPI.UpdateAccountRole({
        memberno: roleTarget.memberno,
        accessno: roleTarget.accessno,
        accountrole: Number(newRole),
        updatedby: user.memberno,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to update account role.");
        return;
      }
      toast.success(`${roleTarget.fullname}'s role updated to ${newRoleName}.`);
      setRoleTarget(null);
      refresh();
      emitUsersChanged();
    } finally {
      setBusy(false);
    }
  };

  const submitStationUpdate = async () => {
    if (!stationTarget || !user || !newStationno) return;
    setBusy(true);
    try {
      const resp = await userAPI.updateStation({
        memberno: stationTarget.memberno,
        stationno: newStationno,
        officeno: Number(newOfficeno) || 0,
        designation: newDesignation,
        updatedby: user.memberno,
      });
      const { ok, error } = unwrap(resp);
      if (!ok) {
        toast.error(error || "Unable to update station assignment.");
        return;
      }
      toast.success(`${stationTarget.fullname} reassigned to ${newStationname}.`);
      setStationTarget(null);
      refresh();
      emitUsersChanged();
    } finally {
      setBusy(false);
    }
  };

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

  const handleResetFilters = () => {
    setSearch("");
    setProvinceno(provinceEditable ? EMPTY_GUID : user?.provinceno || EMPTY_GUID);
    setProvincename(provinceEditable ? "" : user?.provincename || "");
    setStationno(stationEditable ? EMPTY_GUID : user?.stationno || EMPTY_GUID);
    setStationname(stationEditable ? "" : user?.stationname || "");
    setPage(1);
  };

  const RowOptions = ({ r }: { r: UserModel }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <OptionButton variant="circle" tooltip="More options" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs">Manage user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openRoleDialog(r)} className="gap-2">
          <UserCog className="h-4 w-4" />
          Update Account Role
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openStationDialog(r)} className="gap-2">
          <Building2 className="h-4 w-4" />
          Update Station Assignment
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
      <Card className="border-border/60 p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex items-end justify-end md:justify-start lg:justify-end">
            <ResetFiltersButton onReset={handleResetFilters} />
          </div>
        </div>
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
                    {variant === "active" ? <RowOptions r={r} /> : null}
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
                        <div className="flex items-center gap-1">
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
                          {variant === "active" ? <RowOptions r={r} /> : null}
                        </div>
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
        <DialogContent className="flex max-h-[calc(100vh-1rem)] w-full max-w-[min(100vw-1rem,680px)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  Activate User
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Assign a role to the user before activation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activateTarget ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div className="space-y-4 p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-none">
                    <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                      Personnel Information
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <AvatarWithFallback
                        entity={activateTarget}
                        src={activateTarget.profileurl || undefined}
                        name={activateTarget.fullname}
                        className="h-12 w-12 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-snug text-foreground break-words">
                          {activateTarget.rankcode ? `${activateTarget.rankcode} ` : ""}
                          {activateTarget.fullname}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground tabular-nums">
                          Badge {activateTarget.badgeno || "—"}
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-none">
                    <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                      Station Information
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <AvatarWithFallback
                        src={activateTarget.logourl || undefined}
                        name={activateTarget.stationname}
                        className="h-12 w-12 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-snug text-foreground break-words">
                          {activateTarget.stationname || "—"}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {activateTarget.stationcode || "—"}
                          {activateTarget.provincename ? ` · ${activateTarget.provincename}` : ""}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <Card className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-none">
                  <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Role Selection
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Determines what this member can access in FSIMS.
                  </p>
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

              <DialogFooter className="shrink-0 flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3">
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

      {/* Update Account Role */}
      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="w-full max-w-[min(100vw-1rem,560px)] gap-0 overflow-hidden p-0 sm:rounded-lg">
          <DialogHeader className="border-b border-border bg-muted/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Update Account Role
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Change the FSIMS access level for this member.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {roleTarget ? (
            <div className="space-y-4 p-5">
              <Card className="rounded-lg border border-border bg-card p-4 shadow-none">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Personnel Information
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <AvatarWithFallback
                    entity={roleTarget}
                    src={roleTarget.profileurl || undefined}
                    name={roleTarget.fullname}
                    className="h-12 w-12 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug break-words">
                      {roleTarget.rankcode ? `${roleTarget.rankcode} ` : ""}
                      {roleTarget.fullname}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Current role: {roleTarget.rolename || "—"}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="rounded-lg border border-border bg-card p-4 shadow-none">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  New Account Role
                </div>
                <div className="mt-3">
                  <GentableSearchSelect
                    tablename="ACCOUNT ROLE"
                    value={newRole}
                    valueName={newRoleName}
                    onChange={(detno, description) => {
                      setNewRole(detno);
                      setNewRoleName(description);
                    }}
                    placeholder="Select role"
                    hideCode
                    rowFilter={filterUpdateRoleRows}
                  />
                </div>
              </Card>
            </div>
          ) : null}
          <DialogFooter className="flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setRoleTarget(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              disabled={!newRole || busy}
              onClick={submitRoleUpdate}
              className="w-full sm:w-auto"
            >
              {busy ? "Saving…" : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Station Assignment */}
      <Dialog open={!!stationTarget} onOpenChange={(o) => !o && setStationTarget(null)}>
        <DialogContent className="flex max-h-[calc(100vh-1rem)] w-full max-w-[min(100vw-1rem,620px)] flex-col gap-0 overflow-hidden p-0 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-muted/40 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Update Station Assignment
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Reassign this member to another station or office.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {stationTarget ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <Card className="rounded-lg border border-border bg-card p-4 shadow-none">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Current Assignment
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <AvatarWithFallback
                    src={stationTarget.logourl || undefined}
                    name={stationTarget.stationname}
                    className="h-12 w-12 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold leading-snug break-words">
                      {stationTarget.stationname || "—"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {stationTarget.stationcode || "—"}
                      {stationTarget.provincename ? ` · ${stationTarget.provincename}` : ""}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-none">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Station
                  </label>
                  <div className="mt-2">
                    <StationSearchSelect
                      value={newStationno}
                      valueName={newStationname}
                      onChange={(no, name) => {
                        setNewStationno(no);
                        setNewStationname(name);
                      }}
                      placeholder="Select station"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Office
                  </label>
                  <div className="mt-2">
                    <OfficeSearchSelect
                      value={newOfficeno || undefined}
                      valueName={newOfficename}
                      onChange={(detno, name) => {
                        setNewOfficeno(detno);
                        setNewOfficename(name);
                      }}
                      placeholder="Select office"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                    Designation
                  </label>
                  <Textarea
                    className="mt-2 min-h-[6.5rem] resize-y"
                    rows={4}
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="e.g. Fire Safety Inspector"
                  />
                </div>
              </Card>
            </div>
          ) : null}
          <DialogFooter className="shrink-0 flex flex-col-reverse gap-2 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setStationTarget(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              disabled={!newStationno || busy}
              onClick={submitStationUpdate}
              className="w-full sm:w-auto"
            >
              {busy ? "Saving…" : "Save Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

