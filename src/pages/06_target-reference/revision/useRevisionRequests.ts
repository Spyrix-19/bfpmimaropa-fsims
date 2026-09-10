/**
 * Shared revision-request plumbing for every module that can lock a past
 * record behind an approval (Compliance, Notice, Target Reference, Fire Code
 * Fees).
 *
 * Before this hook each New/Edit/View screen re-declared the same state, the
 * same `getLedger` effect and the same pending/approved/locked algebra, which
 * is how the four modules drifted apart. Keep the rules here.
 */
import * as React from "react";
import { revisionrequestAPI } from "@/services/revisionrequestAPI";
import { unwrap } from "@/lib/api-envelope";
import { EMPTY_GUID } from "@/lib/fsims-constants";
import { toast } from "@/lib/toast";
import type { FSISEditRequestModel } from "@/types/revisionrequestType";
import {
  REVISION_STATUS_LABEL,
  revisionRequestType,
  type RevisionModule,
  type RevisionStatus,
} from "./types";

/**
 * The backend answers `isSuccess=false` with "No data found." when a station
 * simply has no revision requests yet — that is an empty list, not an error.
 */
const NO_DATA_MESSAGE = /no\s*data|not\s*found|no\s*record/i;

export interface RevisionLedgerOptions {
  /** Source module — decides the API `requesttype` value. */
  module: RevisionModule;
  stationno: string | null | undefined;
  reportyear: number;
  /** Narrow the ledger to one month; 0 (default) returns the whole year. */
  reportmonth?: number;
  provinceno?: string | null;
  /** Skip the fetch (e.g. a closed dialog). Defaults to true. */
  enabled?: boolean;
  /** Bump to refetch after creating/cancelling/deleting a request. */
  reloadNonce?: number;
}

/** Loads the revision-request ledger for a station/year. */
export function useRevisionLedger({
  module,
  stationno,
  reportyear,
  reportmonth = 0,
  provinceno,
  enabled = true,
  reloadNonce = 0,
}: RevisionLedgerOptions): FSISEditRequestModel[] {
  const [requests, setRequests] = React.useState<FSISEditRequestModel[]>([]);

  React.useEffect(() => {
    if (!enabled || !stationno || stationno === EMPTY_GUID) {
      setRequests([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const resp = await revisionrequestAPI.getLedger(
        {
          stationno,
          reportyear: Number(reportyear),
          reportmonth: Number(reportmonth) || 0,
          provinceno: provinceno || EMPTY_GUID,
          requesttype: revisionRequestType(module),
          pagenumber: 1,
          pagesize: 100,
        },
        { suppressGlobalLoading: true, suppressErrorToast: true },
      );
      if (cancelled) return;
      const { ok, data, error } = unwrap<FSISEditRequestModel[]>(resp);
      if (ok && Array.isArray(data)) {
        setRequests(data);
        return;
      }
      if (error && !NO_DATA_MESSAGE.test(error)) toast.error(error);
      setRequests([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [module, stationno, reportyear, reportmonth, provinceno, enabled, reloadNonce]);

  return requests;
}

/** How a request is tied to the record on screen. */
export interface RevisionMatch {
  /** Reference key of the saved record, when one exists. */
  referencekey?: string | null;
  /** `yyyy-MM-dd` of the row being edited, when the module is date-based. */
  dateKey?: string | null;
  /** Month/year fallback, for the modules whose rows are whole months. */
  report?: { year: number; month: number } | null;
}

function belongsTo(r: FSISEditRequestModel, match: RevisionMatch): boolean {
  if (match.referencekey && String(r.referencekey) === String(match.referencekey)) return true;
  if (r.dateinspected)
    return match.dateKey ? String(r.dateinspected).slice(0, 10) === match.dateKey : false;
  return match.report
    ? Number(r.reportmonth) === match.report.month && Number(r.reportyear) === match.report.year
    : false;
}

/** Finds the request with `status` that belongs to a record, date or month. */
export function findRequest(
  requests: FSISEditRequestModel[],
  status: "PENDING" | "APPROVED",
  match: RevisionMatch,
): FSISEditRequestModel | null {
  return (
    requests.find((r) => r.statuscode?.toUpperCase() === status && belongsTo(r, match)) ?? null
  );
}

/** Finds the request that belongs to a record, whatever its status. */
export function matchRequest(
  requests: FSISEditRequestModel[],
  match: RevisionMatch,
): FSISEditRequestModel | null {
  return requests.find((r) => belongsTo(r, match)) ?? null;
}

const REVISION_STATUSES: string[] = Object.keys(REVISION_STATUS_LABEL);

/** Reads a request's status as a known `RevisionStatus`, or null. */
export function revisionStatusOf(
  request: { statuscode?: string | null } | null | undefined,
): RevisionStatus | null {
  const raw = request?.statuscode?.toUpperCase() ?? "";
  return REVISION_STATUSES.includes(raw) ? (raw as RevisionStatus) : null;
}

export interface RevisionLockInput extends RevisionMatch {
  requests: FSISEditRequestModel[];
  /** True once the record's own date/month has passed and locking is enabled. */
  isPast: boolean;
  /** Record-level flags, for the modules whose API returns them. */
  editablestatus?: number | null;
  isrevisionrequest?: boolean;
  /** Permission gate — a user who cannot manage never gets editable fields. */
  readOnly?: boolean;
}

export interface RevisionLock {
  activeRequest: FSISEditRequestModel | null;
  /** An approval temporarily reopened this record. */
  unlockedByApproval: boolean;
  /** A request is awaiting review — the record stays locked meanwhile. */
  hasPendingRevision: boolean;
  /** The user may ask for a revision to reopen this record. */
  needsRevisionRequest: boolean;
  /** Inputs must be disabled. */
  fieldsLocked: boolean;
}

/** 153 = "approved / temporarily unlocked" on the record itself. */
const EDITABLE_STATUS_APPROVED = 153;

/** The single source of truth for the pending/approved/locked rules. */
export function deriveRevisionLock({
  requests,
  referencekey,
  dateKey,
  report,
  isPast,
  editablestatus,
  isrevisionrequest = false,
  readOnly = false,
}: RevisionLockInput): RevisionLock {
  const match = { referencekey, dateKey, report };
  const unlockedByApproval =
    Number(editablestatus) === EDITABLE_STATUS_APPROVED ||
    !!findRequest(requests, "APPROVED", match);
  const activeRequest = findRequest(requests, "PENDING", match);
  // A pending request locks the record even when its date is not in the past.
  const hasPendingRevision = !unlockedByApproval && (isrevisionrequest || !!activeRequest);
  return {
    activeRequest,
    unlockedByApproval,
    hasPendingRevision,
    needsRevisionRequest: !readOnly && isPast && !unlockedByApproval && !hasPendingRevision,
    fieldsLocked: readOnly || (!unlockedByApproval && (isPast || hasPendingRevision)),
  };
}
