import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState, type ReactElement } from "react";
import { AuthProvider, useAuth, moduleForPath, type AppModule } from "@/lib/auth";
import { FiltersProvider } from "@/lib/filters";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { PwaStatus } from "@/components/PwaStatus";
import { isMaintenanceMode } from "@/lib/maintenance";

const Maintenance = lazy(() => import("@/pages/Maintenance"));
const MaintenanceAccessBlocked = lazy(() => import("@/pages/MaintenanceAccessBlocked"));

const Dashboard = lazy(() => import("@/pages/02_dashboard/Dashboard"));
const Monitoring = lazy(() => import("./pages/04_compliance/Compliance.tsx"));
const ComplianceViewPage = lazy(
  () => import("./pages/04_compliance/components/complianceView.tsx"),
);
const ComplianceEditPage = lazy(
  () => import("./pages/04_compliance/components/complianceEdit.tsx"),
);
const TargetReference = lazy(() => import("@/pages/06_target-reference/targetreference"));
const AccomplishedNotice = lazy(() => import("@/pages/05_notices/Notice.tsx"));

const DuplicateData = lazy(() => import("@/pages/14_duplicatedata/DuplicateData.tsx"));
const Reports = lazy(() => import("@/pages/10_reports/MatrixReports.tsx"));
const FireCodeFees = lazy(() => import("@/pages/13_firecodefees/FireCodeFees.tsx"));
const IssuedBwc = lazy(() => import("@/pages/08_bwc/IssuedBwc.tsx"));
const FireSafetyInspector = lazy(() => import("@/pages/09_inspector/FireSafetyInspector.tsx"));
const InspectionsNew = lazy(() => import("./pages/04_compliance/components/complianceNew.tsx"));
const Profile = lazy(() => import("@/pages/03_profile/Profile"));
const SettingsPage = lazy(() => import("@/pages/11_settings/Settings.tsx"));
const AvailableUsers = lazy(() => import("@/pages/12_users/AvailableUsers.tsx"));
const ActiveUsers = lazy(() => import("@/pages/12_users/ActiveUsers.tsx"));
const AccessDenied = lazy(() => import("@/pages/AccessDenied"));
const TargetRevisionRequests = lazy(
  () => import("@/pages/07_revisionrequest/RevisionRequests.tsx"),
);

function RequireAccess({ module, children }: { module: AppModule; children: ReactElement }) {
  const { isAuthenticated, canAccess, initialized } = useAuth();
  const location = useLocation();

  // Never decide access before the session is resolved, otherwise a reload on a
  // protected page would bounce an authenticated user back to the dashboard.
  if (!initialized) return <PageLoader />;
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  if (!canAccess(module)) return <Navigate to="/access-denied" replace />;
  return children;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes before marking as stale
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes, then garbage collect
      gcTime: 10 * 60 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Don't refetch when window regains focus (prevent memory spike on tab switch)
      refetchOnWindowFocus: false,
      // Don't refetch on component mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Don't retry mutations automatically (user should handle retries)
      retry: 0,
    },
  },
});

function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground">
      Loading page…
    </div>
  );
}

function AppContent({
  maintenance,
  maintenanceLoginAttempt,
}: {
  maintenance: boolean;
  maintenanceLoginAttempt: boolean;
}) {
  const { isSuperAdmin, initialized, restorePending, hasRole } = useAuth();
  // Only hold the whole router while an existing stored session is decrypting.
  // Signed-out visitors render the (public) dashboard straight away.
  if (restorePending) return <PageLoader />;
  const isSuperAdminUser = isSuperAdmin() || hasRole(1);
  // During maintenance the original Maintenance page remains the only visible UI.
  // The login-specific access-status section is appended only after an actual
  // login attempt, and super-admin users bypass the gate. Wait for the session
  // to resolve first so a super admin is never shown the gate by mistake.
  if (maintenance) {
    if (!initialized) return <PageLoader />;
    if (!isSuperAdminUser) {
      return <Maintenance showAccessStatus={maintenanceLoginAttempt} />;
    }
    // Super admin bypasses maintenance
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route
        path="/profile"
        element={
          <RequireAccess module="profile">
            <Profile />
          </RequireAccess>
        }
      />
      <Route
        path="/monitoring"
        element={
          <RequireAccess module="monitoring">
            <Monitoring />
          </RequireAccess>
        }
      />
      <Route
        path="/monitoring/view/:stationno/:year/:month"
        element={
          <RequireAccess module="monitoring">
            <ComplianceViewPage />
          </RequireAccess>
        }
      />
      <Route
        path="/monitoring/edit/:stationno/:year/:month"
        element={
          <RequireAccess module="monitoring">
            <ComplianceEditPage />
          </RequireAccess>
        }
      />
      <Route
        path="/target-reference"
        element={
          <RequireAccess module="monitoring">
            <TargetReference />
          </RequireAccess>
        }
      />
      <Route
        path="/accomplished-notice"
        element={
          <RequireAccess module="monitoring">
            <AccomplishedNotice />
          </RequireAccess>
        }
      />

      <Route
        path="/target-revision-requests"
        element={
          <RequireAccess module="target-revisions">
            <TargetRevisionRequests
              moduleFilter="target-reference"
              title="Target Reference Requests"
              description="Review, approve, or deny revision requests submitted against locked Target Reference months."
            />
          </RequireAccess>
        }
      />
      <Route
        path="/monitoring-revision-requests"
        element={
          <RequireAccess module="target-revisions">
            <TargetRevisionRequests
              moduleFilter="monitoring"
              title="Monitoring (Compliance) Requests"
              description="Review, approve, or deny revision requests submitted against locked Fire Safety Compliance monitoring records."
            />
          </RequireAccess>
        }
      />
      <Route
        path="/revision-requests"
        element={
          <RequireAccess module="target-revisions">
            <TargetRevisionRequests
              title="Revision Requests"
              description="Review, approve, or deny all revision requests submitted against locked records."
            />
          </RequireAccess>
        }
      />

      <Route
        path="/duplicate-data"
        element={
          <RequireAccess module="duplicate-data">
            <DuplicateData />
          </RequireAccess>
        }
      />
      <Route
        path="/reports"
        element={
          <RequireAccess module="reports">
            <Reports />
          </RequireAccess>
        }
      />
      <Route
        path="/collection/fire-code-fees"
        element={
          <RequireAccess module="collection">
            <FireCodeFees />
          </RequireAccess>
        }
      />
      <Route
        path="/logistics"
        element={
          <RequireAccess module="logistics">
            <IssuedBwc />
          </RequireAccess>
        }
      />
      <Route
        path="/logistics/issued-bwc"
        element={
          <RequireAccess module="logistics">
            <IssuedBwc />
          </RequireAccess>
        }
      />
      <Route
        path="/logistics/fire-safety-inspector"
        element={
          <RequireAccess module="logistics">
            <FireSafetyInspector />
          </RequireAccess>
        }
      />
      <Route
        path="/inspections/new"
        element={
          <RequireAccess module="inspections">
            <InspectionsNew />
          </RequireAccess>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAccess module="settings">
            <SettingsPage />
          </RequireAccess>
        }
      />

      <Route
        path="/users/available"
        element={
          <RequireAccess module="users">
            <AvailableUsers />
          </RequireAccess>
        }
      />
      <Route
        path="/users/active"
        element={
          <RequireAccess module="users">
            <ActiveUsers />
          </RequireAccess>
        }
      />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export { moduleForPath };

export default function App() {
  // Global maintenance gate — takes precedence over routing and authentication.
  const [maintenance, setMaintenance] = useState(() => isMaintenanceMode());
  const [maintenanceLoginAttempt, setMaintenanceLoginAttempt] = useState(false);
  useEffect(() => {
    // Poll the maintenance flag periodically so runtime toggles (e.g.
    // `window.setMaintenanceMode`) take effect across already-open clients.
    const id = window.setInterval(() => {
      const next = isMaintenanceMode();
      setMaintenance(next);
      if (!next) setMaintenanceLoginAttempt(false);
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FiltersProvider>
          <BrowserRouter>
            <AppShell
              maintenance={maintenance}
              onMaintenanceLoginAttempt={setMaintenanceLoginAttempt}
            >
              <Suspense fallback={<PageLoader />}>
                <AppContent
                  maintenance={maintenance}
                  maintenanceLoginAttempt={maintenanceLoginAttempt}
                />
              </Suspense>
            </AppShell>
            <Toaster richColors position="top-right" />
            <PwaStatus />
          </BrowserRouter>
        </FiltersProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
