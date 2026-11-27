import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { isValidBadgeNumber, sanitizeBadge } from "@/lib/badge";
import { toast } from "@/lib/toast";
import bfpLogo from "@/assets/bfp-mimaropa.svg";
import ForgotPasswordModal from "./forgotpasswordmodal";
import SetNewPasswordModal from "./newpasswordmodal";

const HIGHLIGHTS = [
  "Fire Safety Compliance",
  "Target References",
  "Inspector Monitoring",
  "Fire Code Fees",
] as const;

export default function IndexPage() {
  const { user, login, initialized, pendingMember, clearPendingMember } = useAuth();
  const navigate = useNavigate();
  const [badge, setBadge] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (initialized && user) navigate("/dashboard", { replace: true });
  }, [initialized, user, navigate]);

  useEffect(() => {
    if (pendingMember) setResetOpen(true);
  }, [pendingMember]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedBadge = badge.trim();

    if (!normalizedBadge || !password) {
      toast.error("Badge number and password are required.");
      return;
    }
    if (!isValidBadgeNumber(normalizedBadge)) {
      toast.error("Badge number can only contain letters, numbers, and a single hyphen.");
      return;
    }

    setPending(true);
    const result = await login(normalizedBadge, password, false);
    setPending(false);

    if (result.requiresPasswordChange) return;
    if (!result.ok) {
      toast.error(result.error ?? "Unable to complete login at this time. Please try again later.");
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-subtle">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-8 p-6 lg:grid-cols-2">
        <div className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-card p-1.5 shadow-elegant ring-1 ring-border/80">
              <img src={bfpLogo} alt="BFP MIMAROPA" className="h-full w-full object-contain" loading="eager" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{brand.shortName}</h1>
              <p className="text-sm text-muted-foreground">{brand.appName}</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Fire Safety Inspection & monitoring
            <br />
            <span className="text-primary">for the Bureau of Fire Protection.</span>
          </h2>
          <p className="max-w-md text-muted-foreground">
            Centralized monitoring and reporting for fire safety compliance across the {brand.region}.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map((label) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-card p-1.5 ring-1 ring-border/80">
              <img src={bfpLogo} alt="BFP MIMAROPA" className="h-full w-full object-contain" loading="eager" />
            </div>
            <h1 className="text-lg font-bold">{brand.shortName} — {brand.organization}</h1>
          </div>

          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Lock className="hidden h-5 w-5 text-primary lg:inline-flex" />
            Welcome to {brand.shortName}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your badge number and password to access the system.
          </p>

          <form className="mt-6" onSubmit={handleSubmit} noValidate>
            <TooltipProvider>
              <div className="grid gap-3">
                <div>
                  <label htmlFor="badgeno" className="mb-2 block text-sm font-medium">Badge number</label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Input
                        id="badgeno"
                        name="username"
                        value={badge}
                        onChange={(event) => setBadge(sanitizeBadge(event.target.value))}
                        placeholder="e.g. O-L21210"
                        className="h-12 rounded-lg px-3"
                        required
                        autoComplete="username"
                        pattern="[A-Za-z0-9-]*"
                      />
                    </TooltipTrigger>
                    {!badge && <TooltipContent side="top">Please fill out this field</TooltipContent>}
                  </Tooltip>
                </div>

                <div>
                  <label htmlFor="userpass" className="mb-2 block text-sm font-medium">Password</label>
                  <div className="relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          id="userpass"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Your password"
                          className="h-12 rounded-lg px-3 pr-10"
                          required
                          autoComplete="current-password"
                        />
                      </TooltipTrigger>
                      {!password && <TooltipContent side="top">Please fill out this field</TooltipContent>}
                    </Tooltip>
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="submit" className="h-12 w-full rounded-lg sm:w-auto" disabled={!badge || !password || pending}>
                    {pending ? "Signing in…" : <span className="inline-flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForgotOpen(true)}>
                    Forgot password?
                  </Button>
                </div>
              </div>
            </TooltipProvider>
          </form>

          <ForgotPasswordModal open={forgotOpen} onOpenChange={setForgotOpen} />
          <SetNewPasswordModal
            open={resetOpen}
            onOpenChange={(open) => {
              setResetOpen(open);
              if (!open) clearPendingMember();
            }}
            member={pendingMember}
            onUpdated={() => {
              setResetOpen(false);
              clearPendingMember();
              toast.success("Password updated. Please sign in with your new password.");
            }}
          />
        </Card>
      </div>
    </div>
  );
}
