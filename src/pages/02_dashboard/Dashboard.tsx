import { Suspense, lazy } from "react";
import { useAuth } from "@/lib/auth";

const FilterBar = lazy(() =>
  import("@/pages/02_dashboard/FilterBar").then((module) => ({ default: module.FilterBar })),
);
const DashboardBody = lazy(() =>
  import("@/pages/02_dashboard/DashboardBody").then((module) => ({
    default: module.DashboardBody,
  })),
);

function FilterBarFallback() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground">
      Loading filters…
    </div>
  );
}

function DashboardBodyFallback() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-6 text-sm text-muted-foreground">
      Loading dashboard summary…
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  const rank = user?.rankcode ?? "";
  const lastName =
    user?.lastname || (user?.fullname ? user.fullname.trim().split(/\s+/).slice(-1)[0] : "");
  const title = user
    ? `Welcome, ${rank ? rank + " " : ""}${lastName} 👋`
    : "Fire Safety Inspection Monitoring";

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Live monitoring
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Real-time fire safety inspection accomplishments across MIMAROPA Region.
        </p>
      </div>

      <Suspense fallback={<FilterBarFallback />}>
        <FilterBar />
      </Suspense>
      <Suspense fallback={<DashboardBodyFallback />}>
        <DashboardBody />
      </Suspense>
    </div>
  );
}
