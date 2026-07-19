import { useEffect, useRef, useState } from "react";
import { loadingBus } from "@/lib/loading-bus";

/**
 * Global centered loading overlay.
 *
 * - SHOW_DELAY_MS avoids flashing the overlay for very fast requests.
 * - MIN_VISIBLE_MS prevents strobing when overlay does show.
 * - `pointer-events-none` on the backdrop keeps the UI interactive so the
 *   browser never marks the page as unresponsive if a request stalls.
 * - Safety cap in loading-bus auto-clears after 20s so the overlay can
 *   never get stuck on-screen.
 */
const SHOW_DELAY_MS = 400;
const MIN_VISIBLE_MS = 200;

export default function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(false);

  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    const unsub = loadingBus.subscribe((active) => {
      if (active) {
        if (hideTimerRef.current !== null) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }
        if (showTimerRef.current === null && shownAtRef.current === null) {
          showTimerRef.current = window.setTimeout(() => {
            showTimerRef.current = null;
            shownAtRef.current = performance.now();
            setVisible(true);
          }, SHOW_DELAY_MS);
        }
      } else {
        if (showTimerRef.current !== null) {
          window.clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }
        if (shownAtRef.current !== null) {
          const elapsed = performance.now() - shownAtRef.current;
          const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
          hideTimerRef.current = window.setTimeout(() => {
            hideTimerRef.current = null;
            shownAtRef.current = null;
            setVisible(false);
          }, remaining);
        } else {
          setVisible(false);
        }
      }
    });
    return () => {
      unsub();
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Loading"
      role="status"
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40"
      style={{ contain: "strict" }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-4 rounded-2xl border bg-card px-8 py-6 shadow-2xl">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div
            aria-hidden="true"
            className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary"
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">Loading…</p>
          <p className="mt-1 text-xs text-muted-foreground">Please wait a moment.</p>
        </div>
      </div>
    </div>
  );
}
