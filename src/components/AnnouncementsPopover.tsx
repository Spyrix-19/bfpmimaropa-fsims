import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Users,
  Globe2,
  Map as MapIcon,
  Building2,
  UserRound,
  Loader2,
  X,
  CheckCheck,
  Circle,
  ChevronDown,
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
import type {
  AnnouncementLedgerModel,
  AnnouncementViewerRequestClass,
} from "@/types/announcementType";
import { MIMAROPA_REGION_CODE } from "@/lib/fsims-constants";
import LocationMultiSelect, { type SelectedLocation } from "@/components/location-multi-select";
import StationMultiSelect, { type SelectedStation } from "@/components/station-multi-select";
import PersonnelMultiSelect, { type SelectedPersonnel } from "@/components/personnel-multi-select";
import {
  useAnnouncementUnreadCount,
  refreshAnnouncementUnreadCount,
} from "@/hooks/useAnnouncementUnreadCount";

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

type AnnouncementRow = Partial<AnnouncementLedgerModel> & {
  announcementno: string;
  title: string;
  message: string;
  audience: AudienceScope;
  createdbyno: string;
  createdbyname: string;
  stationname: string;
  dateposted: string;
  dateupdated?: string;
  provinces?: SelectedLocation[];
  stations?: SelectedStation[];
  personnel?: SelectedPersonnel[];
};


/**
 * Can this user create announcements?
 * Super Administrator or Administrator AND stationtype 25 or 26.
 */
function canManageAnnouncements(
  roleno: number | null | undefined,
  stationtype: number | null | undefined,
): boolean {
  const role = Number(roleno ?? 0);
  const station = Number(stationtype ?? 0);
  return role > 0 && (role === 1 || role === 2) && (station === 25 || station === 26);
}

/**
 * Edit/delete is limited to the author's own records, and only for users who
 * are allowed to manage announcements in the first place.
 */
function canModifyAnnouncement(
  record: AnnouncementRow,
  memberno: string | null | undefined,
  roleno?: number | null,
  stationtype?: number | null,
): boolean {
  if (!canManageAnnouncements(roleno, stationtype)) return false;
  const me = String(memberno ?? "").trim().toLowerCase();
  if (!me) return false;
  const owner = String(record.createdbyno ?? "").trim().toLowerCase();
  // Some ledger payloads omit / zero-out the author id — managers still get
  // the controls in that case instead of the row silently going read-only.
  if (!owner || owner === EMPTY_GUID.toLowerCase()) return true;
  return me === owner;
}


/**
 * Announcements — its own top-nav popover, separate from notifications.
 *
 * Permissions:
 * - Create: Super Administrator (roleno 1) or Administrator (roleno 2) whose
 *   stationtype is 25 or 26.
 * - Edit / delete: the same roles, but only on announcements they authored.
 */
export function AnnouncementsPopover() {
  const [open, setOpen] = useState(false);
  const { user, systemAccess, isAuthenticated } = useAuth();
  const { count: badgeUnreadCount, refresh: refreshUnread } = useAnnouncementUnreadCount();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementRow | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<AudienceScope>("ALL");
  const [provinces, setProvinces] = useState<SelectedLocation[]>([]);
  const [stations, setStations] = useState<SelectedStation[]>([]);
  const [personnel, setPersonnel] = useState<SelectedPersonnel[]>([]);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [clampedIds, setClampedIds] = useState<Set<string>>(new Set());


  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [ledger, setLedger] = useState<AnnouncementRow[] | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const roleno = systemAccess?.roleno ?? 0;
  const stationtype = user?.stationtype ?? 0;
  const memberno = user?.memberno ?? "";
  const stationno = user?.stationno ?? "";
  const canCreate = useMemo(
    () => canManageAnnouncements(roleno, stationtype),
    [roleno, stationtype],
  );

  /**
   * The ledger is always fetched unfiltered (`readstatus: "ALL"`) so the
   * All | Unread | Read tabs and their counts stay consistent with one another.
   * Read state comes from each row's `isread` flag, so a refetch after any
   * mutation (create / delete / mark read) always reflects the server truth.
   */
  const loadLedger = useCallback(async () => {
    if (!memberno) return;
    setLoadingLedger(true);
    const resp = await announcementAPI.getLedger(
      {
        readstatus: "ALL",
        systemno: FSIMS_SYSTEMNO,
        stationno,
        memberno,
        pagenumber: 1,
        pagesize: 50,
      },
      { suppressErrorToast: true, noDedupe: true, retries: 0 },
    );
    const { ok, data } = unwrap<AnnouncementLedgerModel[]>(resp);
    setLoadingLedger(false);
    if (!ok || !Array.isArray(data)) {
      setLedger(null);
      return;
    }
    setLedger(
      data.map((row) => ({
        announcementno: row.announcementno,
        title: row.title,
        message: row.content || row.summary || "",
        audience: "ALL" as AudienceScope,
        createdbyno: row.encodedby || row.memberno || "",
        createdbyname: row.encodedbyname || row.fullname || "",
        stationname: row.stationname || "",
        dateposted: row.dateencoded,
        dateupdated: row.dateupdated || undefined,
      })),
    );

    // Rebuild read state from the server payload instead of merging into the
    // previous set — stale entries were what kept the tabs out of sync.
    setReadIds(
      new Set(data.filter((row) => !!row.isread).map((row) => row.announcementno)),
    );
  }, [memberno, stationno]);

  useEffect(() => {
    if (!open) return;
    void loadLedger();
  }, [open, loadLedger]);

  const source = ledger ?? [];

  const unreadCount = useMemo(
    () => source.filter((a) => !readIds.has(a.announcementno)).length,
    [source, readIds],
  );
  const readCount = useMemo(
    () => source.filter((a) => readIds.has(a.announcementno)).length,
    [source, readIds],
  );
  const visible = useMemo(() => {
    if (filter === "unread") return source.filter((a) => !readIds.has(a.announcementno));
    if (filter === "read") return source.filter((a) => readIds.has(a.announcementno));
    return source;
  }, [source, filter, readIds]);

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
    resetAudience();
    setFormOpen(true);
  };


  const openEdit = (record: AnnouncementRow) => {
    setEditing(record);
    setTitle(record.title);
    setMessage(record.message);
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

    toast.success(editing ? "Announcement updated." : "Announcement posted.", {
      id: "announcement-form",
    });
    setFormOpen(false);
    setEditing(null);
    // Refresh badge + ledger from the server so the new record shows up
    // immediately in All / Unread and in the counts.
    await Promise.all([refreshUnread(), loadLedger()]);
  };



  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    const resp = await announcementAPI.delete({
      announcementno: deleting.announcementno,
      deletedby: memberno,
      roleno,
    });
    const { ok, error } = unwrap(resp);
    setBusy(false);
    if (!ok) {
      toast.error(error || "Unable to delete the announcement.", { id: "announcement-form" });
      return;
    }
    toast.success("Announcement deleted.", { id: "announcement-form" });
    setDeleting(null);
    refreshAnnouncementUnreadCount();

    await refreshUnread();
    await loadLedger();
  };

  const markAllRead = async () => {
    if (!memberno || badgeUnreadCount === 0) return;
    setBusy(true);
    const resp = await announcementAPI.ReadAll({ memberno });
    const { ok, error } = unwrap(resp);
    if (ok) {
      setReadIds((prev) => {
        const next = new Set(prev);
        source.forEach((a) => next.add(a.announcementno));
        return next;
      });
      await refreshUnread();
      await loadLedger();
    } else {
      toast.error(error || "Unable to mark announcements as read.", { id: "announcement-read" });
    }
    setBusy(false);
  };

  /**
   * A record is only flagged read when THIS button is pressed — opening the
   * popover or reading the item never marks it.
   */
  const markOneRead = async (announcementno: string) => {
    if (!memberno || readIds.has(announcementno) || markingId) return;
    setMarkingId(announcementno);
    const resp = await announcementAPI.Read({ announcementno, memberno });
    const { ok, error } = unwrap(resp);
    setMarkingId(null);
    if (!ok) {
      toast.error(error || "Unable to mark the announcement as read.", { id: "announcement-read" });
      return;
    }
    setReadIds((prev) => new Set([...prev, announcementno]));
    await refreshUnread();
    await loadLedger();
  };


  return (
    <>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) void refreshUnread();
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Announcements" className="relative">
            <Megaphone className="h-4 w-4" />
            {badgeUnreadCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-background"
                aria-label={`${badgeUnreadCount} unread announcements`}
              >
                {badgeUnreadCount > 99 ? "99+" : badgeUnreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={8} className="w-[23rem] p-0">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Announcements</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => void markAllRead()}
                disabled={badgeUnreadCount === 0 || busy}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
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
                {f === "all" && source.length > 0 && ` (${source.length})`}
                {f === "unread" && unreadCount > 0 && ` (${unreadCount})`}
                {f === "read" && readCount > 0 && ` (${readCount})`}
              </button>
            ))}
          </div>

          <ScrollArea className="h-[22rem]">
            {visible.length === 0 ? (
              <div className="flex h-[22rem] flex-col items-center justify-center gap-2 px-6 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                  <Megaphone className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">
                  No {filter === "all" ? "" : `${filter} `}announcements
                </p>
                <p className="text-xs text-muted-foreground">
                  {canCreate
                    ? filter === "all"
                      ? "Post the first announcement for your personnel."
                      : `No ${filter} announcements to show.`
                    : "Posted updates will appear here."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {visible.map((a) => {
                  const mine = canModifyAnnouncement(a, memberno, roleno, stationtype);
                  const isRead = readIds.has(a.announcementno);
                  const isExpanded = expandedIds.has(a.announcementno);
                  const messageRef = (node: HTMLParagraphElement | null) => {
                    if (!node) return;
                    const isClamped = node.scrollHeight > node.clientHeight + 1;
                    setClampedIds((prev) => {
                      if (isClamped && !prev.has(a.announcementno)) {
                        return new Set([...prev, a.announcementno]);
                      }
                      return prev;
                    });
                  };
                  return (
                    <li key={a.announcementno} className="group relative">
                      <div
                        className={cn(
                          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                          mine ? "pr-[5.5rem]" : "pr-4",
                          !isRead && "bg-primary/5",
                          "hover:bg-muted/60",
                        )}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                          <Megaphone className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <p
                              className={cn(
                                "min-w-0 flex-1 break-words text-sm",
                                !isRead ? "font-semibold" : "font-medium text-foreground/90",
                              )}
                            >
                              {a.title}
                            </p>
                            {!isRead && (
                              <Circle className="mt-1.5 h-2 w-2 shrink-0 fill-primary text-primary" />
                            )}
                          </div>
                          <p
                            ref={messageRef}
                            className={cn(
                              "mt-1 text-xs leading-snug text-muted-foreground [overflow-wrap:anywhere]",
                              !isExpanded && "line-clamp-3",
                            )}
                          >
                            {a.message}
                          </p>
                          {clampedIds.has(a.announcementno) && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(a.announcementno)) next.delete(a.announcementno);
                                  else next.add(a.announcementno);
                                  return next;
                                })
                              }
                              className="mt-0.5 inline-flex items-center gap-0.5 rounded-md text-[11px] font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              {isExpanded ? "Show less" : "Show more"}
                              <ChevronDown
                                className={cn(
                                  "h-3 w-3 transition-transform",
                                  isExpanded && "rotate-180",
                                )}
                              />
                            </button>
                          )}
                          <p className="mt-1 break-words text-[11px] tracking-tight text-muted-foreground/70">
                            {a.createdbyname}
                            {a.stationname ? ` · ${a.stationname}` : ""} ·{" "}
                            {formatDateTime(a.dateposted, "—")}
                          </p>


                          {!isRead && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy || markingId === a.announcementno}
                              onClick={() => void markOneRead(a.announcementno)}
                              className="mt-1.5 h-6 gap-1.5 rounded-md border-border bg-background px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              {markingId === a.announcementno ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCheck className="h-3.5 w-3.5" />
                              )}
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                      {mine && (
                        <div className="absolute right-2 top-2 flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Edit announcement"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(a);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete announcement"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleting(a);
                            }}
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
                    Set the message and who receives it.
                  </DialogDescription>

                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <section className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="announcement-title"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
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
                  <Label
                    htmlFor="announcement-message"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
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
