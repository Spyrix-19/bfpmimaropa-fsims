/**
 * Types for the Target Reference Revision Request workflow.
 * Isolated to the Target Reference module. Backend-authority is simulated
 * via a centralized mock store (see mockStore.ts) — the shape mirrors what
 * a real backend API would return.
 */

export type RevisionStatus =
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED";

export const REVISION_STATUS_LABEL: Record<RevisionStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  DENIED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

export type AuditAction =
  | "SUBMITTED"
  | "APPROVED"
  | "DENIED"
  | "CANCELLED_BY_USER"
  | "CANCELLED_BY_ADMIN"
  | "COMPLETED"
  | "EXPIRED"
  | "AUTO_RELOCKED";

export interface AuditEntry {
  id: string;
  requestId: string;
  action: AuditAction;
  actorUserId: string;
  actorName: string;
  oldStatus: RevisionStatus | null;
  newStatus: RevisionStatus;
  reason: string;
  remarks: string;
  createdAt: string; // ISO
}

export type RevisionModule = "target-reference" | "monitoring";

export interface RevisionRequest {
  id: string;
  /** Source module the request was raised from. Defaults to "target-reference" for legacy records. */
  module: RevisionModule;
  // scope
  stationno: string;
  stationcode: string;
  stationname: string;
  provinceno: string;
  provincename: string;
  cityname: string;
  reportyear: number;
  reportmonth: number; // 1..12
  // lifecycle
  status: RevisionStatus;
  // requester
  requestedByUserId: string;
  requestedByName: string;
  requestedAt: string; // ISO
  reason: string;
  remarks: string;
  // review
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  decisionReason?: string;
  decisionRemarks?: string;
  // completion / cancellation
  completedAt?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancelledByName?: string;
  cancellationReason?: string;
  cancellationRemarks?: string;
  // approval window
  unlockExpiresAt?: string;
}

export interface TargetReferenceSettings {
  enableMonthlyLock: boolean;
  allowRevisionRequests: boolean;
  requireAdministratorApproval: boolean;
  requireReason: boolean;
  autoRelockAfterSave: boolean;
  /** 1..28 — day of the following month on which the previous month locks. */
  lockDayOfFollowingMonth: number;
  /** HH:mm — server-clock cutoff on the lock day. */
  lockTime: string;
}

export const DEFAULT_SETTINGS: TargetReferenceSettings = {
  enableMonthlyLock: true,
  allowRevisionRequests: true,
  requireAdministratorApproval: true,
  requireReason: true,
  autoRelockAfterSave: true,
  lockDayOfFollowingMonth: 3,
  lockTime: "23:59",
};

/** Composite key used to look up a request for a given cell. */
export const cellKey = (stationno: string, year: number, month: number) =>
  `${stationno}::${year}::${month}`;