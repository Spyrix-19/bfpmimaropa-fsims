import { useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Users,
  Globe2,
  Map as MapIcon,
  Building2,
  UserRound,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { useAuth, FSIMS_SYSTEMNO } from "@/lib/auth";
import { formatDateTime, toDateInput } from "@/lib/date-format";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import { announcementAPI } from "@/services/announcementAPI";
import type { AnnouncementViewerRequestClass } from "@/types/announcementType";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import LocationMultiSelect, { type SelectedLocation } from "@/components/location-multi-select";
import StationMultiSelect, { type SelectedStation } from "@/components/station-multi-select";
import PersonnelMultiSelect, {
  type SelectedPersonnel,
} from "@/components/personnel-multi-select";
import { useAnnouncementUnreadCount, refreshAnnouncementUnreadCount } from "@/hooks/useAnnouncementUnreadCount";
import {
  canManageAnnouncements,
  canModifyAnnouncement,
  useAnnouncementStore,
  type AnnouncementRecord,
} from "@/mock/announcements.mock";

/** Who the announcement is addressed to. */
type AudienceScope = "ALL" | "PROVINCE" | "STATION" | "PERSONNEL";

const AUDIENCE_OPTIONS: {
  value: AudienceScope;
  label: string;
  icon: typeof Globe2;
}[] = [
  { value: "ALL", label: "Everyone", icon: Globe2 },
  { value: "PROVINCE", label: "Provinces", icon: MapIcon },
  { value: "STATION", label: "Stations", icon: Building2 },
  { value: "PERSONNEL", label: "Personnel", icon: UserRound },
];

/** Compact removable chips summarizing the picked recipients. */
function RecipientChips({
  items,
  onRemove,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-[11px] font-medium text-primary"
        >
          <span className="truncate">{item.label}</span>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.label}`}
            className="grid h-4 w-4 shrink-0 place-items-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}




/**
 * Announcements — its own top-nav popover, separate from notifications.
 *
 * Data currently comes from the centralized announcement mock store
 * (`src/mock/announcements.mock.ts`), which starts empty until the backend
 * exposes an announcement endpoint.
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
  const { count: unreadCount, refresh: refreshUnread } = useAnnouncementUnreadCount();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRecord | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementRecord | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [startdate, setStartdate] = useState("");
  const [enddate, setEnddate] = useState("");
  const [audience, setAudience] = useState<AudienceScope>("ALL");
  const [provinces, setProvinces] = useState<SelectedLocation[]>([]);
  const [stations, setStations] = useState<SelectedStation[]>([]);
  const [personnel, setPersonnel] = useState<SelectedPersonnel[]>([]);
  const [saving, setSaving] = useState(false);

  const roleno = systemAccess?.roleno ?? 0;
  const stationtype = user?.stationtype ?? 0;
  const memberno = user?.memberno ?? "";
  const canCreate = useMemo(
    () => canManageAnnouncements(roleno, stationtype),
    [roleno, stationtype],
  );

  if (!isAuthenticated) return null;

  const resetAudience = () => {
    setAudience("ALL");
    setProvinces([]);
    setStations([]);
    setPersonnel([]);
  };

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setMessage("");
    setStartdate("");
    setEnddate("");
    resetAudience();
    setFormOpen(true);
  };

  const openEdit = (record: AnnouncementRecord) => {
    setEditing(record);
    setTitle(record.title);
    setMessage(record.message);
    setStartdate(toDateInput(record.startdate));
    setEnddate(toDateInput(record.enddate));
    setAudience(record.audience ?? "ALL");
    setProvinces((record.provinces ?? []) as SelectedLocation[]);
    setStations((record.stations ?? []) as SelectedStation[]);
    setPersonnel((record.personnel ?? []) as SelectedPersonnel[]);
    setFormOpen(true);
  };

  /** The exact payload used for both create + update so nothing is dropped. */
  const formPayload = () => ({
    title: title.trim(),
    message: message.trim(),
    startdate,
    enddate,
    audience,
    provinces: provinces.map((p) => ({
      locationno: p.locationno,
      locationname: p.locationname,
    })),
    stations: stations.map((s) => ({ stationno: s.stationno, stationname: s.stationname })),
    personnel: personnel.map((p) => ({ memberno: p.memberno, fullname: p.fullname })),
  });

  const buildViewers = (): AnnouncementViewerRequestClass[] => {
    if (audience === "PROVINCE")
      return provinces.map((p) => ({ viewertype: "PROVINCE", viewerno: p.locationno }));
    if (audience === "STATION")
      return stations.map((s) => ({ viewertype: "STATION", viewerno: s.stationno }));
    if (audience === "PERSONNEL")
      return personnel.map((p) => ({ viewertype: "PERSONNEL", viewerno: p.memberno }));
    return [{ viewertype: "ALL", viewerno: EMPTY_GUID }];
  };

  const submit = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required.", { id: "announcement-form" });
      return;
    }
    if (!startdate || !enddate) {
      toast.error("Start and end dates are required.", { id: "announcement-form" });
      return;
    }
    if (new Date(enddate) < new Date(startdate)) {
      toast.error("End date cannot be before the start date.", { id: "announcement-form" });
      return;
    }
    const viewers = buildViewers();
    if (audience !== "ALL" && viewers.length === 0) {
      toast.error("Select at least one recipient.", { id: "announcement-form" });
      return;
    }

    setSaving(true);
    const resp = await announcementAPI.create({
      announcementno: editing?.announcementno || EMPTY_GUID,
      title: title.trim(),
      summary: message.trim().slice(0, 200),
      content: message.trim(),
      priority: "NORMAL",
      imageurl: "",
      attachmenturl: "",
      ispinned: false,
      ispopup: false,
      isactive: true,
      startdate,
      enddate,
      systemnos: [FSIMS_SYSTEMNO],
      viewers,
      encodedby: memberno,
    });
    const { ok, error } = unwrap(resp);
    setSaving(false);

    if (!ok) {
      toast.error(error || "Unable to save the announcement.", { id: "announcement-form" });
      return;
    }

    if (editing) {
      update(editing.announcementno, formPayload());
      toast.success("Announcement updated.", { id: "announcement-form" });
    } else {
      create(
        formPayload(),
        {
          memberno,
          name: user?.fullname || user?.name || "Unknown",
          stationname: user?.stationname || "",
        },
      );
      toast.success("Announcement posted.", { id: "announcement-form" });
    }
    refreshAnnouncementUnreadCount();

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

  const markAllRead = async () => {
    if (!memberno || unreadCount === 0) return;
    const resp = await announcementAPI.ReadAll({ memberno });
    const { ok } = unwrap(resp);
    if (ok) await refreshUnread();
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) {
            void refreshUnread();
            void markAllRead();
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Announcements" className="relative">
            <Megaphone className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                aria-label={`${unreadCount} unread announcements`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-4">
            <DialogHeader className="space-y-1 text-left">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold tracking-tight">
                    {editing ? "Edit announcement" : "New announcement"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Set the message, how long it stays visible, and who receives it.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Title
                </Label>
                <Input
                  id="announcement-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 inspection targets released"
                  maxLength={120}
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="announcement-message" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Message
                  </Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {message.length}/1000
                  </span>
                </div>
                <Textarea
                  id="announcement-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the announcement details…"
                  rows={5}
                  maxLength={1000}
                  className="resize-none bg-background"
                />
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Display duration
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-start" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="announcement-start"
                    type="date"
                    value={startdate}
                    onChange={(e) => setStartdate(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="announcement-end" className="text-xs text-muted-foreground">
                    Until
                  </Label>
                  <Input
                    id="announcement-end"
                    type="date"
                    value={enddate}
                    min={startdate || undefined}
                    onChange={(e) => setEnddate(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Audience
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {AUDIENCE_OPTIONS.map((o) => {
                  const Icon = o.icon;
                  const active = audience === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setAudience(o.value);
                        setProvinces([]);
                        setStations([]);
                        setPersonnel([]);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="leading-tight">{o.label}</span>
                    </button>
                  );
                })}
              </div>

              {audience === "PROVINCE" && (
                <div className="space-y-2">
                  <LocationMultiSelect
                    mode="location"
                    locationtype="PROVINCE"
                    parentcode={MIMAROPA_REGION_CODE}
                    hideCode
                    value={provinces}
                    onChange={setProvinces}
                    placeholder="Select provinces"
                  />
                  <RecipientChips
                    items={provinces.map((p) => ({ id: p.locationno, label: p.locationname }))}
                    onRemove={(id) => setProvinces(provinces.filter((p) => p.locationno !== id))}
                  />
                </div>
              )}

              {audience === "STATION" && (
                <div className="space-y-2">
                  <StationMultiSelect
                    mode="station"
                    provinces={[]}
                    alwaysEnabled
                    value={stations}
                    onChange={setStations}
                  />
                  <RecipientChips
                    items={stations.map((s) => ({ id: s.stationno, label: s.stationname }))}
                    onRemove={(id) => setStations(stations.filter((s) => s.stationno !== id))}
                  />
                </div>
              )}

              {audience === "PERSONNEL" && (
                <div className="space-y-2">
                  <PersonnelMultiSelect value={personnel} onChange={setPersonnel} />
                  <RecipientChips
                    items={personnel.map((p) => ({ id: p.memberno, label: p.fullname }))}
                    onRemove={(id) => setPersonnel(personnel.filter((p) => p.memberno !== id))}
                  />
                </div>
              )}

              {audience === "ALL" && (
                <p className="text-xs text-muted-foreground">
                  Every signed-in FSIMS user will see this announcement.
                </p>
              )}
            </section>
          </div>

          <DialogFooter className="gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : editing ? "Save changes" : "Post announcement"}
            </Button>
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
