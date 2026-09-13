/**
 * Global maintenance-mode flag.
 *
 * VITE_BFP_MIMAROPA_MAINTENANCE="TRUE" (any casing) → whole application is gated
 * anything else / missing                            → normal application behaviour
 *
 * Always import this constant instead of reading the env var directly.
 */
/**
 * Runtime controllable maintenance-mode flag.
 *
 * Reads the build-time env var on initialization but can be toggled at runtime
 * by calling `setMaintenanceMode(true|false)` or by using the window helper
 * `window.setMaintenanceMode` (attached for convenience).
 */
let current =
  String((import.meta.env?.VITE_BFP_MIMAROPA_MAINTENANCE as string | undefined) ?? "")
    .trim()
    .toUpperCase() === "TRUE";

const listeners = new Set<(v: boolean) => void>();

export function isMaintenanceMode() {
  return current;
}

export function setMaintenanceMode(v: boolean) {
  if (current === v) return;
  current = v;
  for (const cb of Array.from(listeners)) cb(current);
}

export function subscribeMaintenance(cb: (v: boolean) => void) {
  listeners.add(cb);
  // invoke immediately with current value so subscribers are in sync
  cb(current);
  return () => listeners.delete(cb);
}

// Expose a small helper for manual toggling from the console (convenience only).
declare global {
  interface Window {
    setMaintenanceMode?: (v: boolean) => void;
  }
}

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).setMaintenanceMode = setMaintenanceMode;
}

export default isMaintenanceMode;
