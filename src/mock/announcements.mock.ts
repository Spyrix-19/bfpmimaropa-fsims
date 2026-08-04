import * as React from "react";

/**
 * Centralized announcement mock store.
 *
 * TEMPORARY: the backend has no announcement endpoint yet, so announcements
 * live in this single in-memory store. Every screen reads/writes through
 * `useAnnouncementStore()` so swapping this file for a real API later touches
 * nothing else.
 */
export interface AnnouncementRecord {
  announcementno: string;
  title: string;
  message: string;
  /** memberno of the author — used for "own record only" edit/delete rules. */
  createdbyno: string;
  createdbyname: string;
  stationname: string;
  dateposted: string; // ISO
  dateupdated?: string; // ISO
}

export interface AnnouncementInput {
  title: string;
  message: string;
}

/** Station types allowed to manage announcements (national / regional office). */
export const ANNOUNCEMENT_STATION_TYPES = [25, 26] as const;

/** Role numbers allowed to manage announcements: 1 = SUPER, 2 = ADMIN. */
export const ANNOUNCEMENT_ROLES = [1, 2] as const;

/**
 * Can this user create announcements?
 * Super Administrator or Administrator AND stationtype 25 or 26.
 */
export function canManageAnnouncements(
  roleno: number | null | undefined,
  stationtype: number | null | undefined,
): boolean {
  const role = Number(roleno ?? 0);
  const station = Number(stationtype ?? 0);
  return (
    (ANNOUNCEMENT_ROLES as readonly number[]).includes(role) &&
    (ANNOUNCEMENT_STATION_TYPES as readonly number[]).includes(station)
  );
}

/** Edit/delete is limited to the author's own records. */
export function canModifyAnnouncement(
  record: AnnouncementRecord,
  memberno: string | null | undefined,
  roleno: number | null | undefined,
  stationtype: number | null | undefined,
): boolean {
  if (!canManageAnnouncements(roleno, stationtype)) return false;
  return !!memberno && record.createdbyno === memberno;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const seed: AnnouncementRecord[] = [
  {
    announcementno: "ann-seed-1",
    title: "Q3 inspection targets released",
    message:
      "Provincial targets for the third quarter are now published. Coordinate with your station focal person for the breakdown per sector.",
    createdbyno: "seed-national",
    createdbyname: "FSIMS National Office",
    stationname: "National Headquarters",
    dateposted: "2026-07-24T08:15:00.000Z",
  },
  {
    announcementno: "ann-seed-2",
    title: "System maintenance advisory",
    message:
      "FSIMS will be briefly unavailable on Aug 02, 2026 from 11:00 PM to 12:30 AM for scheduled maintenance.",
    createdbyno: "seed-regional",
    createdbyname: "Regional Office MIMAROPA",
    stationname: "Regional Office MIMAROPA",
    dateposted: "2026-07-27T02:00:00.000Z",
  },
];

let records: AnnouncementRecord[] = [...seed];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function sorted(list: AnnouncementRecord[]) {
  return [...list].sort(
    (a, b) => new Date(b.dateposted).getTime() - new Date(a.dateposted).getTime(),
  );
}

const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return records;
  },
  create(
    input: AnnouncementInput,
    author: { memberno: string; name: string; stationname: string },
  ) {
    const now = new Date().toISOString();
    records = sorted([
      {
        announcementno: `ann-${now}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title.trim(),
        message: input.message.trim(),
        createdbyno: author.memberno,
        createdbyname: author.name,
        stationname: author.stationname,
        dateposted: now,
      },
      ...records,
    ]);
    emit();
  },
  update(announcementno: string, input: AnnouncementInput) {
    records = sorted(
      records.map((r) =>
        r.announcementno === announcementno
          ? {
              ...r,
              title: input.title.trim(),
              message: input.message.trim(),
              dateupdated: new Date().toISOString(),
            }
          : r,
      ),
    );
    emit();
  },
  remove(announcementno: string) {
    records = records.filter((r) => r.announcementno !== announcementno);
    emit();
  },
};

/** React binding for the mock store. */
export function useAnnouncementStore() {
  const items = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    items: React.useMemo(() => sorted(items), [items]),
    create: store.create,
    update: store.update,
    remove: store.remove,
  };
}
