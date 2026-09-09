import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_PAST_DATE_LOCK_ENABLED } from "@/lib/past-date-lock";

/** Local YYYY-MM-DD key for a calendar day. */
export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** A date is locked once it is before today (local midnight). */
export function isDayLocked(date: string | Date): boolean {
  if (!IS_PAST_DATE_LOCK_ENABLED) return false;
  const d = typeof date === "string" ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

/**
 * Green open lock for still-editable dates, warning closed lock for locked
 * ones. Shared by the Compliance, Notices and Target Reference detail views so
 * the indicator reads the same everywhere.
 */
export function DayLockIcon({
  date,
  className,
  locked: lockedProp,
}: {
  date?: string | Date;
  className?: string;
  locked?: boolean;
}) {
  const locked = lockedProp ?? (date ? isDayLocked(date) : false);
  const Icon = locked ? Lock : LockOpen;
  return (
    <Icon
      aria-label={locked ? "Locked date" : "Editable date"}
      className={cn("h-3.5 w-3.5 shrink-0", locked ? "text-warning" : "text-success", className)}
    />
  );
}

export default DayLockIcon;
