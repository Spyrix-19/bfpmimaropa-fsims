import * as React from "react";
import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDateLocked, type PastDateLockModule } from "@/lib/past-date-lock";
import { deriveRevisionLock } from "@/pages/06_target-reference/revision/useRevisionRequests";

/** Local YYYY-MM-DD key for a calendar day. */
export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Date-only lock (Super Admin → lock-all → exempt → province switch → cutoff). */
export function isDayLocked(date: string | Date, module?: PastDateLockModule): boolean {
  return isDateLocked(date, module);
}

export interface RecordRevisionFlags {
  editablestatus?: number | null;
  isrevisionrequest?: boolean | null;
}

/** yyyy-MM-dd → the saved record's revision flags. */
const RevisionFlagsContext = React.createContext<Map<string, RecordRevisionFlags> | null>(null);

/**
 * Feeds each list row's saved revision flags to the lock icons inside it so
 * main pages follow the same rules as the Add/Edit screens.
 */
export function RevisionFlagsProvider({
  records,
  children,
}: {
  records: Array<{ date?: string | null } & RecordRevisionFlags>;
  children: React.ReactNode;
}) {
  const map = React.useMemo(() => {
    const m = new Map<string, RecordRevisionFlags>();
    for (const r of records) {
      const key = String(r?.date ?? "").slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        m.set(key, { editablestatus: r.editablestatus, isrevisionrequest: r.isrevisionrequest });
      }
    }
    return m;
  }, [records]);
  return <RevisionFlagsContext.Provider value={map}>{children}</RevisionFlagsContext.Provider>;
}

/** Full shared decision: date rules, then editablestatus 153 / 152 overrides. */
export function isRecordLocked(
  date: string | Date,
  module?: PastDateLockModule,
  flags?: RecordRevisionFlags | null,
): boolean {
  return deriveRevisionLock({
    requests: [],
    isPast: isDateLocked(date, module),
    editablestatus: Number(flags?.editablestatus ?? 0) || 0,
    isrevisionrequest: Boolean(flags?.isrevisionrequest),
  }).fieldsLocked;
}

/**
 * Green open lock for still-editable dates, warning closed lock for locked
 * ones. Shared by every module's list and detail views.
 */
export function DayLockIcon({
  date,
  className,
  locked: lockedProp,
  module,
  flags,
}: {
  date?: string | Date;
  className?: string;
  locked?: boolean;
  module?: PastDateLockModule;
  flags?: RecordRevisionFlags | null;
}) {
  const ctx = React.useContext(RevisionFlagsContext);
  const key = typeof date === "string" ? date.slice(0, 10) : "";
  const resolved = flags ?? (key ? ctx?.get(key) : undefined);
  const locked = lockedProp ?? (date ? isRecordLocked(date, module, resolved) : false);
  const Icon = locked ? Lock : LockOpen;
  return (
    <Icon
      aria-label={locked ? "Locked date" : "Editable date"}
      className={cn("h-3.5 w-3.5 shrink-0", locked ? "text-warning" : "text-success", className)}
    />
  );
}

export default DayLockIcon;
