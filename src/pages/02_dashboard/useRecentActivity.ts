import * as React from "react";
import { journalAPI } from "@/services/journalAPI";
import { unwrap } from "@/lib/api-envelope";
import type { JournalModel } from "@/types/journalType";

/**
 * Recent Dashboard Activity.
 *
 * Fetches the latest journal entries (page 1) with every filter left empty,
 * so the card mirrors the newest system-wide events.
 *
 * Refresh behaviour:
 * - Skeleton only on the FIRST load.
 * - Silent background refresh every 60s: no skeleton, no spinner, no toast,
 *   and state is only written when the payload actually changed — so a poll
 *   that returns the same entry causes zero visible change.
 * - A failed background poll keeps the last good data on screen; the error
 *   state is only surfaced when there is nothing to show.
 */
const POLL_INTERVAL_MS = 60_000;
const PAGE_SIZE = 5;

export function useRecentActivity(enabled = true) {
  const [items, setItems] = React.useState<JournalModel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const loadedOnce = React.useRef(false);
  const signatureRef = React.useRef<string>("");

  const fetchLatest = React.useCallback(async (signal: AbortSignal, background = false) => {
    // Background polls never flip the loading flag, so the card keeps
    // rendering its current content untouched.
    if (!background && !loadedOnce.current) setLoading(true);

    const resp = await journalAPI.getLedger(
      { searchkey: "", modulename: "", pagenumber: 1, pagesize: PAGE_SIZE },
      {
        suppressGlobalLoading: true,
        // The card renders its own inline error banner, so no toast here —
        // otherwise the same message would be shown twice.
        suppressErrorToast: true,
        signal,
        retries: 3,
        retryDelayMs: 800,
      },
    );

    const { ok, data, canceled } = unwrap<JournalModel[]>(resp);
    if (canceled || signal.aborted) return;

    if (!ok) {
      if (background && loadedOnce.current) {
        // Silent failure: keep showing the last known entry.
        return;
      }
      setError("Unable to load recent activity.");
    } else {
      setError(null);

      const next = Array.isArray(data) ? data.slice(0, PAGE_SIZE) : [];
      const signature = JSON.stringify(next);
      // Skip the state write (and the re-render) when nothing changed.
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setItems(next);
      }
    }

    loadedOnce.current = true;
    if (!background) setLoading(false);
  }, []);

  const [refreshKey, setRefreshKey] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshKey((k) => k + 1), []);

  React.useEffect(() => {
    // Signed-out visitors never see (or fetch) the activity feed.
    if (!enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    void fetchLatest(controller.signal);

    const timer = window.setInterval(() => {
      if (document.hidden) return; // don't poll a background tab
      void fetchLatest(controller.signal, true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [fetchLatest, refreshKey, enabled]);

  return { activity: items, loading, error, refresh };
}
