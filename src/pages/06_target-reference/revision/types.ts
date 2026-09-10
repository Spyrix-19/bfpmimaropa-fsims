/**
 * Shared types for the target-reference revision workflow.
 */

export type RevisionStatus =
  "PENDING" | "APPROVED" | "DENIED" | "CANCELLED" | "COMPLETED" | "EXPIRED";

export const REVISION_STATUS_LABEL: Record<RevisionStatus, string> = {
  PENDING: "Pending Review",
  APPROVED: "Approved",
  DENIED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

export type RevisionModule = "target-reference" | "monitoring" | "notice" | "fire-code-fees";

/** API RequestType value for each source module. */
export const REVISION_REQUEST_TYPE: Record<RevisionModule, string> = {
  "target-reference": "TARGET",
  monitoring: "COMPLIANCE",
  notice: "NOTICE",
  "fire-code-fees": "FIRE CODE FEES",
};

export function revisionRequestType(module?: RevisionModule): string {
  return REVISION_REQUEST_TYPE[module ?? "target-reference"] ?? "TARGET";
}
