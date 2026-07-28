import { useMemo, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, FileText, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NotifType = "info" | "success" | "warning" | "report";

type Notification = {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string; // relative label
  read: boolean;
};

const SAMPLE: Notification[] = [
  {
    id: "n1",
    type: "warning",
    title: "Overdue inspection",
    message: "SM City Puerto Princesa has an inspection overdue by 3 days.",
    time: "10 min ago",
    read: false,
  },
  {
    id: "n2",
    type: "report",
    title: "Monthly matrix ready",
    message: "July 2026 monitoring matrix has finished compiling.",
    time: "1 hr ago",
    read: false,
  },
  {
    id: "n3",
    type: "success",
    title: "FSIC approved",
    message: "FSIC-BP #2026-0421 for Robinsons Palawan was approved.",
    time: "3 hrs ago",
    read: false,
  },
  {
    id: "n4",
    type: "info",
    title: "New establishment registered",
    message: "Ace Hardware – Calapan City was added by Insp. Ramos.",
    time: "Yesterday",
    read: true,
  },
  {
    id: "n5",
    type: "info",
    title: "System maintenance",
    message: "Scheduled downtime on Aug 02, 2026, 11:00 PM – 12:30 AM.",
    time: "2 days ago",
    read: true,
  },
];

const typeStyles: Record<NotifType, { icon: typeof Bell; className: string }> = {
  info: { icon: Info, className: "text-sky-500 bg-sky-500/10" },
  success: { icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10" },
  warning: { icon: AlertTriangle, className: "text-amber-500 bg-amber-500/10" },
  report: { icon: FileText, className: "text-violet-500 bg-violet-500/10" },
};

export function NotificationsPopover() {
  const [items, setItems] = useState<Notification[]>(SAMPLE);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);
  const visible = useMemo(
    () => (filter === "unread" ? items.filter((i) => !i.read) : items),
    [items, filter],
  );

  const markAllRead = () => setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  const toggleRead = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: !i.read } : i)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
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
          {visible.length === 0 ? (
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
              {visible.map((n) => {
                const { icon: Icon, className } = typeStyles[n.type];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => toggleRead(n.id)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                        !n.read && "bg-primary/5",
                      )}
                    >
                      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", className)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn("truncate text-sm", !n.read ? "font-semibold" : "font-medium text-foreground/90")}>
                            {n.title}
                          </p>
                          {!n.read && <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">{n.time}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t border-border/60 px-3 py-2 text-center">
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setOpen(false)}
          >
            View all notifications
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
