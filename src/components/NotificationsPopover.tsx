import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, RefreshCw, Trash2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAuth, FSIMS_SYSTEMNO } from "@/lib/auth";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { formatDateTime } from "@/lib/date-format";
import { notificationAPI } from "@/services/notificationAPI";
import type { NotificationModel } from "@/types/notificationType";

const PAGE_SIZE = 20;

/**
 * Notifications — backed by the live `/api/v1/Notification/*` endpoints.
 * Fields from `NotificationModel` are rendered as-is (no aliasing/mapping).
 */
export function NotificationsPopover() {
  const { user, systemAccess } = useAuth();
  const [items, setItems] = useState<NotificationModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const memberno = user?.memberno ?? "";
  const stationno = user?.stationno || EMPTY_GUID;
  const roleno = systemAccess?.roleno ?? 0;

  const load = useCallback(async () => {
    if (!memberno) return;
    setLoading(true);
    const resp = await notificationAPI.getLedger(
      {
        searchkey: "",
        systemno: FSIMS_SYSTEMNO,
        stationno,
        pagenumber: 1,
        pagesize: PAGE_SIZE,
      },
      { suppressGlobalLoading: true, suppressErrorToast: true },
    );
    const { ok, data, error } = unwrap<NotificationModel[]>(resp);
    if (!ok) {
      // "No data found" style responses are an empty inbox, not an error.
      const isEmpty = /no\s*data|no\s*record/i.test(error ?? "");
      if (!isEmpty) toast.error(error || "Unable to load notifications.");
      setItems([]);
    } else {
      setItems(Array.isArray(data) ? data : []);
    }

    setLoading(false);
  }, [memberno, stationno]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((i) => !i.isread).length, [items]);
  const visible = useMemo(
    () => (filter === "unread" ? items.filter((i) => !i.isread) : items),
    [items, filter],
  );

  const markRead = async (list: NotificationModel[]) => {
    const targets = list.filter((n) => !n.isread);
    if (targets.length === 0 || !memberno) return;
    setBusy(true);
    const resp = await notificationAPI.readNotif({
      readby: memberno,
      notificationList: targets.map((n) => ({ notificationno: n.notificationno })),
    });
    const { ok, error } = unwrap(resp);
    setBusy(false);
    if (!ok) {
      toast.error(error || "Unable to mark notifications as read.");
      return;
    }
    await load();
  };

  const removeOne = async (n: NotificationModel) => {
    if (!memberno) return;
    setBusy(true);
    const resp = await notificationAPI.delete({
      notificationno: n.notificationno,
      deletedby: memberno,
      roleno,
    });
    const { ok, error } = unwrap(resp);
    setBusy(false);
    if (!ok) {
      toast.error(error || "Unable to delete notification.");
      return;
    }
    toast.success("Notification deleted.");
    await load();
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh notifications"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => void markRead(items)}
              disabled={unreadCount === 0 || busy}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1 border-b border-border/60 px-2 py-1.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60",
              )}
            >
              {f}
              {f === "unread" && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>

        <ScrollArea className="h-[22rem]">
          {loading && items.length === 0 ? (
            <div className="flex h-[22rem] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex h-[22rem] flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground">
                No {filter === "unread" ? "unread " : ""}notifications right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {visible.map((n) => (
                <li key={n.notificationno} className="group relative">
                  <button
                    type="button"
                    onClick={() => void markRead([n])}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2.5 pr-9 text-left transition-colors hover:bg-muted/60",
                      !n.isread && "bg-primary/5",
                    )}
                  >
                    <span
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted"
                      style={n.color ? { color: n.color, backgroundColor: `${n.color}1a` } : undefined}
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            !n.isread ? "font-semibold" : "font-medium text-foreground/90",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.isread && <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {formatDateTime(n.dateencoded)}
                      </p>
                    </div>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 top-2.5 h-6 w-6 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label="Delete notification"
                    disabled={busy}
                    onClick={() => void removeOne(n)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-border/60 px-3 py-2 text-center">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
