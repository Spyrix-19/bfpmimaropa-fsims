import { Moon, Sun, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { AnnouncementsPopover } from "@/components/AnnouncementsPopover";
import bfpLogo from "@/assets/bfp-mimaropa.svg";

const AppSidebar = lazy(() =>
  import("./AppSidebar").then((module) => ({ default: module.AppSidebar })),
);
const LoginModal = lazy(() =>
  import("../pages/01_index/LoginModal").then((module) => ({ default: module.LoginModal })),
);
const SettingsPage = lazy(() => import("@/pages/11_settings/Settings"));

function useDarkMode() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("fsims_theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  return {
    dark,
    toggle: () => {
      const next = !dark;
      setDark(next);
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("fsims_theme", next ? "dark" : "light");
    },
  };
}

function useCurrentDate() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);
  return now;
}

export function AppShell({ children }: { children: ReactNode; title?: string }) {
  const { user } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { dark, toggle } = useDarkMode();
  const now = useCurrentDate();
  const dateLabel = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        if (!user) setLoginOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [user]);

  const header = (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background sm:bg-background/70 px-4 py-2 backdrop-blur-xl sm:px-6 sm:py-3">
      <div className="flex w-full min-w-0 flex-wrap items-start justify-between gap-x-2 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[14rem] items-start gap-2">
          {user && <SidebarTrigger className="shrink-0" />}
          <div className="flex min-w-0 items-start gap-2">
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-border ${user ? "md:hidden" : ""}`}
            >
              <img
                src={bfpLogo}
                alt="BFP MIMAROPA"
                width={36}
                height={36}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="truncate text-sm font-semibold">BFP - FSI Monitoring System</div>
              <span
                className="text-xs font-medium text-foreground/80 sm:hidden"
                aria-label="Current date and time"
              >
                {dateLabel} · {timeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
          {!user ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLoginOpen(true)}
              className="whitespace-nowrap sm:hidden"
            >
              Sign in
            </Button>
          ) : null}
          <div className="hidden items-center gap-2 sm:flex">
            <div
              className="items-baseline gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground/80"
              aria-label="Current date and time"
            >
              <span>{dateLabel}</span>
              <span className="text-muted-foreground">·</span>
              <span className="tabular-nums text-muted-foreground">{timeLabel}</span>
            </div>
            {user && <AnnouncementsPopover />}
            {user && <NotificationsPopover />}
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </div>
          {user && (
            <div className="sm:hidden">
              <AnnouncementsPopover />
            </div>
          )}
          {user && (
            <div className="sm:hidden">
              <NotificationsPopover />
            </div>
          )}
          <Button
            className="sm:hidden"
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            className="sm:hidden"
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );

  const footer = (
    <footer className="px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
      <div>© {new Date().getFullYear()} FSIMS · Fire Safety Inspection Monitoring · MIMAROPA Region</div>
      <div className="mt-1">Powered by Spyrix - ICT MIMAROPA Regional Office</div>
    </footer>
  );

  const main = (
    <main className="flex-1 p-4 sm:p-6">
      <div className="w-full">{children}</div>
    </main>
  );

  if (!user) {
    return (
      <>
        <div className="flex min-h-screen w-full flex-col">
          {header}
          {main}
          {footer}
        </div>
        <Suspense fallback={null}>
          <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
        </Suspense>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent
            hideCloseButton
            className="w-full max-w-[min(100vw-1rem,48rem)] max-h-[calc(100vh-1rem)] overflow-y-auto"
          >
            <Suspense fallback={null}>
              <SettingsPage onClose={() => setSettingsOpen(false)} />
            </Suspense>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Suspense fallback={null}>
          <AppSidebar />
        </Suspense>
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          {header}
          {main}
          {footer}
        </SidebarInset>
      </div>
      <Suspense fallback={null}>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </Suspense>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent hideCloseButton className="max-w-3xl w-full max-h-[90vh] overflow-hidden">
          <Suspense fallback={null}>
            <SettingsPage onClose={() => setSettingsOpen(false)} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
