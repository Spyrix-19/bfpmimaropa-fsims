import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactElement } from "react";
import { AuthProvider, useAuth, moduleForPath, type AppModule } from "@/lib/auth";
import { FiltersProvider } from "@/lib/filters";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

const Dashboard = lazy(() => import("@/pages/02_dashboard/Dashboard"));
const Monitoring = lazy(() => import("./pages/04_compliance/Compliance.tsx"));
const ComplianceViewPage = lazy(() => import("./pages/04_compliance/components/complianceView.tsx"));
const ComplianceEditPage = lazy(() => import("./pages/04_compliance/components/complianceEdit.tsx"));
const TargetReference = lazy(() => import("@/pages/06_target-reference/targetreference"));
const AccomplishedNotice = lazy(() => import("@/pages/05_notices/Notice.tsx"));

const Reports = lazy(() => import("@/pages/08_reports/MatrixReports.tsx"));
const InspectionsNew = lazy(() => import("./pages/04_compliance/components/complianceNew.tsx"));
const Profile = lazy(() => import("@/pages/03_profile/Profile"));
const SettingsPage = lazy(() => import("@/pages/10_settings/Settings"));
const AvailableUsers = lazy(() => import("@/pages/09_users/AvailableUsers"));
const ActiveUsers = lazy(() => import("@/pages/09_users/ActiveUsers"));
const AccessDenied = lazy(() => import("@/pages/AccessDenied"));
const TargetRevisionRequests = lazy(
  () => import("@/pages/07_revisionrequest/RevisionRequests.tsx"),
);

function RequireAccess({ module, children }: { module: AppModule; children: ReactElement }) {
  const { isAuthenticated, canAccess, initialized } = useAuth();
  const location = useLocation();

  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to="/" replace state={{ from: location }} />;
  if (!canAccess(module)) return <Navigate to="/access-denied" replace />;
  return children;
}

const queryClient = new QueryClient();

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

export { moduleForPath };

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FiltersProvider>
          <BrowserRouter>
            <AppShell>
              <Suspense fallback={<PageLoader />}>
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
                    path="/reports"
                    element={
                      <RequireAccess module="reports">
                        <Reports />
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
              </Suspense>
            </AppShell>
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </FiltersProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
