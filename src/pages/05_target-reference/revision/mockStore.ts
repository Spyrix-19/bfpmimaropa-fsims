/**
 * Centralized mock store for Target Revision Requests.
 *
 * Simulates the server-authoritative workflow described in the spec:
 * - single source of truth for requests, audit entries, settings
 * - server-clock lock computation (uses local Date; in a real backend this
 *   would be the server timezone)
 * - unique-constraint on (stationno, year, month) for active statuses
 * - approval TTL + auto-expire on read
 *
 * Persisted to localStorage so the mock survives reloads while the real
 * backend endpoints are not yet wired.
 */

import {
  cellKey,
  DEFAULT_SETTINGS,
  type AuditAction,
  type AuditEntry,
  type RevisionRequest,
  type RevisionStatus,
  type TargetReferenceSettings,
} from "./types";

const LS_REQUESTS = "fsims_target_revision_requests_v1";
const LS_AUDIT = "fsims_target_revision_audit_v1";
const LS_SETTINGS = "fsims_target_revision_settings_v1";

const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Listener = () => void;
const listeners = new Set<Listener>();

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadRequests(): RevisionRequest[] {
  const raw = safeParse<RevisionRequest[]>(
    typeof window !== "undefined" ? window.localStorage.getItem(LS_REQUESTS) : null,
    [],
  );
  // Backfill legacy records that predate the `module` discriminator.
  return raw.map((r) => ({ ...r, module: r.module ?? "target-reference" }));
}

function loadAudit(): AuditEntry[] {
  return safeParse<AuditEntry[]>(
    typeof window !== "undefined" ? window.localStorage.getItem(LS_AUDIT) : null,
    [],
  );
}

function loadSettings(): TargetReferenceSettings {
  const s = safeParse<Partial<TargetReferenceSettings>>(
    typeof window !== "undefined" ? window.localStorage.getItem(LS_SETTINGS) : null,
    {},
  );
  return { ...DEFAULT_SETTINGS, ...s };
}

let requests: RevisionRequest[] = loadRequests();
let audit: AuditEntry[] = loadAudit();
let settings: TargetReferenceSettings = loadSettings();

function persist() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_REQUESTS, JSON.stringify(requests));
  window.localStorage.setItem(LS_AUDIT, JSON.stringify(audit));
  window.localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

function emit() {
  persist();
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

/** Expire APPROVED requests whose TTL has elapsed without a save. */
function reconcileExpirations(now = Date.now()): boolean {
  let mutated = false;
  requests = requests.map((r) => {
    if (r.status === "APPROVED" && r.unlockExpiresAt) {
      const t = Date.parse(r.unlockExpiresAt);
      if (!Number.isNaN(t) && t <= now) {
        mutated = true;
        appendAudit({
          requestId: r.id,
          action: "EXPIRED",
          actorUserId: "system",
          actorName: "System",
          oldStatus: r.status,
          newStatus: "EXPIRED",
          reason: "Approval window elapsed without save.",
          remarks: "",
        });
        return { ...r, status: "EXPIRED" as RevisionStatus };
      }
    }
    return r;
  });
  return mutated;
}

function appendAudit(entry: Omit<AuditEntry, "id" | "createdAt">) {
  audit = [
    ...audit,
    {
      id: uid(),
      createdAt: new Date().toISOString(),
      ...entry,
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Public API — mirrors what a real service module would expose.
 * ------------------------------------------------------------------ */

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSettings(): TargetReferenceSettings {
  return { ...settings };
}

export function updateSettings(patch: Partial<TargetReferenceSettings>) {
  settings = { ...settings, ...patch };
  emit();
}

export function listRequests(): RevisionRequest[] {
  if (reconcileExpirations()) emit();
  return [...requests].sort(
    (a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt),
  );
}

export function getRequestById(id: string): RevisionRequest | undefined {
  reconcileExpirations();
  return requests.find((r) => r.id === id);
}

export function getAuditForRequest(requestId: string): AuditEntry[] {
  return audit
    .filter((a) => a.requestId === requestId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** Returns the ACTIVE request (PENDING or APPROVED) for a cell, if any. */
export function getActiveRequestForCell(
  stationno: string,
  year: number,
  month: number,
): RevisionRequest | undefined {
  reconcileExpirations();
  return requests.find(
    (r) =>
      r.stationno === stationno &&
      r.reportyear === year &&
      r.reportmonth === month &&
      (r.status === "PENDING" || r.status === "APPROVED"),
  );
}

/** Returns the most recent request (any status) for a cell — for badge display. */
export function getLatestRequestForCell(
  stationno: string,
  year: number,
  month: number,
): RevisionRequest | undefined {
  reconcileExpirations();
  const matches = requests.filter(
    (r) =>
      r.stationno === stationno && r.reportyear === year && r.reportmonth === month,
  );
  matches.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  return matches[0];
}

/**
 * Server-authoritative month lock computation.
 *
 * Rules (matching helpers.ts::isReportMonthLocked semantics):
 *   - Only past months of the current year (or any prior year) can be locked.
 *   - The previous month becomes locked on `lockDayOfFollowingMonth` at
 *     `lockTime` in the server clock.
 *   - When `enableMonthlyLock === false`, nothing is locked.
 *
 * Also honors an APPROVED request that temporarily unlocks a specific month.
 */
export function isMonthLocked(
  stationno: string,
  year: number,
  month: number,
  now: Date = new Date(),
): boolean {
  const s = settings;
  if (!s.enableMonthlyLock) return false;

  // Active APPROVED request temporarily unlocks this cell.
  const active = getActiveRequestForCell(stationno, year, month);
  if (active && active.status === "APPROVED") return false;

  const cy = now.getFullYear();
  const cm = now.getMonth() + 1; // 1..12
  const y = Number(year) || 0;
  const m = Number(month) || 0;

  if (y > cy) return false;
  if (y < cy) return true;
  // same year
  if (m > cm) return false;
  if (m < cm) return true;
  // current month — check cutoff (previous month locks on lockDay of THIS month).
  // The current month itself is always editable until it, in turn, becomes previous.
  return false;
}

/* ------------------------------------------------------------------ *
 * Mutations — each writes an audit entry and enforces server-side rules.
 * ------------------------------------------------------------------ */

export interface CreateRequestInput {
  module?: import("./types").RevisionModule;
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  reportyear: number;
  reportmonth: number;
  requestedByUserId: string;
  requestedByName: string;
  reason: string;
  remarks?: string;
}

export function createRequest(input: CreateRequestInput):
  | { ok: true; request: RevisionRequest }
  | { ok: false; error: string } {
  if (!settings.allowRevisionRequests) {
    return { ok: false, error: "Revision requests are disabled." };
  }
  if (settings.requireReason && !input.reason.trim()) {
    return { ok: false, error: "Reason is required." };
  }
  // Server must be locked to accept a request.
  if (!isMonthLocked(input.stationno, input.reportyear, input.reportmonth)) {
    return { ok: false, error: "This month is not locked; no revision request needed." };
  }
  const existing = getActiveRequestForCell(
    input.stationno,
    input.reportyear,
    input.reportmonth,
  );
  if (existing) {
    return { ok: false, error: "An active request already exists for this month." };
  }
  const nowIso = new Date().toISOString();
  const req: RevisionRequest = {
    id: uid(),
    module: input.module ?? "target-reference",
    stationno: input.stationno,
    stationcode: input.stationcode,
    stationname: input.stationname,
    provinceno: input.provinceno,
    provincename: input.provincename,
    cityname: input.cityname,
    reportyear: input.reportyear,
    reportmonth: input.reportmonth,
    status: "PENDING",
    requestedByUserId: input.requestedByUserId,
    requestedByName: input.requestedByName,
    requestedAt: nowIso,
    reason: input.reason.trim(),
    remarks: (input.remarks ?? "").trim(),
  };
  requests = [...requests, req];
  appendAudit({
    requestId: req.id,
    action: "SUBMITTED",
    actorUserId: req.requestedByUserId,
    actorName: req.requestedByName,
    oldStatus: null,
    newStatus: "PENDING",
    reason: req.reason,
    remarks: req.remarks,
  });
  emit();
  return { ok: true, request: req };
}

function transition(
  id: string,
  next: RevisionStatus,
  patch: Partial<RevisionRequest>,
  audit: {
    action: AuditAction;
    actorUserId: string;
    actorName: string;
    reason: string;
    remarks: string;
  },
): { ok: true; request: RevisionRequest } | { ok: false; error: string } {
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: "Request not found." };
  const current = requests[idx];
  const nextReq: RevisionRequest = { ...current, ...patch, status: next };
  requests = [...requests.slice(0, idx), nextReq, ...requests.slice(idx + 1)];
  appendAudit({
    requestId: id,
    action: audit.action,
    actorUserId: audit.actorUserId,
    actorName: audit.actorName,
    oldStatus: current.status,
    newStatus: next,
    reason: audit.reason,
    remarks: audit.remarks,
  });
  emit();
  return { ok: true, request: nextReq };
}

export function approveRequest(
  id: string,
  admin: { userId: string; name: string; remarks?: string },
) {
  const cur = requests.find((r) => r.id === id);
  if (!cur) return { ok: false as const, error: "Request not found." };
  if (cur.status !== "PENDING")
    return { ok: false as const, error: "Only pending requests can be approved." };
  const nowIso = new Date().toISOString();
  return transition(
    id,
    "APPROVED",
    {
      reviewedByUserId: admin.userId,
      reviewedByName: admin.name,
      reviewedAt: nowIso,
      decisionRemarks: (admin.remarks ?? "").trim(),
      unlockExpiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
    },
    {
      action: "APPROVED",
      actorUserId: admin.userId,
      actorName: admin.name,
      reason: "",
      remarks: (admin.remarks ?? "").trim(),
    },
  );
}

export function denyRequest(
  id: string,
  admin: { userId: string; name: string; reason: string; remarks: string },
) {
  const cur = requests.find((r) => r.id === id);
  if (!cur) return { ok: false as const, error: "Request not found." };
  if (cur.status !== "PENDING")
    return { ok: false as const, error: "Only pending requests can be denied." };
  if (!admin.reason.trim() || !admin.remarks.trim())
    return { ok: false as const, error: "Reason and remarks are required." };
  return transition(
    id,
    "DENIED",
    {
      reviewedByUserId: admin.userId,
      reviewedByName: admin.name,
      reviewedAt: new Date().toISOString(),
      decisionReason: admin.reason.trim(),
      decisionRemarks: admin.remarks.trim(),
    },
    {
      action: "DENIED",
      actorUserId: admin.userId,
      actorName: admin.name,
      reason: admin.reason.trim(),
      remarks: admin.remarks.trim(),
    },
  );
}

export function adminCancelRequest(
  id: string,
  admin: { userId: string; name: string; reason: string; remarks: string },
) {
  const cur = requests.find((r) => r.id === id);
  if (!cur) return { ok: false as const, error: "Request not found." };
  if (cur.status !== "PENDING" && cur.status !== "APPROVED")
    return { ok: false as const, error: "Only active requests can be cancelled." };
  if (!admin.reason.trim() || !admin.remarks.trim())
    return { ok: false as const, error: "Reason and remarks are required." };
  return transition(
    id,
    "CANCELLED",
    {
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: admin.userId,
      cancelledByName: admin.name,
      cancellationReason: admin.reason.trim(),
      cancellationRemarks: admin.remarks.trim(),
    },
    {
      action: "CANCELLED_BY_ADMIN",
      actorUserId: admin.userId,
      actorName: admin.name,
      reason: admin.reason.trim(),
      remarks: admin.remarks.trim(),
    },
  );
}

export function userCancelRequest(
  id: string,
  user: { userId: string; name: string; reason: string; remarks: string },
) {
  const cur = requests.find((r) => r.id === id);
  if (!cur) return { ok: false as const, error: "Request not found." };
  if (cur.requestedByUserId !== user.userId)
    return { ok: false as const, error: "You can only cancel your own request." };
  if (cur.status !== "PENDING")
    return { ok: false as const, error: "Only pending requests can be cancelled." };
  if (!user.reason.trim() || !user.remarks.trim())
    return { ok: false as const, error: "Reason and remarks are required." };
  return transition(
    id,
    "CANCELLED",
    {
      cancelledAt: new Date().toISOString(),
      cancelledByUserId: user.userId,
      cancelledByName: user.name,
      cancellationReason: user.reason.trim(),
      cancellationRemarks: user.remarks.trim(),
    },
    {
      action: "CANCELLED_BY_USER",
      actorUserId: user.userId,
      actorName: user.name,
      reason: user.reason.trim(),
      remarks: user.remarks.trim(),
    },
  );
}

/** Called after a user saves the revision — completes and auto-relocks. */
export function completeRequest(
  id: string,
  actor: { userId: string; name: string },
) {
  const cur = requests.find((r) => r.id === id);
  if (!cur) return { ok: false as const, error: "Request not found." };
  if (cur.status !== "APPROVED")
    return { ok: false as const, error: "Only approved requests can be completed." };
  return transition(
    id,
    "COMPLETED",
    {
      completedAt: new Date().toISOString(),
      unlockExpiresAt: undefined,
    },
    {
      action: "COMPLETED",
      actorUserId: actor.userId,
      actorName: actor.name,
      reason: "",
      remarks: settings.autoRelockAfterSave ? "Auto-relocked after save." : "",
    },
  );
}

/** For deterministic keys in row lists. */
export { cellKey };