import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Camera,
  Mail,
  Phone,
  Calendar,
  Clock,
  Pencil,
  KeyRound,
  CalendarClock,
  Lock,
  LockOpen,
  ShieldOff,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

import { useAuth, FSIMS_SYSTEMNO } from "@/lib/auth";
import { personnelAPI } from "@/services/personnelAPI";
import { gentableAPI } from "@/services/gentableAPI";
import { unwrap } from "@/lib/api-envelope";
import { compressImage } from "@/lib/image-compress";
import { getConfirmVisuals } from "@/lib/confirm-visuals";
import {
  formatLongDate,
  toDateInput,
  imageDataToDataUrl,
  unwrapOne,
} from "@/lib/utils";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import GentableSelect, { type Option } from "@/components/gentable-select";
import GentableSearchSelect from "@/components/gentable-search-select";
import OfficeSearchSelect from "@/components/office-search-select";
import StationSearchSelect from "@/components/station-search-select";
import type {
  MemberDetailModel,
  MemberInfoDTO,
  MemberEmploymentDTO,
} from "@/types/personnelType";
import type { SearchGentableModel } from "@/types/gentableType";
import ChangePasswordDialog from "@/pages/03_profile/change-password-modal";
import ChangeExpiryDialog from "@/pages/03_profile/change-expiry-modal";

// Normalize the API member payload into the shape used by this UI.
const normalizeMemberPayload = (
  p: Partial<MemberDetailModel> | null | undefined,
): Partial<MemberDetailModel> | null => {
  if (!p) return null;
  return {
    memberno: String(p.memberno ?? ""),
    badgeno: p.badgeno ?? "",
    lastname: p.lastname ?? "",
    firstname: p.firstname ?? "",
    miname: p.miname ?? "",
    suffix: p.suffix ?? "",
    fullname: p.fullname ?? "",
    rankno: Number(p.rankno ?? 0),
    rankcode: p.rankcode ?? "",
    rankname: p.rankname ?? "",
    statusno: Number(p.statusno ?? 0),
    statuscode: p.statuscode ?? "",
    statusname: p.statusname ?? "",
    genderno: Number(p.genderno ?? 0),
    gendercode: p.gendercode ?? "",
    gendername: p.gendername ?? "",
    civilstatus: Number(p.civilstatus ?? 0),
    civilstatuscode: p.civilstatuscode ?? "",
    civilstatusname: p.civilstatusname ?? "",
    birthdate: toDateInput(p.birthdate),
    defs: toDateInput(p.defs),
    degs: toDateInput(p.degs),
    emailaddress: p.emailaddress ?? "",
    mobileno: p.mobileno ?? "",
    systemaccess: Array.isArray(p.systemaccess) ? p.systemaccess : [],
    stationno: p.stationno ?? "",
    stationcode: p.stationcode ?? "",
    stationname: p.stationname ?? "",
    officeno: Number(p.officeno ?? 0),
    officecode: p.officecode ?? "",
    officename: p.officename ?? "",
    designation: p.designation ?? "",
    isactive: p.isactive ?? false,
    inactivedate: p.inactivedate ?? "",
    accountlock: p.accountlock ?? false,
    lockdate: p.lockdate ?? "",
    lastaccess: p.lastaccess ?? "",
    passwordexpiry: toDateInput(p.passwordexpiry),
    profileurl: p.profileurl ?? "",
    filetype: p.filetype ?? "",
    imagedata: p.imagedata ?? "",
  };
};

const toOptions = (rows: SearchGentableModel[] | null): Option[] =>
  (rows ?? []).map((r) => ({
    value: String(Number(r.detno ?? 0)),
    label: String(r.description ?? r.recordcode ?? ""),
    raw: { recordcode: r.recordcode, recordname: r.description },
  }));

export default function Profile() {
  const { user, hasRole, updateUser, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [member, setMember] = useState<Partial<MemberDetailModel> | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ranks, setRanks] = useState<Option[]>([]);
  const [genders, setGenders] = useState<Option[]>([]);
  const [civilStatuses, setCivilStatuses] = useState<Option[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ title: string; onClick: () => void } | null>(
    null,
  );
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const getConfirmDescription = (title?: string) => {
    const securityActions = new Set([
      "Reset Password",
      "Change Password",
      "Change Password Expiry",
      "Lock my Account",
      "Unlock my Account",
      "Activate Account",
      "Deactivate Account",
    ]);
    const actionText = title ? `Are you sure you want to ${title.toLowerCase()}?` : "Please confirm to proceed.";
    if (title && securityActions.has(title)) {
      return `${actionText} Changes made here apply throughout the entire BFP MIMAROPA system.`;
    }
    return `${actionText} Please confirm to proceed.`;
  };

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageDialogLoading, setImageDialogLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  const loadMember = async () => {
    if (!user) return;
    try {
      const resp = await personnelAPI.getDetails(
        { memberno: String(user.memberno) },
        { suppressGlobalLoading: true },
      );
      const normalized = normalizeMemberPayload(unwrapOne<MemberDetailModel>(resp));
      if (normalized) {
        setMember(normalized);
        if (normalized.fullname && normalized.fullname !== user.fullname) {
          updateUser({ fullname: normalized.fullname, name: normalized.fullname });
        }
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load profile");
    }
  };

  useEffect(() => {
    loadMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.memberno]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const load = async (tablename: string) => {
        const resp = await gentableAPI.search(
          { tablename, searchKey: "", pageNumber: 1, pageSize: 200 },
          { suppressGlobalLoading: true },
        );
        return toOptions(unwrap<SearchGentableModel[]>(resp).data);
      };
      try {
        const [r, g, c] = await Promise.all([
          load("RANK"),
          load("GENDER"),
          load("CIVIL STATUS"),
        ]);
        if (cancelled) return;
        setRanks(r);
        setGenders(g);
        setCivilStatuses(c);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onUpload = async (file?: File) => {
    if (!file || !user || uploading) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, JPG or PNG images are allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("Image must be 5 MB or smaller");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setImageDialogOpen(true);
    setImageDialogLoading(true);

    let lastReal = 0;
    const tick = setInterval(() => {
      setUploadProgress((p) => {
        const base = Math.max(lastReal, p);
        if (base >= 90) return base;
        return Math.min(90, base + Math.max(1, Math.round((90 - base) * 0.06)));
      });
    }, 120);

    let success = false;
    try {
      const compressed = await compressImage(file, { maxDimension: 1024, quality: 0.85 });
      const resp = await personnelAPI.uploadProfile(
        {
          memberno: String(user.memberno),
          badgeno: String(member?.badgeno ?? user.badgeno ?? ""),
          file: compressed,
          updatedby: String(user.memberno),
        },
        {
          suppressGlobalLoading: true,
          timeout: 120000,
          progressCallback: (p) => {
            lastReal = p;
            setUploadProgress((prev) => Math.max(prev, p));
          },
        },
      );

      const up = unwrap(resp);
      if (up.ok) {
        setUploadProgress(100);
        toast.success("Profile photo uploaded");
        await Promise.all([loadMember(), refreshUser()]);
        success = true;
      } else {
        toast.error(up.error || "Upload failed");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      clearInterval(tick);
      if (success) {
        setUploadProgress(100);
        await new Promise((r) => setTimeout(r, 400));
      }
      setImageDialogLoading(false);
      setImageDialogOpen(false);
      setUploading(false);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeProfile = async () => {
    if (!user) return;
    setRemoving(true);
    try {
      const resp = await personnelAPI.deleteProfile(
        {
          memberno: String(user.memberno),
          badgeno: String(member?.badgeno ?? user.badgeno ?? ""),
          deletedby: String(user.memberno),
        },
        { suppressGlobalLoading: true },
      );
      const del = unwrap(resp);
      if (del.ok) {
        toast.success("Profile picture removed");
        await Promise.all([loadMember(), refreshUser()]);
      } else {
        const msg = del.error || "Failed to remove profile picture";
        toast.error(msg);
        throw new Error(msg);
      }
    } finally {
      setRemoving(false);
    }
  };

  const saveInfo = async () => {
    if (!user || !member) return;
    setSavingInfo(true);
    try {
      const payload: MemberInfoDTO = {
        memberno: String(user.memberno),
        lastname: member.lastname ?? "",
        firstname: member.firstname ?? "",
        miname: member.miname ?? "",
        suffix: member.suffix ?? "",
        rankno: Number(member.rankno ?? 0),
        statusno: Number(member.statusno ?? 0),
        genderno: Number(member.genderno ?? 0),
        civilstatus: Number(member.civilstatus ?? 0),
        birthdate: toDateInput(member.birthdate),
        emailaddress: member.emailaddress ?? "",
        mobileno: member.mobileno ?? "",
        updatedby: String(user.memberno),
      };
      await personnelAPI.UpdateInfo(payload);
      toast.success("Personal information updated");
      await loadMember();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save personal information");
    } finally {
      setSavingInfo(false);
    }
  };

  const saveEmployment = async () => {
    if (!user || !member) return;
    setSavingEmployment(true);
    try {
      const payload: MemberEmploymentDTO = {
        memberno: String(user.memberno),
        stationno: String(member.stationno ?? ""),
        officeno: Number(member.officeno ?? 0),
        designation: member.designation ?? "",
        defs: toDateInput(member.defs),
        degs: toDateInput(member.degs),
        updatedby: String(user.memberno),
      };
      await personnelAPI.UpdateEmployment(payload);
      toast.success("Employment updated");
      await loadMember();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save employment");
    } finally {
      setSavingEmployment(false);
    }
  };

  const isAccountLocked = !!member?.accountlock;
  const isAccountActive = member?.isactive ?? true;

  const doResetPassword = async () => {
    if (!user) return;
    await personnelAPI.resetPassword({
      memberno: String(user.memberno),
      updatedby: String(user.memberno),
    });
    toast.success("Password reset successfully");
    await loadMember();
  };

  const doUpdatePassword = async (password?: string) => {
    if (!user) return;
    await personnelAPI.updatePassword({
      memberno: String(user.memberno),
      userpass: password ?? "",
      updatedby: String(user.memberno),
    });
    toast.success("Password updated");
    await loadMember();
  };

  const doUpdateExpiry = async (expiry?: string) => {
    if (!user) return;
    await personnelAPI.updatePasswordExpiry({
      memberno: String(user.memberno),
      passwordexpiry: expiry ?? "",
      updatedby: String(user.memberno),
    });
    toast.success("Password expiry updated");
    await loadMember();
  };

  const doToggleLock = async () => {
    if (!user) return;
    await personnelAPI.Unlock({
      memberno: String(user.memberno),
      passwordlock: !isAccountLocked,
      updatedby: String(user.memberno),
    });
    toast.success(isAccountLocked ? "Account unlocked" : "Account locked");
    await loadMember();
  };

  const doToggleActive = async () => {
    if (!user) return;
    await personnelAPI.Activate({
      memberno: String(user.memberno),
      activeuser: !isAccountActive,
      updatedby: String(user.memberno),
    });
    toast.success(isAccountActive ? "Account deactivated" : "Account activated");
    await loadMember();
  };

  const openConfirm = (action: { title: string; onClick: () => void }) => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const confirmExecute = async () => {
    if (!pendingAction) return;
    setConfirmOpen(false);
    try {
      await pendingAction.onClick?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const securityActions: Array<{
    icon: any;
    title: string;
    desc: string;
    variant: "default" | "destructive" | "destructive-light" | "success";
    onClick: () => void;
  }> = [
    {
      icon: KeyRound,
      title: "Reset Password",
      desc: "Reset your account password",
      variant: "default",
      onClick: () => openConfirm({ title: "Reset Password", onClick: doResetPassword }),
    },
    {
      icon: KeyRound,
      title: "Change Password",
      desc: "Update your account password",
      variant: "default",
      onClick: () => setChangePwdOpen(true),
    },
    {
      icon: CalendarClock,
      title: "Change Password Expiry",
      desc: "Set password expiration date",
      variant: "default",
      onClick: () => setExpiryOpen(true),
    },
    {
      icon: isAccountLocked ? LockOpen : Lock,
      title: isAccountLocked ? "Unlock my Account" : "Lock my Account",
      desc: isAccountLocked ? "Restore access to your account" : "Temporarily lock your account",
      variant: isAccountLocked ? "success" : "destructive-light",
      onClick: () =>
        openConfirm({
          title: isAccountLocked ? "Unlock my Account" : "Lock my Account",
          onClick: doToggleLock,
        }),
    },
    {
      icon: isAccountActive ? ShieldOff : ShieldCheck,
      title: isAccountActive ? "Deactivate Account" : "Activate Account",
      desc: isAccountActive ? "Deactivate your account" : "Activate your account",
      variant: isAccountActive ? "destructive" : "success",
      onClick: () =>
        openConfirm({
          title: isAccountActive ? "Deactivate Account" : "Activate Account",
          onClick: doToggleActive,
        }),
    },
  ];

  if (!user) return null;

  const avatarSrc =
    imageDataToDataUrl(member?.filetype, member?.imagedata) || member?.profileurl || undefined;

  // FSIMS role — resolved from the API's `systemaccess[]` matched by systemno.
  // This is the single source of truth for the user's role in FSIMS. Legacy
  // fields (rolenoams / rolenofsis / rolecodefsis / etc.) are intentionally
  // ignored per FSIMS spec.
  const fsimsAccess =
    (member?.systemaccess ?? []).find(
      (s) => (s.systemno || "").toLowerCase() === FSIMS_SYSTEMNO.toLowerCase(),
    ) ??
    (member?.systemaccess ?? []).find(
      (s) => (s.systemcode || "").toUpperCase() === "FSIMS",
    ) ??
    null;
  const fsimsRoleName = fsimsAccess?.rolename ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-primary" />
            My Profile
          </h1>
          <p className="text-xs text-muted-foreground">Your account information and system access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — identity + security */}
        <div className="space-y-6">
          <Card className="relative overflow-hidden border-border/60 shadow-soft">
            <div className="flex flex-col items-center p-6 pt-10">
              <div className="relative mb-4 mt-4 flex justify-center">
                <div className="relative">
                  <AvatarWithFallback
                    entity={member}
                    src={avatarSrc}
                    name={member?.fullname}
                    className="h-24 w-24 overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-background"
                    alt={member?.fullname}
                  />

                  {member?.imagedata ? (
                    <button
                      type="button"
                      aria-label="Remove profile picture"
                      onClick={() => setRemoveConfirmOpen(true)}
                      disabled={uploading || removing}
                      className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border bg-white text-destructive shadow-sm transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                        <path
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  ) : null}

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    className="hidden"
                    onChange={(e) => onUpload(e.target.files?.[0])}
                  />

                  <button
                    type="button"
                    aria-label="Upload photo"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || removing}
                    className="absolute -bottom-2 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="rounded-full bg-primary p-1">
                      <Camera className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </button>
                </div>
              </div>

              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-foreground">{member?.fullname ?? ""}</h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {fsimsRoleName ? (
                    <Badge
                      variant="outline"
                      className="border-primary/20 bg-primary/10 text-primary shadow-none"
                    >
                      {fsimsRoleName}
                    </Badge>
                  ) : null}
                  {member?.statusname ? (
                    <Badge
                      variant="outline"
                      className={`border-transparent shadow-none ${
                        (member?.statusname ?? "").toLowerCase() === "active"
                          ? "bg-success/15 text-success"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {member?.statusname}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="w-full space-y-3 px-6">
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-foreground">{member?.emailaddress ?? ""}</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground">{member?.mobileno ?? ""}</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                  <Calendar className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground">
                    {formatLongDate(member?.defs) ? `Joined ${formatLongDate(member?.defs)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground">
                    {formatLongDate(member?.passwordexpiry)
                      ? `Password will expire on ${formatLongDate(member?.passwordexpiry)}`
                      : "Password expiry not set"}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2 text-sm">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span className="text-foreground">
                    {formatLongDate(member?.lastaccess)
                      ? `Last Login ${formatLongDate(member?.lastaccess)}`
                      : ""}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border/60 p-6 shadow-soft">
            <h4 className="text-sm font-semibold">Security</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage password settings and account access.
            </p>

            <div className="mt-4 grid gap-2">
              {securityActions.map((a) => {
                const v = a.variant;
                const rowCls =
                  v === "destructive"
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    : v === "destructive-light"
                      ? "bg-destructive/5 text-destructive hover:bg-destructive/15"
                      : v === "success"
                        ? "bg-success/10 text-success hover:bg-success/20"
                        : "bg-muted/40 hover:bg-primary/10";
                const iconCls =
                  v === "destructive"
                    ? "bg-destructive/20 text-destructive"
                    : v === "destructive-light"
                      ? "bg-destructive/15 text-destructive"
                      : v === "success"
                        ? "bg-success/15 text-success"
                        : "bg-primary/10 text-primary";
                const titleCls =
                  v === "destructive" || v === "destructive-light"
                    ? "text-destructive"
                    : v === "success"
                      ? "text-success"
                      : "text-foreground";
                const descCls =
                  v === "destructive" || v === "destructive-light"
                    ? "text-destructive/80"
                    : v === "success"
                      ? "text-success/80"
                      : "text-muted-foreground";
                return (
                  <button
                    key={a.title}
                    type="button"
                    onClick={() => a.onClick?.()}
                    aria-label={`${a.title}: ${a.desc}`}
                    className={`flex items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${rowCls}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconCls}`}
                    >
                      <a.icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium ${titleCls}`}>{a.title}</div>
                      <div className={`truncate text-xs ${descCls}`}>{a.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column — editable details */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="flex flex-col border-border/60 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-lg font-semibold">Personal Information</h4>
              {!editingInfo && (
                <Button variant="outline" size="sm" onClick={() => setEditingInfo(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Badge Number</Label>
                <Input value={member?.badgeno ?? ""} readOnly />
                <p className="mt-1 text-xs text-muted-foreground">
                  Only Super Admin can modify the Badge Number.
                </p>
              </div>

              <div>
                <Label>Rank</Label>
                <GentableSelect
                  value={String(Number(member?.rankno ?? 0))}
                  options={ranks}
                  placeholder="-- Select rank --"
                  readOnly={!editingInfo}
                  onChange={(vv, opt) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          rankno: vv ? Number(vv) : 0,
                          ...(opt?.raw
                            ? {
                                rankcode: String(opt.raw.recordcode ?? ""),
                                rankname: String(opt.raw.recordname ?? ""),
                              }
                            : {}),
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
              <div>
                <Label>Suffix</Label>
                <Input
                  value={member?.suffix ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), suffix: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div>
                <Label>First Name</Label>
                <Input
                  value={member?.firstname ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), firstname: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
              <div>
                <Label>Middle Name</Label>
                <Input
                  value={member?.miname ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), miname: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input
                  value={member?.lastname ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), lastname: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div>
                <Label>Birthdate</Label>
                <Input
                  type="date"
                  value={toDateInput(member?.birthdate)}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), birthdate: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div>
                <Label>Gender</Label>
                <GentableSelect
                  value={String(Number(member?.genderno ?? 0))}
                  options={genders}
                  placeholder="-- Select gender --"
                  readOnly={!editingInfo}
                  onChange={(vv, opt) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          genderno: vv ? Number(vv) : 0,
                          ...(opt?.raw
                            ? {
                                gendercode: String(opt.raw.recordcode ?? ""),
                                gendername: String(opt.raw.recordname ?? ""),
                              }
                            : {}),
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div>
                <Label>Civil Status</Label>
                <GentableSelect
                  value={String(Number(member?.civilstatus ?? 0))}
                  options={civilStatuses}
                  placeholder="-- Select civil status --"
                  readOnly={!editingInfo}
                  onChange={(vv, opt) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          civilstatus: vv ? Number(vv) : 0,
                          ...(opt?.raw
                            ? {
                                civilstatuscode: String(opt.raw.recordcode ?? ""),
                                civilstatusname: String(opt.raw.recordname ?? ""),
                              }
                            : {}),
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={member?.emailaddress ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          emailaddress: e.target.value,
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Label>Phone</Label>
                <Input
                  value={member?.mobileno ?? ""}
                  readOnly={!editingInfo}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({ ...(m ?? {}), mobileno: e.target.value }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
            </div>

            {editingInfo && (
              <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await loadMember();
                    setEditingInfo(false);
                  }}
                  disabled={savingInfo}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    openConfirm({
                      title: "Save Personal Information",
                      onClick: async () => {
                        await saveInfo();
                        setEditingInfo(false);
                      },
                    })
                  }
                  disabled={savingInfo}
                >
                  {savingInfo ? "Saving..." : "Save changes"}
                </Button>
              </div>
            )}
          </Card>

          <Card className="flex flex-col border-border/60 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-lg font-semibold">Employment Information</h4>
              {!editingEmployment && (
                <Button variant="outline" size="sm" onClick={() => setEditingEmployment(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {!hasRole(3) && (
                <div>
                  <Label htmlFor="employment-role">FSIMS Role</Label>
                  <Input
                    id="employment-role"
                    value={
                      fsimsRoleName
                        ? `${fsimsRoleName}${fsimsAccess?.rolecode ? ` (${fsimsAccess.rolecode})` : ""}`
                        : ""
                    }
                    readOnly
                    placeholder="No FSIMS role assigned"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sourced from your system access. Managed by the administrator.
                  </p>
                </div>
              )}


              <div className="md:col-span-2">
                <Label>Unit / Station</Label>
                <StationSearchSelect
                  value={String(member?.stationno ?? "")}
                  valueName={member?.stationname ?? ""}
                  readOnly={!editingEmployment}
                  onChange={(stationno, name) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          stationno,
                          stationname: name,
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>
              <div className="md:col-span-3">
                <Label>Office</Label>
                <OfficeSearchSelect
                  value={member?.officeno ? String(Number(member.officeno)) : undefined}
                  valueName={member?.officename ?? ""}
                  placeholder="-- Select office --"
                  readOnly={!editingEmployment}
                  onChange={(vv, name, row) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          officeno: vv ? Number(vv) : 0,
                          officecode: row?.recordcode ?? "",
                          officename: name,
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div className="md:col-span-3">
                <Label>Designation</Label>
                <textarea
                  rows={4}
                  readOnly={!editingEmployment}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={member?.designation ?? ""}
                  onChange={(e) =>
                    setMember(
                      (m) =>
                        ({
                          ...(m ?? {}),
                          designation: e.target.value,
                        }) as Partial<MemberDetailModel>,
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:col-span-3 md:grid-cols-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Label>DEFS</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-xs text-muted-foreground">
                          (?)
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Date Entered Fire Service</TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="date"
                    value={toDateInput(member?.defs)}
                    readOnly={!editingEmployment}
                    onChange={(e) =>
                      setMember(
                        (m) =>
                          ({ ...(m ?? {}), defs: e.target.value }) as Partial<MemberDetailModel>,
                      )
                    }
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Label>DEGS</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-xs text-muted-foreground">
                          (?)
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>Date Entered Government Service</TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="date"
                    value={toDateInput(member?.degs)}
                    readOnly={!editingEmployment}
                    onChange={(e) =>
                      setMember(
                        (m) =>
                          ({ ...(m ?? {}), degs: e.target.value }) as Partial<MemberDetailModel>,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            {editingEmployment && (
              <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await loadMember();
                    setEditingEmployment(false);
                  }}
                  disabled={savingEmployment}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    openConfirm({
                      title: "Save Employment",
                      onClick: async () => {
                        await saveEmployment();
                        setEditingEmployment(false);
                      },
                    })
                  }
                  disabled={savingEmployment}
                >
                  {savingEmployment ? "Saving..." : "Save changes"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirm dialog for security + save actions */}
      <ConfirmDialog
        {...getConfirmVisuals(pendingAction?.title)}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Confirm ${pendingAction?.title ?? "Action"}`}
        description={getConfirmDescription(pendingAction?.title)}
        confirmLabel={pendingAction?.title ? `Yes, ${pendingAction.title}` : "Confirm"}
        cancelLabel="Cancel"
        onConfirm={confirmExecute}
      />

      {/* Confirm removal of profile picture */}
      <ConfirmDialog
        {...getConfirmVisuals("remove profile picture")}
        open={removeConfirmOpen}
        onOpenChange={setRemoveConfirmOpen}
        title="Remove profile picture"
        description="Are you sure you want to remove your profile picture? This action can be reverted by uploading a new picture."
        confirmLabel="Remove"
        confirmVariant="destructive"
        onConfirm={async () => {
          setRemoveConfirmOpen(false);
          let success = false;
          try {
            setImageDialogOpen(true);
            setImageDialogLoading(true);
            await removeProfile();
            success = true;
          } catch {
            /* error toast already shown */
          } finally {
            setImageDialogLoading(false);
            if (success) setImageDialogOpen(false);
          }
        }}
      />

      {/* Image upload/remove progress dialog */}
      <Dialog
        open={imageDialogOpen}
        onOpenChange={(v) => {
          if (imageDialogLoading && !v) return;
          setImageDialogOpen(v);
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[640px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg className="h-7 w-7 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeOpacity="0.25" fill="none" />
                  <path d="M22 12a10 10 0 00-10-10" strokeWidth="3" stroke="currentColor" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              <div className="flex flex-col items-start text-left">
                <DialogTitle className="text-lg font-semibold">Processing</DialogTitle>
                <DialogDescription className="mt-2 max-w-[28rem] text-sm text-muted-foreground">Please wait while we update your profile picture...</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden px-5 py-4">
            {uploading ? (
              <div className="mt-2 space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{uploadProgress >= 100 ? "Finalizing…" : "Uploading…"}</span>
                  <span className="tabular-nums">{Math.min(100, Math.round(uploadProgress))}%</span>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Processing… please wait</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ChangePasswordDialog
        open={changePwdOpen}
        onOpenChange={setChangePwdOpen}
        onRequestConfirm={(password) =>
          openConfirm({
            title: "Change Password",
            onClick: async () => await doUpdatePassword(password),
          })
        }
      />

      <ChangeExpiryDialog
        open={expiryOpen}
        onOpenChange={setExpiryOpen}
        onRequestConfirm={(date) =>
          openConfirm({
            title: "Change Password Expiry",
            onClick: async () => await doUpdateExpiry(date),
          })
        }
      />
    </div>
  );
}
