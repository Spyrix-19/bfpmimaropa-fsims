
# Target Reference — Revision Request Workflow

This is a large feature. Before I write code I need one decision from you, plus a shared plan of what will ship.

## Open question — where does the data live?

The project talks to an external API (see `src/services/*API.ts`, `.env`). Nothing in the current codebase exposes endpoints for revision requests, approvals, audit logs, or lock settings. I need to know which of these you want:

1. **Backend team will add the endpoints.** I build the UI + a thin API client against a contract we agree on now (endpoints listed below). Until the backend ships, calls will fail at runtime — expected.
2. **Use Lovable Cloud** (managed Postgres + auth + edge functions) for the revision-request tables, RLS, and server-side approval logic. Fully working end-to-end, isolated to this module. The rest of the app keeps talking to the existing external API untouched.
3. **Frontend-only mock** using localStorage. Ships fast, but "server is final authority", audit log, and RLS-style security in your spec are not real — anyone with devtools can forge state. Not recommended given your Security section.

My recommendation: **Option 2 (Lovable Cloud)** — it is the only option that satisfies your Security + Audit Log requirements without waiting on the external backend.

## Scope (unchanged regardless of option)

Isolated to `src/pages/05_target-reference/` plus:
- one new route `/target-revision-requests`
- one sidebar entry gated by role + station type
- one new API service file
- (option 2 only) migrations under `supabase/migrations/`

Nothing in Monitoring, Dashboard, Reports, Profile, Users, or shared components changes.

## UI changes

### 1. `TargetReferenceForm.tsx` table
Add leading `ACTION` column. Column order becomes:

```text
ACTION | MONTH | BPLO | GOV | PEZA | TIEZA | TOTAL
```

Per-row cell logic (server-computed, client only renders):

- month not saved yet → empty cell
- month saved, not locked → empty cell
- month saved + locked + no active request + user allowed → `Request Revision` button
- active request exists → status badge (`Pending Review`, `Approved`, `Rejected`, `Cancelled`, `Completed`, `Expired`); when `Pending Review` + own request, also show `Cancel Request`

No other columns, spacing, totals, or calc logic change.

### 2. Request Revision dialog
Read-only: Year, Month, Requested By, Date Requested. Required input: `Reason` (textarea). Submit disabled until Reason non-empty and trimmed. Server assigns status = `PENDING`.

Note: your spec says "both Reason and Remarks" in some places and only "Reason" in the field list. I'll implement **Reason required, Remarks optional** for user submission. Deny/Cancel by admin require **both**. Tell me if that's wrong.

### 3. Cancel-own-request dialog
Required: Reason + Remarks. Only visible on user's own `PENDING` request.

### 4. New page — `Target Revision Requests`
Route: `/target-revision-requests`. Sidebar group "Management", label "Target Revision Requests", icon `ShieldCheck`.

Visibility rule (client AND server):

```text
(roleno === 1 || roleno === 2) && (stationtype === 25 || stationtype === 26)
```

Adds new `AppModule` `"target-revisions"` with its own `canAccess` branch — no other module changes.

Page contents:
- Filter bar: Status, Year, Month, Province, Station, Date Requested (range), Requested By (search)
- Table columns: Status, Requested Date, Year, Month, Province, City, Station Code, Station Name, Requested By, Reason, Current Lock Status, Reviewed By, Reviewed Date, Decision Remarks, Actions
- Row actions (admin only): View Details, Approve, Deny, Cancel
- Detail drawer shows full audit history for the request

### 5. Settings panel — Target Reference Settings
New tab inside the existing Target Reference page (admin-only), reads/writes a single `target_reference_settings` row:

- Enable Monthly Lock (bool)
- Allow Revision Requests (bool)
- Require Administrator Approval (bool)
- Require Reason (bool)
- Auto Relock After Save (bool)
- Lock Day of Following Month (int 1–28)
- Lock Time (HH:mm, default 23:59)

Timezone: server timezone only. Client displays but never computes lock cutoffs.

## Approve → Complete flow

1. Admin approves → server sets status `APPROVED`, records `approved_month_unlock` for `(stationno, year, month)` with a TTL (e.g. 24h configurable).
2. `TargetReferenceForm` server-derived `isLocked` returns `false` for that specific month only while an active unlock exists for the current user's station.
3. On successful save of that month, server marks request `COMPLETED` and clears the unlock (auto-relock).
4. If TTL elapses without a save → status `EXPIRED`, relock.

Year is never unlocked; only the single month.

## Status machine

```text
PENDING ─┬─► APPROVED ──► COMPLETED
         ├─► DENIED
         ├─► CANCELLED   (by requester or admin)
         └─► EXPIRED     (auto on TTL)
APPROVED └─► EXPIRED     (auto on TTL without save)
```

Uniqueness constraint: at most one row per `(stationno, year, month)` with status in `('PENDING','APPROVED')`. Enforced by partial unique index — this is what makes "duplicate requests must never be allowed" actually true.

## Audit log

Separate `target_revision_audit` table. Every state transition writes: request_id, actor_userid, actor_name, action, old_status, new_status, reason, remarks, ip (if available), created_at (server time). Visible in the request detail drawer.

## Data model (option 2)

```text
target_revision_requests
  id (uuid pk)
  stationno (uuid), provinceno (uuid)
  reportyear (int), reportmonth (int 1..12)
  status (enum: PENDING, APPROVED, DENIED, CANCELLED, COMPLETED, EXPIRED)
  reason (text), remarks (text nullable)
  requested_by (uuid), requested_by_name (text), requested_at (timestamptz)
  reviewed_by (uuid null), reviewed_by_name (text null), reviewed_at (timestamptz null)
  decision_reason (text null), decision_remarks (text null)
  unlock_expires_at (timestamptz null)
  completed_at (timestamptz null), cancelled_at (timestamptz null)
  UNIQUE partial index on (stationno, reportyear, reportmonth) WHERE status IN ('PENDING','APPROVED')

target_revision_audit
  id, request_id (fk), actor_userid, actor_name, action, old_status, new_status,
  reason, remarks, created_at

target_reference_settings   (single row)
  enable_monthly_lock, allow_revision_requests, require_admin_approval,
  require_reason, auto_relock_after_save,
  lock_day_of_following_month, lock_time, updated_by, updated_at
```

RLS: users can read their own requests + requests for stations they belong to; only SUPER/ADMIN with stationtype 25|26 can read all, approve, deny, cancel-any, or write settings. Audit and settings are insert-only from server-side edge functions.

## API surface (option 1 contract, option 2 implementation)

```text
POST   /FSISTargetRevision/Create               { stationno, year, month, reason }
POST   /FSISTargetRevision/Cancel               { requestId, reason, remarks }         // owner
POST   /FSISTargetRevision/Approve              { requestId, remarks? }                // admin
POST   /FSISTargetRevision/Deny                 { requestId, reason, remarks }         // admin
POST   /FSISTargetRevision/AdminCancel          { requestId, reason, remarks }         // admin
GET    /FSISTargetRevision/Ledger               filters + pagination
GET    /FSISTargetRevision/Detail?id=           full record + audit trail
GET    /FSISTargetRevision/LockStatus           { stationno, year } -> per-month lock + active request summary
GET    /FSISTargetReferenceSettings/Get
POST   /FSISTargetReferenceSettings/Update
```

`TargetReferenceForm` will call `LockStatus` once per (station, year) and drive the ACTION column from its response. No client-side lock math.

## What I will NOT touch

Existing target calculations, totals, monthly/quarterly/annual buckets, year logic, month ordering, forms other than the new ACTION column, reports, dashboard, monitoring, and every business rule unrelated to revision requests. `helpers.ts::isReportMonthLocked` stays but will only be used as a client hint; the ACTION column trusts server `LockStatus`.

## Deliverables

- `src/pages/05_target-reference/components/TargetReferenceForm.tsx` — add ACTION column + button/badge cell
- `src/pages/05_target-reference/components/RevisionRequestDialog.tsx` (new)
- `src/pages/05_target-reference/components/CancelRequestDialog.tsx` (new)
- `src/pages/05_target-reference/components/RevisionStatusBadge.tsx` (new)
- `src/pages/05_target-reference/settings/TargetReferenceSettings.tsx` (new)
- `src/pages/09_target-revisions/TargetRevisionRequests.tsx` (new page + filters + table)
- `src/pages/09_target-revisions/components/*` — detail drawer, approve/deny/cancel dialogs, audit timeline
- `src/services/targetRevisionAPI.ts` (new)
- `src/types/targetRevisionType.ts` (new)
- `src/lib/auth.tsx` — extend `AppModule` with `"target-revisions"` and add `canAccess` branch (role 1|2 + stationtype 25|26)
- `src/components/AppSidebar.tsx` — one new NavItem
- `src/App.tsx` — one new route
- Option 2 only: `supabase/migrations/*.sql` + three edge functions (`revision-approve`, `revision-deny`, `revision-complete`) enforcing role/station checks server-side

## Please confirm before I build

1. **Backend option: 1, 2, or 3?** (I recommend 2.)
2. **Reason vs Remarks on user submission**: Reason required + Remarks optional — OK?
3. **Approval TTL** before auto-expire: 24h default — OK?
4. **Sidebar label**: `Target Revision Requests` — OK?
