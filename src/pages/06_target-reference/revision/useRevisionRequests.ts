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

/** Normalises an API date ("2026-09-15", "2026-09-15T00:00:00", "9/15/2026") to yyyy-MM-dd. */
function toDateKey(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

function belongsTo(r: FSISEditRequestModel, match: RevisionMatch): boolean {
  if (match.referencekey && String(r.referencekey) === String(match.referencekey)) return true;
  const reqDate = toDateKey(r.dateinspected);
  if (reqDate && match.dateKey && reqDate === toDateKey(match.dateKey)) return true;
  // Month-based modules (Fire Code Fees) pass `report`: match by report month,
  // or by the month of the request's date.
  if (match.report) {
    const { year, month } = match.report;
    if (Number(r.reportmonth) === month && Number(r.reportyear) === year) return true;
    if (reqDate && reqDate.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}`) return true;
  }
  return false;
}

/** 153 = APPROVED, as tagged on the Revision Requests page. */
const STATUS_NO_APPROVED = 153;
/** 152 = PENDING. */
const STATUS_NO_PENDING = 152;

function requestStatus(r: FSISEditRequestModel): string {
  if (Number(r.statusno) === STATUS_NO_APPROVED) return "APPROVED";
  if (Number(r.statusno) === STATUS_NO_PENDING) return "PENDING";
  const code = String(r.statuscode ?? "")
    .trim()
    .toUpperCase();
  const name = String(r.statusname ?? "")
    .trim()
    .toUpperCase();
  if (code.startsWith("APPROV") || name.startsWith("APPROV")) return "APPROVED";
  if (code.startsWith("PEND") || name.startsWith("PEND")) return "PENDING";
  return code;
}

/** True when a ledger request is still awaiting review (statusno 152 / PENDING). */
export function isPendingRequest(r: FSISEditRequestModel | null | undefined): boolean {
  return !!r && requestStatus(r) === "PENDING";
}

/** Finds the request with `status` that belongs to a record, date or month. */
export function findRequest(
  requests: FSISEditRequestModel[],
  status: "PENDING" | "APPROVED",
  match: RevisionMatch,
): FSISEditRequestModel | null {
  return requests.find((r) => requestStatus(r) === status && belongsTo(r, match)) ?? null;
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

/** Record-level `editablestatus` codes returned by the API. */
export const EDITABLE_STATUS = {
  PENDING: 152,
  APPROVED: 153,
  REJECTED: 154,
  CANCELLED: 155,
  DONE: 156,
} as const;

/**
 * The single source of truth for the pending/approved/locked rules.
 * Order:
 *  1. editablestatus 153 (APPROVED) → always editable, regardless of any
 *     date-lock rule (past-date, all-date, exemption) or role.
 *  2. editablestatus 152 (PENDING) → locked; only this state shows the
 *     Cancel / Remove revision request actions.
 *  3. Any other status (154/155/156 or none) → env date-lock rules (`isPast`).
 *  When no saved record/status exists, the matching revision request's own
 *  status (152/153) is used as the effective status.
 */
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
  const recordStatus = Number(editablestatus) || 0;
  const recordHasStatus = (Object.values(EDITABLE_STATUS) as number[]).includes(recordStatus);
  const ledgerPending = findRequest(requests, "PENDING", match);
  const ledgerApproved = findRequest(requests, "APPROVED", match);

  // Effective status: the saved record's editablestatus wins. When there is no
  // saved record yet (or it carries no status), the matching revision request
  // supplies the same 152/153 code, so one rule set covers both cases.
  const status = recordHasStatus
    ? recordStatus
    : ledgerApproved
      ? EDITABLE_STATUS.APPROVED
      : ledgerPending
        ? EDITABLE_STATUS.PENDING
        : 0;
  void isrevisionrequest; // informational only — 152 is the sole pending signal

  if (status === EDITABLE_STATUS.APPROVED) {
    return {
      activeRequest: null,
      unlockedByApproval: true,
      hasPendingRevision: false,
      needsRevisionRequest: false,
      fieldsLocked: false,
    };
  }
  if (status === EDITABLE_STATUS.PENDING) {
    return {
      activeRequest: ledgerPending,
      unlockedByApproval: false,
      hasPendingRevision: true,
      needsRevisionRequest: false,
      fieldsLocked: true,
    };
  }
  // Rejected / cancelled / done / no status: the env date-lock rules decide.
  return {
    activeRequest: null,
    unlockedByApproval: false,
    hasPendingRevision: false,
    needsRevisionRequest: !readOnly && isPast,
    fieldsLocked: readOnly || isPast,
  };
}
