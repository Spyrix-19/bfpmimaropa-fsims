/**
 * Tiny global loading bus.
 * - api.ts increments on every request, decrements when it settles.
 * - <GlobalLoadingOverlay /> subscribes to the *boolean* active state and
 *   shows a blocking spinner while any request is in flight.
 *
 * Safety: if `count` stays > 0 for more than MAX_ACTIVE_MS the bus force-
 * resets to 0. This is defense-in-depth against a leaked start/stop pair —
 * the app must never get stuck in an "always loading" state.
 */
type Listener = (active: boolean) => void;

const MAX_ACTIVE_MS = 20_000;

let count = 0;
let lastActive = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

function clearSafety() {
  if (safetyTimer !== null) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

function armSafety() {
  clearSafety();
  if (typeof window === "undefined") return;
  safetyTimer = setTimeout(() => {
    if (count > 0) {
      console.warn("[loadingBus] safety cap reached, force-resetting");
      count = 0;
      emit();
    }
  }, MAX_ACTIVE_MS);
}

function emit() {
  const active = count > 0;
  if (active === lastActive) return;
  lastActive = active;
  if (active) armSafety();
  else clearSafety();
  for (const l of listeners) l(active);
}

export const loadingBus = {
  start() {
    count += 1;
    emit();
  },
  stop() {
    count = Math.max(0, count - 1);
    emit();
  },
  reset() {
    count = 0;
    emit();
  },
  get() {
    return count;
  },
  isActive() {
    return lastActive;
  },
  subscribe(l: Listener) {
    listeners.add(l);
    l(lastActive);
    return () => listeners.delete(l);
  },
};
