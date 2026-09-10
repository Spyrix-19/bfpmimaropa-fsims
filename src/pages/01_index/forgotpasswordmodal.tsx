import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { PasswordChecklist, isPasswordValid } from "@/components/password-rules";
import { toast } from "@/lib/toast";
import bfpLogo from "@/assets/bfp-mimaropa.svg";
import { authAPI } from "@/services/authAPI";
import { unwrap } from "@/lib/api-envelope";
import { getClientIp } from "@/lib/client-ip";
import { FSIMS_SYSTEMCODE, FSIMS_SYSTEMNO } from "@/lib/fsims-constants";
import type { SendOtpResult, VerifyOtpResult } from "@/types/authType";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend?: (value: string) => Promise<void> | void;
};

type Step = "badge" | "otp" | "password";

const OTP_LENGTH = 8;
const RESEND_SECONDS = 180;

/** Badge rule shared with the login form: letters, digits and at most one hyphen. */
function sanitizeBadge(raw: string): string {
  let next = raw.replace(/[^a-zA-Z0-9-]/g, "");
  const firstHyphen = next.indexOf("-");
  if (firstHyphen !== -1) {
    next = next.slice(0, firstHyphen + 1) + next.slice(firstHyphen + 1).replace(/-/g, "");
  }
  return next;
}

/** Pull an email address out of a loosely-typed API payload. */
function resolveEmail(payload: unknown): string {
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): string => {
    if (!node || depth > 4) return "";
    if (typeof node === "string") return node.includes("@") ? node : "";
    if (typeof node !== "object" || seen.has(node)) return "";
    seen.add(node);
    for (const value of Object.values(node as Record<string, unknown>)) {
      const found = walk(value, depth + 1);
      if (found) return found;
    }
    return "";
  };
  return walk(payload, 0).trim();
}

/** `jomarbenito14@gmail.com` -> `jo***********@gmail.com` */
function maskEmail(email: string | undefined | null): string {
  const value = (email ?? "").trim();
  const at = value.indexOf("@");
  if (at <= 0) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  const stars = "*".repeat(Math.max(local.length - head.length, 3));
  return `${head}${stars}${domain}`;
}

function formatCountdown(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ForgotPasswordModal({ open, onOpenChange, onSend }: Props) {
  const [step, setStep] = useState<Step>("badge");
  const [badgeno, setBadgeno] = useState("");
  const [sending, setSending] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [member, setMember] = useState<VerifyOtpResult | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const badgeRef = useRef<HTMLInputElement | null>(null);

  const resetAll = useCallback(() => {
    setStep("badge");
    setBadgeno("");
    setSending(false);
    setOtp("");
    setVerifying(false);
    setEmail("");
    setSecondsLeft(0);
    setMember(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setPending(false);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => badgeRef.current?.focus(), 150);
    else resetAll();
  }, [open, resetAll]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const sendCode = async () => {
    const badge = badgeno.trim();
    if (!badge) {
      toast.error("Please enter your badge number.");
      return;
    }
    setSending(true);
    try {
      await onSend?.(badge);
      const ipaddress = await getClientIp();
      const res = await authAPI.sendOtp({
        badgeno: badge.toUpperCase(),
        systemno: FSIMS_SYSTEMNO,
        systemcode: FSIMS_SYSTEMCODE,
        ipaddress,
        otpType: "AUTH",
        channel: "EMAIL",
      });
      const { ok, canceled, data, error } = unwrap<SendOtpResult | null>(res);
      if (canceled) return;
      if (!ok) {
        toast.error(error);
        return;
      }
      const nextEmail = data?.emailaddress || resolveEmail(data) || resolveEmail(res?.data);
      if (nextEmail) setEmail(nextEmail);
      setOtp("");
      setSecondsLeft(RESEND_SECONDS);
      setStep("otp");
      toast.success(res.data?.errorMessages || "OTP sent to registered email.");
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH));
  };

  const verifyCode = async () => {
    if (verifying) return;
    if (otp.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit code.`);
      return;
    }
    setVerifying(true);
    try {
      const res = await authAPI.verifyOtp({
        badgeno: badgeno.trim().toUpperCase(),
        systemno: FSIMS_SYSTEMNO,
        systemcode: FSIMS_SYSTEMCODE,
        otp,
      });
      const { ok, canceled, data, error } = unwrap<VerifyOtpResult | null>(res);
      if (canceled) return;
      if (!ok) {
        toast.error(error);
        setOtp("");
        return;
      }
      setMember(data ?? null);
      toast.success(res.data?.errorMessages || "OTP verified.");
      setStep("password");
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdate = async () => {
    if (!isPasswordValid(newPassword) || newPassword !== confirmPassword) return;
    if (!member?.memberno) return toast.error("Your account could not be resolved. Please retry.");
    setPending(true);
    try {
      const res = await authAPI.updatePassword({
        memberno: member.memberno,
        userpass: newPassword,
        updatedby: member.memberno,
      });
      const { ok, canceled, error } = unwrap<unknown>(res);
      if (canceled) return;
      if (!ok) {
        toast.error(error);
        return;
      }
      onOpenChange(false);
      setDoneOpen(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[440px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-3">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                {step === "badge" ? (
                  <IdCard className="h-5 w-5 text-primary" />
                ) : step === "otp" ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <Lock className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {step === "badge"
                    ? "Reset your password"
                    : step === "otp"
                      ? "Email verification"
                      : "Set your new password"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step === "badge"
                    ? "Enter your badge number and we'll send you an 8-digit one-time code."
                    : step === "otp"
                      ? "Enter the 8-digit code we emailed you."
                      : "Confirm it's you, then choose a new password."}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto px-5 py-4">
            {step === "badge" && (
              <>
                <div>
                  <Label className="mb-2">Badge number</Label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={badgeRef}
                      value={badgeno}
                      onChange={(e) => setBadgeno(sanitizeBadge(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void sendCode();
                        }
                      }}
                      placeholder="e.g. O-L21210 or AB123"
                      inputMode="text"
                      pattern="[A-Za-z0-9-]*"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void sendCode()} disabled={sending}>
                    {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </>
            )}

            {step === "otp" && (
              <div className="flex w-full max-w-full min-w-0 flex-col gap-4 overflow-hidden py-1">
                <div className="flex flex-col items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-center">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </span>
                  <p className="text-xs text-muted-foreground">
                    We sent an 8-digit verification code to
                  </p>
                  <span className="max-w-full truncate text-sm font-semibold text-foreground">
                    {maskEmail(email) || "your registered email"}
                  </span>
                </div>

                <div className="w-full min-w-0">
                  <label className="mb-2 block text-center text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Verification code
                  </label>
                  <InputOTP
                    maxLength={OTP_LENGTH}
                    value={otp}
                    onChange={handleOtpChange}
                    disabled={verifying}
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]*"
                    containerClassName="w-full max-w-full min-w-0 justify-center"
                  >
                    <InputOTPGroup className="grid w-full max-w-full min-w-0 grid-cols-8 gap-1.5 sm:gap-2">
                      {Array.from({ length: OTP_LENGTH }, (_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="aspect-square h-auto w-full min-w-0 rounded-full border border-input bg-background text-center text-base font-semibold tabular-nums tracking-tight text-foreground shadow-sm transition-colors data-[active=true]:border-primary data-[active=true]:ring-2 data-[active=true]:ring-primary/20 data-[filled=true]:border-input data-[filled=true]:bg-muted/30 sm:text-lg"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    Enter the 8-digit code. Paste is supported.
                  </p>
                </div>

                <Button
                  className="w-full"
                  variant="success"
                  onClick={() => void verifyCode()}
                  disabled={verifying || otp.length !== OTP_LENGTH}
                >
                  {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {verifying ? "Verifying…" : "Verify & Continue"}
                </Button>

                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setStep("badge")}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => void sendCode()}
                    disabled={secondsLeft > 0 || sending}
                  >
                    <RefreshCw className={`mr-1.5 h-4 w-4 ${sending ? "animate-spin" : ""}`} />
                    {secondsLeft > 0 ? `Resend in ${formatCountdown(secondsLeft)}` : "Resend code"}
                  </Button>
                </div>
              </div>
            )}

            {step === "password" && (
              <>
                <div className="space-y-3">
                  <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        Personnel Information
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <AvatarWithFallback
                        entity={member ?? undefined}
                        src={member?.profileurl || null}
                        name={member?.fullname ?? ""}
                        className="h-14 w-14 shrink-0 border border-border/60"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {[member?.rankcode, member?.fullname].filter(Boolean).join(" ")}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member?.badgeno}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
                    <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        Station Information
                      </h4>
                    </div>
                    <div className="flex items-center gap-3">
                      <AvatarWithFallback
                        entity={{ name: member?.stationname || "Station" }}
                        src={member?.logourl || bfpLogo}
                        name={member?.stationname || "Station"}
                        alt={`${member?.stationname ?? "Station"} logo`}
                        className="h-12 w-12 shrink-0 border border-border/60 bg-background"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{member?.stationname}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member?.stationcode} - {member?.provincename}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">New password</span>
                    <div className="relative">
                      <Input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        aria-label={showNew ? "Hide password" : "Show password"}
                        onClick={() => setShowNew((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordChecklist
                      className="mt-2"
                      password={newPassword}
                      confirmPassword={confirmPassword}
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Confirm password</span>
                    <div className="relative">
                      <Input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={confirmPassword.length > 0 && confirmPassword !== newPassword}
                        className={
                          confirmPassword.length === 0
                            ? undefined
                            : confirmPassword === newPassword
                              ? "border-emerald-500/60 focus-visible:ring-emerald-500/30"
                              : "border-destructive/70 focus-visible:ring-destructive/30"
                        }
                      />
                      <button
                        type="button"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        onClick={() => setShowConfirm((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                      <span className="mt-1.5 block text-[11px] font-medium text-destructive">
                        Passwords do not match.
                      </span>
                    )}
                  </label>
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setOpenConfirm(true)}
                    disabled={
                      pending || !isPasswordValid(newPassword) || newPassword !== confirmPassword
                    }
                  >
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {pending ? "Saving…" : "Update password"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={openConfirm}
        onOpenChange={setOpenConfirm}
        ContentIcon={AlertTriangle}
        contentIconBgClass="tone-danger-soft"
        contentIconColorClass="text-destructive"
        title="Confirm password change"
        description="Are you sure you want to set this new password?"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        confirmVariant="default"
        onConfirm={() => void handleUpdate()}
      />

      <ConfirmDialog
        open={doneOpen}
        onOpenChange={setDoneOpen}
        ContentIcon={ShieldCheck}
        contentIconBgClass="tone-success-soft"
        contentIconColorClass="text-emerald-600"
        title="Password updated"
        description="Your password has been updated. Please sign in with your new password."
        confirmLabel="Back to sign in"
        cancelClassName="hidden"
        onConfirm={() => setDoneOpen(false)}
      />
    </>
  );
}
