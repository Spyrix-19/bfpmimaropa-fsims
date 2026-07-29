import { useMemo, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/date-format";
import {
  canManageAnnouncements,
  canModifyAnnouncement,
  useAnnouncementStore,
  type AnnouncementRecord,
} from "@/mock/announcements.mock";

/**
 * Announcements — its own top-nav popover, separate from notifications.
 *
 * Data currently comes from the centralized announcement mock store
 * (`src/mock/announcements.mock.ts`) until the backend exposes an endpoint.
 *
 * Permissions:
 * - Create: Super Administrator (roleno 1) or Administrator (roleno 2) whose
 *   stationtype is 25 or 26.
 * - Edit / delete: the same roles, but only on announcements they authored.
 */
export function AnnouncementsPopover() {
  const [open, setOpen] = useState(false);
  const { user, systemAccess, isAuthenticated } = useAuth();
  const { items, create, update, remove } = useAnnouncementStore();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRecord | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementRecord | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const roleno = systemAccess?.roleno ?? 0;
  const stationtype = user?.stationtype ?? 0;
  const memberno = user?.memberno ?? "";
  const canCreate = useMemo(
    () => canManageAnnouncements(roleno, stationtype),
    [roleno, stationtype],
  );

  if (!isAuthenticated) return null;

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setMessage("");
    setFormOpen(true);
  };

  const openEdit = (record: AnnouncementRecord) => {
    setEditing(record);
    setTitle(record.title);
    setMessage(record.message);
    setFormOpen(true);
  };

  const submit = () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.", { id: "announcement-form" });
      return;
    }

    if (editing) {
      update(editing.announcementno, { title, message });
      toast.success("Announcement updated.", { id: "announcement-form" });
    } else {
      create(
        { title, message },
        {
          memberno,
          name: user?.fullname || user?.name || "Unknown",
          stationname: user?.stationname || "",
        },
      );
      toast.success("Announcement posted.", { id: "announcement-form" });
    }

    setFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove(deleting.announcementno);
    toast.success("Announcement deleted.", { id: "announcement-form" });
    setDeleting(null);
  };

  const count = items.length;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Announcements" className="relative">
            <Megaphone className="h-4 w-4" />
            {count > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                aria-label={`${count} announcements`}
              >
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={8} className="w-[23rem] p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Announcements</span>
              {count > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {count}
                </span>
              )}
            </div>
            {canCreate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </Button>
            )}
          </div>

          <ScrollArea className="h-[22rem]">
            {count === 0 ? (
              <div className="flex h-[22rem] flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No announcements</p>
                <p className="text-xs text-muted-foreground">
                  {canCreate
                    ? "Post the first announcement for your personnel."
                    : "Posted updates will appear here."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((a) => {
                  const mine = canModifyAnnouncement(a, memberno, roleno, stationtype);
                  return (
                    <li key={a.announcementno} className="flex items-start gap-3 px-3 py-2.5">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        <Megaphone className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{a.title}</p>
                        <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
                          {a.message}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">
                          {a.createdbyname}
                          {a.stationname ? ` · ${a.stationname}` : ""} ·{" "}
                          {formatDateTime(a.dateposted, "—")}
                          {a.dateupdated ? " (edited)" : ""}
                        </p>
                      </div>
                      {mine && (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Edit announcement"
                            onClick={() => openEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            aria-label="Delete announcement"
                            onClick={() => setDeleting(a)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>
              Visible to all signed-in personnel in the announcements panel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q3 inspection targets released"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="announcement-message">Message</Label>
              <Textarea
                id="announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the announcement details…"
                rows={5}
                maxLength={1000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? "Save changes" : "Post announcement"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.title}” will be removed for everyone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
