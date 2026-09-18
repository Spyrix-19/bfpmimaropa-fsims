import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { StickyPageTop } from "@/components/shared/StickyPageTop";

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
  const titleObserverRef = useRef<ResizeObserver | null>(null);

  // The title element remounts when Suspense swaps the loading fallback for
  // the dashboard body, so measure via a callback ref: a one-shot effect
  // keeps observing the detached fallback node and reports height 0, which
  // parks the sticky filter behind the title band.
  const attachTitle = useCallback((node: HTMLDivElement | null) => {
    titleObserverRef.current?.disconnect();
    titleObserverRef.current = null;
    if (!node) return;
    const updateTitleHeight = () => {
      document.documentElement.style.setProperty(
        "--dashboard-title-h",
        `${Math.ceil(node.getBoundingClientRect().height)}px`,
      );
    };
    updateTitleHeight();
    const observer = new ResizeObserver(updateTitleHeight);
    observer.observe(node);
    titleObserverRef.current = observer;
  }, []);

  useEffect(() => {
    return () => {
      titleObserverRef.current?.disconnect();
      document.documentElement.style.removeProperty("--dashboard-title-h");
    };
  }, []);

  const rank = user?.rankcode ?? "";
  const lastName =
    user?.lastname || (user?.fullname ? user.fullname.trim().split(/\s+/).slice(-1)[0] : "");
  const title = user
    ? `Welcome, ${rank ? rank + " " : ""}${lastName} 👋`
    : "Fire Safety Inspection Monitoring";

  const stickyTitle = (
    <StickyPageTop ref={attachTitle} className="space-y-0">
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
    </StickyPageTop>
  );

  const stickyFilter = (
    <Suspense fallback={<FilterBarFallback />}>
      <FilterBar />
    </Suspense>
  );

  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          {stickyTitle}
          {stickyFilter}
          <DashboardBodyFallback />
        </div>
      }
    >
      <DashboardBody stickyTitle={stickyTitle} stickyFilter={stickyFilter} />
    </Suspense>
  );
}
