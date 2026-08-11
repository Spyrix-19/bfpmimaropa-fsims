import { useEffect, useRef, useState } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { registerServiceWorker } from "@/lib/pwa";

/**
 * PWA runtime layer:
 *  - registers the production service worker (guarded, see lib/pwa.ts)
 *  - surfaces an "update available" toast using the app's existing sonner setup
 *  - renders a small, non-intrusive offline pill
 *
 * It renders nothing while online and never blocks the UI.
 */
export function PwaStatus() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const registered = useRef(false);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;
    registerServiceWorker((activate) => {
      toast("New version available", {
        description: "Update the application to continue.",
        duration: Infinity,
        action: { label: "Update", onClick: () => activate() },
      });
    });
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <span className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-elegant backdrop-blur">
        <WifiOff className="h-3.5 w-3.5 text-destructive" />
        Offline — showing last loaded screen
      </span>
    </div>
  );
}
