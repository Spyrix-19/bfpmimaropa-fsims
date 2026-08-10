import { useCallback, useEffect, useSyncExternalStore } from "react";
import { announcementAPI } from "@/services/announcementAPI";
import { unwrap } from "@/lib/api-envelope";
import { useAuth } from "@/lib/auth";

/** How often the unread badge re-syncs with the backend (ms). */
const POLL_INTERVAL_MS = 120_000;
/** Hard floor between two network calls, no matter how many triggers fire. */
const MIN_FETCH_GAP_MS = 20_000;

/**
 * Lightweight singleton store for the unread announcement badge.
 *
 * Performance guarantees:
 * - ONE shared request and ONE shared timer for the whole app, regardless of
 *   how many components render the badge.
 * - Requests are throttled (`MIN_FETCH_GAP_MS`) and de-duplicated, so bursts of
 *   focus/visibility/mount events cannot stack up calls.
 * - Polling is paused while the tab is hidden and while offline.
 * - The request itself is cheap: no retries, short timeout, no global loading
 *   bar, no error toasts — a failed badge refresh is silent and harmless.
 */
const listeners = new Set<() => void>();

let count = 0;
let memberno = "";
let inFlight: Promise<void> | null = null;
let lastFetchedAt = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let subscriberCount = 0;

function emit() {
  listeners.forEach((l) => l());
}

function setCount(next: number) {
  if (next === count) return;
  count = next;
  emit();
}

/**
 * Normalizes the `/api/v1/Announcement/UnreadCount` payload. The endpoint may
 * return a plain number, an object carrying a count, or the list of unread
 * announcements — all three are reduced to a single number here.
 */
function toCount(data: unknown): number {
  if (typeof data === "number") return Number.isFinite(data) ? data : 0;
  if (typeof data === "string") {
    const parsed = Number(data);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["unreadcount", "unreadCount", "count", "total", "totalcount"]) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
    }
  }
  return 0;
}

/** Single throttled + de-duplicated fetch. `force` skips only the throttle. */
function fetchCount(force = false): Promise<void> {
  if (!memberno) return Promise.resolve();
  if (inFlight) return inFlight;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.resolve();
  if (!force && Date.now() - lastFetchedAt < MIN_FETCH_GAP_MS) return Promise.resolve();

  inFlight = (async () => {
    const resp = await announcementAPI.UnreadCount(
      { memberno },
      {
        // Badge polling must never be expensive or noisy.
        retries: 0,
        timeout: 8000,
        suppressGlobalLoading: true,
        suppressErrorToast: true,
      },
    );
    const { ok, data } = unwrap<unknown>(resp);
    if (ok) setCount(toCount(data));
    lastFetchedAt = Date.now();
  })()
    .catch(() => {
      lastFetchedAt = Date.now();
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function onFocusOrVisible() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
  void fetchCount();
}

function startPolling() {
  if (timer !== null) return;
  timer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    void fetchCount(true);
  }, POLL_INTERVAL_MS);
  window.addEventListener("focus", onFocusOrVisible);
  document.addEventListener("visibilitychange", onFocusOrVisible);
}

function stopPolling() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  window.removeEventListener("focus", onFocusOrVisible);
  document.removeEventListener("visibilitychange", onFocusOrVisible);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscriberCount += 1;
  if (subscriberCount === 1) startPolling();
  return () => {
    listeners.delete(listener);
    subscriberCount -= 1;
    if (subscriberCount === 0) stopPolling();
  };
}

const getSnapshot = () => count;

/** Ask the shared badge to re-fetch right away (bypasses the throttle). */
export function refreshAnnouncementUnreadCount() {
  void fetchCount(true);
}

/** Reset the badge, e.g. on sign-out. */
function reset() {
  memberno = "";
  lastFetchedAt = 0;
  setCount(0);
}

/**
 * Live unread announcement count for the signed-in member.
 *
 * All mounted instances share one request, one timer, and one cached value, so
 * adding the badge in more places costs nothing extra at runtime.
 */
export function useAnnouncementUnreadCount() {
  const { user, isAuthenticated } = useAuth();
  const currentMember = user?.memberno ?? "";
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!isAuthenticated || !currentMember) {
      reset();
      return;
    }
    if (memberno !== currentMember) {
      memberno = currentMember;
      lastFetchedAt = 0;
      setCount(0);
    }
    void fetchCount();
  }, [isAuthenticated, currentMember]);

  const refresh = useCallback(async () => {
    await fetchCount(true);
  }, []);

  return { count: value, refresh };
}
