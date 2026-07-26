/**
 * Shared types for the target-reference revision workflow.
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

export type RevisionModule = "target-reference" | "monitoring";
