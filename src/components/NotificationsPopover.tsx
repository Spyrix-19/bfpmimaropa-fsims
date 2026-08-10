import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Trash2,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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

const PAGE_SIZE = 50;
/** Notifications shown per page inside the popover list. */
const VIEW_PAGE_SIZE = 5;

/**
 * Notifications — backed by the live `/api/v1/Notification/*` endpoints.
 * Fields from `NotificationModel` are rendered as-is (no aliasing/mapping).
 */
export function NotificationsPopover() {
  const { user, systemAccess } = useAuth();
  const [items, setItems] = useState<NotificationModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  const memberno = user?.memberno ?? "";
  const stationno = user?.stationno || EMPTY_GUID;
  const roleno = systemAccess?.roleno ?? 0;
  const stationtype = Number(user?.stationtype ?? 0) || 0;

  const load = useCallback(async () => {
    if (!memberno) return;
    setLoading(true);
    const resp = await notificationAPI.getLedger(
      {
        searchkey: "",
        memberno,
        systemno: FSIMS_SYSTEMNO,
        stationno,
        roleno,
        stationtype,
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
  }, [memberno, stationno, roleno, stationtype]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = useMemo(() => items.filter((i) => !i.isread).length, [items]);
  const readCount = useMemo(() => items.filter((i) => i.isread).length, [items]);
  const visible = useMemo(() => {
    if (filter === "unread") return items.filter((i) => !i.isread);
    if (filter === "read") return items.filter((i) => i.isread);
    return items;
  }, [items, filter]);

  const pageCount = Math.max(1, Math.ceil(visible.length / VIEW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => visible.slice((safePage - 1) * VIEW_PAGE_SIZE, safePage * VIEW_PAGE_SIZE),
    [visible, safePage],
  );

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

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
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
    >
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
          {(["all", "unread", "read"] as const).map((f) => (
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
              {f === "all" && items.length > 0 && ` (${items.length})`}
              {f === "unread" && unreadCount > 0 && ` (${unreadCount})`}
              {f === "read" && readCount > 0 && ` (${readCount})`}
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
                No {filter === "all" ? "" : `${filter} `}notifications right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {paged.map((n) => (
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
                      style={
                        n.color ? { color: n.color, backgroundColor: `${n.color}1a` } : undefined
                      }
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words text-sm",
                            !n.isread ? "font-semibold" : "font-medium text-foreground/90",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.isread && (
                          <Circle className="mt-1.5 h-2 w-2 shrink-0 fill-primary text-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {n.message}
                      </p>
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

        {!loading && (
          <div className="grid grid-cols-3 items-center border-t border-border/60 px-3 py-2">
            <div className="flex justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Previous page"
                className="h-7 gap-1 rounded-full px-2.5 text-xs"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
            </div>
            <span className="text-center text-xs text-muted-foreground">{`Page ${safePage} of ${pageCount}`}</span>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Next page"
                className="h-7 gap-1 rounded-full px-2.5 text-xs"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

      </PopoverContent>
    </Popover>
  );
}
