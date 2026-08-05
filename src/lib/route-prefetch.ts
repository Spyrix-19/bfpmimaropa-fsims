// Warms lazy route chunks before the user clicks, so navigation feels instant
// instead of waiting on a cold dynamic import.
const LOADERS: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/02_dashboard/Dashboard"),
  "/profile": () => import("@/pages/03_profile/Profile"),
  "/monitoring": () => import("./../pages/04_compliance/Compliance.tsx"),
  "/target-reference": () => import("@/pages/06_target-reference/targetreference"),
  "/accomplished-notice": () => import("@/pages/05_notices/Notice.tsx"),
  "/revision-requests": () => import("@/pages/07_revisionrequest/RevisionRequests.tsx"),
  "/target-revision-requests": () => import("@/pages/07_revisionrequest/RevisionRequests.tsx"),
  "/monitoring-revision-requests": () => import("@/pages/07_revisionrequest/RevisionRequests.tsx"),
  "/reports": () => import("@/pages/10_reports/MatrixReports.tsx"),
  "/logistics": () => import("@/pages/08_bwc/IssuedBwc.tsx"),
  "/logistics/issued-bwc": () => import("@/pages/08_bwc/IssuedBwc.tsx"),
  "/logistics/fire-safety-inspector": () => import("@/pages/09_inspector/FireSafetyInspector.tsx"),
  "/settings": () => import("@/pages/11_settings/Settings.tsx"),
  "/users/available": () => import("@/pages/12_users/AvailableUsers.tsx"),
  "/users/active": () => import("@/pages/12_users/ActiveUsers.tsx"),
};

const warmed = new Set<string>();

export function prefetchRoute(path: string) {
  const loader = LOADERS[path];
  if (!loader || warmed.has(path)) return;
  warmed.add(path);
  loader().catch(() => warmed.delete(path));
}
