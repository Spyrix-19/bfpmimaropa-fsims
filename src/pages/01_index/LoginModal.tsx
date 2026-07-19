import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Lock, IdCard, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import bfpLogo from "@/assets/bfp-mimaropa.svg";
import ForgotPasswordModal from "./forgotpasswordmodal";
import SetNewPasswordModal from "./newpasswordmodal";

export function LoginModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { login, pendingMember, clearPendingMember } = useAuth();
  const [badgeno, setBadgeno] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [newPassOpen, setNewPassOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setBadgeno("");
      setPassword("");
      setShowPassword(false);
    }
  }, [open]);

  useEffect(() => {
    // If login flagged an isnewaccount member, open the password-change modal.
    if (pendingMember) setNewPassOpen(true);
  }, [pendingMember]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await login(badgeno, password, remember);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Login failed");
      return;
    }
    if (res.requiresPasswordChange) {
      // Keep login modal open behind — new-password modal is triggered by effect.
      return;
    }
    toast.success("Welcome back");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
            className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[440px] min-h-0 flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
            onInteractOutside={(event) => event.preventDefault()}
          >
            <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white p-1.5 shadow-elegant ring-1 ring-white/40 sm:h-16 sm:w-16">
                  <img src={bfpLogo} alt="BFP MIMAROPA" width={64} height={64} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <DialogTitle className="text-lg font-bold tracking-tight text-foreground sm:text-xl">FSIMS Sign in</DialogTitle>
                  <DialogDescription className="text-xs leading-snug text-muted-foreground/85 sm:text-[13px]">Fire Safety Inspection Monitoring System</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
              <form onSubmit={submit} className="space-y-4" autoComplete="off" spellCheck={false}>
            <input
              type="text"
              name="username"
              className="hidden"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
            />
            <input
              type="password"
              name="password"
              className="hidden"
              autoComplete="new-password"
              tabIndex={-1}
              aria-hidden="true"
            />

            <div className="space-y-2">
              <Label htmlFor="badgeno">Badge Number</Label>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="badgeno"
                  type="text"
                  inputMode="text"
                  pattern="[A-Za-z0-9]*"
                  required
                  value={badgeno}
                  onChange={(e) => {
                    const nextValue = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                    setBadgeno(nextValue);
                  }}
                  placeholder="e.g. 10001 or AB123"
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="w-full bg-gradient-primary text-primary-foreground shadow-elegant"
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {busy ? "Signing in…" : "Login"}
            </Button>
          </form>
        </div>
        </DialogContent>
      </Dialog>

      <ForgotPasswordModal
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        onSend={async () => {
          /* Forgot password is on hold — modal shows the notice itself. */
        }}
      />

      <SetNewPasswordModal
        open={newPassOpen}
        onOpenChange={(o) => {
          setNewPassOpen(o);
          if (!o) clearPendingMember();
        }}
        member={pendingMember}
        onUpdated={() => {
          setNewPassOpen(false);
          clearPendingMember();
          toast.success("Password updated. Please sign in with your new password.");
          setPassword("");
        }}
      />
    </>
  );
}
