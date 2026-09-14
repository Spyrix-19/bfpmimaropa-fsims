import {
  LockKeyholeOff,
  ShieldAlert,
  Shield,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import Footer from "@/components/Footer";
import { brand } from "@/lib/brand";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import logo from "@/assets/bfp-mimaropa.png";

export default function MaintenanceAccessBlocked() {
  const { logout, user } = useAuth();

  useEffect(() => {
    // Auto-logout non-super-admin users after brief delay
    const timer = setTimeout(() => {
      logout();
    }, 2500);
    return () => clearTimeout(timer);
  }, [logout]);

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        {/* Branding */}
        <header className="flex flex-col items-center gap-3 text-center">
          <img
            src={logo}
            alt={`${brand.organization} official seal`}
            className="h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Bureau of Fire Protection
            </p>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {brand.region}
            </p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-foreground">
              {brand.organization} {brand.appName}
            </p>
          </div>
        </header>

        {/* Access Denied notice */}
        <Card className="mt-8 overflow-hidden border-border/60 p-0 shadow-elegant">
          <div className="border-b border-border/60 bg-red-50/40 dark:bg-red-950/20 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100/60 dark:bg-red-900/30 ring-1 ring-red-200/60 dark:ring-red-800/60">
              <LockKeyholeOff className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              System Maintenance — Access Restricted
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              The {brand.organization} {brand.appName} is currently under maintenance. Only 
              authorized Super Administrators can access the system during this period.
            </p>
          </div>

          {/* Status card */}
          <div className="px-6 py-6 sm:px-10">
            <div className="rounded-lg border border-red-200/60 dark:border-red-800/60 bg-red-50/40 dark:bg-red-950/20 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-400">
                Access Status
              </p>
              <div className="mt-3 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500/50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
                </span>
                <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                  Access Denied
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Your account ({user?.badgeno}) does not have Super Administrator privileges. 
                Access is automatically being revoked to maintain system integrity during maintenance.
              </p>
            </div>

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              During scheduled maintenance, only Super Administrators are permitted to access 
              the {brand.organization} {brand.appName}. This restriction is in place to ensure 
              system stability and to prevent data conflicts during maintenance operations.
            </p>
          </div>
        </Card>

        {/* Information cards */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card className="border-border/60 p-6">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">
                System Maintenance in Progress
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              The system is currently undergoing scheduled maintenance to improve performance, 
              reliability, and security. This maintenance is critical for system health.
            </p>
          </Card>

          <Card className="border-border/60 p-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="text-sm font-semibold text-foreground">
                Super Admin Access Required
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Only users with Super Administrator privileges are permitted access during this 
              maintenance window. Please contact your system administrator for further assistance.
            </p>
          </Card>
        </div>

        {/* Support */}
        <Card className="mt-6 border-border/60 p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold text-foreground">Need assistance?</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            If you are a Super Administrator and need access, please ensure you are logging in 
            with the correct Super Administrator account. For further assistance, please contact{" "}
            {brand.supportContact} or the designated {brand.organization} ICT support personnel.
          </p>
        </Card>

        {/* Action: Auto-logout notice */}
        <div className="mt-8 rounded-lg border border-yellow-200/60 dark:border-yellow-800/60 bg-yellow-50/40 dark:bg-yellow-950/20 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="flex h-2 w-2 rounded-full bg-yellow-600 dark:bg-yellow-400">
                <span className="relative inline-flex h-full w-full rounded-full bg-yellow-600/50 dark:bg-yellow-400/50 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300">
                Signing out automatically
              </p>
              <p className="mt-1 text-sm text-yellow-800/80 dark:text-yellow-400/80">
                Your account does not have Super Administrator privileges required for access during 
                maintenance. You will be signed out automatically to protect system integrity.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 text-center">
          <Footer />
        </div>
      </div>
    </main>
  );
}
