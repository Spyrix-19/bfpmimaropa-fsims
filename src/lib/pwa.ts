/**
 * Single, guarded service-worker registration wrapper.
 *
 * The service worker only ever registers in a real production deployment.
 * In dev, inside iframes, or on any Lovable preview host, we actively
 * unregister stale workers so the editor preview never serves cached HTML.
 *
 * Authentication is untouched: tokens live in local/session storage and are
 * never written to Cache Storage (API requests are excluded from caching).
 */

const SW_URL = "/sw.js";

function isPreviewOrDevContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw")) {
    if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  }
  return false;
}

async function unregisterAppWorkers(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => {
          const url =
            registration.active?.scriptURL ??
            registration.waiting?.scriptURL ??
            registration.installing?.scriptURL ??
            "";
          return url.endsWith(SW_URL);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    /* no-op */
  }
}

/**
 * Registers the generated service worker and invokes `onNeedRefresh` when a
 * newer build is waiting. Returns a function that activates the new version.
 */
export function registerServiceWorker(onNeedRefresh: (activate: () => void) => void): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  if (isPreviewOrDevContext()) {
    void unregisterAppWorkers();
    return;
  }

  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          onNeedRefresh(() => void updateSW(true));
        },
      });
    })
    .catch(() => {
      /* registration is best-effort; the app must keep working without it */
    });
}
