/* ========================================================================== */
/*  Mobile-only accordion for the compliance EDIT page                         */
/*  (Daily Inspection & Issuance / Daily Reinspection)                         */
/*                                                                             */
/*  Mirrors complianceViewMobile.tsx — the same card design the view page uses */
/*  — but every value cell is a NumericInput so a day can be encoded on a      */
/*  phone. Rendered only below the `md` breakpoint; desktop keeps the wide     */
/*  ActivityTable untouched.                                                   */
/*                                                                             */
/*  The change/save handlers are the page's existing ones, passed straight     */
/*  through, so the encoding rules, locks and save process are unchanged.      */
/* ========================================================================== */

import * as React from "react";
import { ChevronDown, ChevronUp, FilePen, Ban, Trash2 } from "lucide-react";
import { NumericInput } from "@/components/numeric-input";
import { DayLockIcon } from "@/components/day-lock-icon";
import EditButton from "@/components/edit-button";
import DeleteButton from "@/components/delete-button";
import { toast } from "@/lib/toast";

import type {
  DayWithRevision,
  EditableDay,
  InspectionCol,
  IssuanceCol,
  InspectionField,
  IssuanceField,
  TargetField,
} from "./complianceEdit";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Centered numeric field used inside the mobile cards (taller than the desktop cell). */
const MOBILE_INPUT_CLASS =
  "h-9 w-20 rounded-md border-border/70 bg-white/90 px-2 py-1 text-center text-sm font-semibold tabular-nums no-spinner";

/* -------------------------------------------------------------------------- */
/*  Small building blocks (mirrors of the view page's mobile primitives)       */
/* -------------------------------------------------------------------------- */

/** Labelled value row: label on the left, editable field (or locked value) on the right. */
function MobileFieldRow({
  label,
  value,
  locked,
  onChange,
}: {
  label: string;
  value: number;
  locked: boolean;
  onChange: (raw: string) => void;
}) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border bg-background px-2">
      <span className="min-w-0 truncate text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </span>
      {locked ? (
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {value.toLocaleString()}
        </span>
      ) : (
        <NumericInput value={value} onValueChange={onChange} className={MOBILE_INPUT_CLASS} />
      )}
    </div>
  );
}

/** Two equal editable cells side by side (paired metrics and issuance modes). */
function MobileFieldPair({
  items,
}: {
  items: {
    key: string;
    label: string;
    value: number;
    locked: boolean;
    onChange: (raw: string) => void;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex min-h-9 flex-col justify-center gap-1 rounded-lg border border-border bg-background px-2 py-1.5"
        >
          <span className="text-[9px] font-bold uppercase text-muted-foreground">
            {item.label}
          </span>
          {item.locked ? (
            <span className="text-right text-xs font-semibold tabular-nums text-muted-foreground">
              {item.value.toLocaleString()}
            </span>
          ) : (
            <NumericInput
              value={item.value}
              onValueChange={item.onChange}
              className="h-9 w-full rounded-md border-border/70 bg-white/90 px-2 py-1 text-center text-sm font-semibold tabular-nums no-spinner"
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** MANUAL / FSIS editable pair for one issuance metric. */
function MobileModePair({
  manual,
  fsis,
  locked,
  onManual,
  onFsis,
}: {
  manual: number;
  fsis: number;
  locked: boolean;
  onManual: (raw: string) => void;
  onFsis: (raw: string) => void;
}) {
  return (
    <MobileFieldPair
      items={[
        { key: "manual", label: "Manual", value: manual, locked, onChange: onManual },
        { key: "fsis", label: "FSIS", value: fsis, locked, onChange: onFsis },
      ]}
    />
  );
}

/** Group caption inside an expanded mobile row, e.g. "RE-FSIC". */
function MobileGroupTitle({ children }: { children: React.ReactNode }) {
  return <div className="pb-2 pt-4 text-xs font-bold uppercase text-primary">{children}</div>;
}

/** One bordered item card inside an expanded period. */
function MobileDetailCard({
  label,
  total,
  children,
}: {
  label: string;
  total?: number | string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
        {total !== undefined && (
          <span className="text-xs font-bold tabular-nums text-primary">{total}</span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * Sector card — Target is read-only (supplied by the Detail API), Accomplished is
 * encoded, and Variance / Positive Listing / % are derived the same way the
 * desktop table derives them.
 */
function MobileSectorEditCard({
  label,
  target,
  accomplished,
  locked,
  onChange,
  showBreakdown,
}: {
  label: string;
  target: number;
  accomplished: number;
  locked: boolean;
  onChange: (raw: string) => void;
  showBreakdown: boolean;
}) {
  const variance = Math.max(target - accomplished, 0);
  const positive = Math.max(accomplished - target, 0);
  const pctValue = target > 0 ? (accomplished / target) * 100 : accomplished > 0 ? 100 : 0;
  const pctClass = pctValue >= 100 ? "text-success" : "";

  return (
    <MobileDetailCard label={label}>
      <MobileFieldRow label="Accomplished" value={accomplished} locked={locked} onChange={onChange} />
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {(
          [
            ["Target", target],
            ["Variance", variance],
            ["Positive Listing", positive],
          ] as [string, number][]
        ).map(([metricLabel, value]) => (
          <div key={metricLabel} className="flex items-center justify-between gap-2 py-1">
            <span className="text-[10px] text-muted-foreground">{metricLabel}</span>
            <span
              className={`text-xs font-semibold tabular-nums ${
                value ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {value.toLocaleString()}
            </span>
          </div>
        ))}
        {showBreakdown && (
          <div className="col-span-2 flex items-center justify-between border-t border-border pt-1">
            <span className="text-[10px] text-muted-foreground">Percentage</span>
            <span className={`text-xs font-bold tabular-nums ${pctClass}`}>
              {`${pctValue.toFixed(2)}%`}
            </span>
          </div>
        )}
      </div>
    </MobileDetailCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Expanded detail body — editable mirror of ActivityTable's columns          */
/* -------------------------------------------------------------------------- */

function MobileEditDetail({
  day,
  inspectionLabel,
  inspectionCols,
  groups,
  onInspectionChange,
  onIssuanceChange,
  targetBreakdown,
}: {
  day: DayWithRevision;
  inspectionLabel: string;
  inspectionCols: InspectionCol[];
  groups: { label: string; cols: IssuanceCol[] }[];
  onInspectionChange: (dayKey: string, field: InspectionField, raw: string) => void;
  onIssuanceChange: (
    dayKey: string,
    mode: "manual" | "fsis",
    field: IssuanceField,
    raw: string,
  ) => void;
  targetBreakdown: boolean;
}) {
  const plainCols = inspectionCols.filter((c) => !c.target);
  const sectorCols = inspectionCols.filter(
    (c): c is InspectionCol & { target: TargetField } => Boolean(c.target),
  );
  const locked = day.isLocked;

  return (
    <div>
      {plainCols.length > 0 && (
        <div>
          <MobileGroupTitle>{inspectionLabel}</MobileGroupTitle>
          <div className="space-y-2">
            {plainCols.length === 2 ? (
              <MobileFieldPair
                items={plainCols.map((c) => ({
                  key: c.api,
                  label: c.label,
                  value: num(day.inspection[c.api]),
                  locked,
                  onChange: (raw: string) => onInspectionChange(day.key, c.api, raw),
                }))}
              />
            ) : (
              plainCols.map((c) => (
                <MobileFieldRow
                  key={c.api}
                  label={c.label}
                  value={num(day.inspection[c.api])}
                  locked={locked}
                  onChange={(raw) => onInspectionChange(day.key, c.api, raw)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {sectorCols.length > 0 && (
        <div>
          <MobileGroupTitle>Government Sector</MobileGroupTitle>
          <div className="space-y-2">
            {sectorCols.map((c) => (
              <MobileSectorEditCard
                key={c.api}
                label={c.label}
                target={num(day.inspection[c.target])}
                accomplished={num(day.inspection[c.api])}
                locked={locked}
                onChange={(raw) => onInspectionChange(day.key, c.api, raw)}
                showBreakdown={targetBreakdown}
              />
            ))}
          </div>
        </div>
      )}

      {groups.map((g, gi) => (
        <div key={g.label} className={gi === groups.length - 1 ? "pb-2" : ""}>
          <MobileGroupTitle>{g.label}</MobileGroupTitle>
          <div className="space-y-2">
            {g.cols.map((c) => {
              const manual = num(day.manual[c.api]);
              const fsis = num(day.fsis[c.api]);
              return (
                <MobileDetailCard key={c.api} label={c.label} total={manual + fsis}>
                  <MobileModePair
                    manual={manual}
                    fsis={fsis}
                    locked={locked}
                    onManual={(raw) => onIssuanceChange(day.key, "manual", c.api, raw)}
                    onFsis={(raw) => onIssuanceChange(day.key, "fsis", c.api, raw)}
                  />
                </MobileDetailCard>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Revision actions — the same three actions the desktop Action column offers */
/* -------------------------------------------------------------------------- */

function MobileRevisionActions({
  day,
  stationno,
  onRequestRevision,
  onCancelRevision,
  onDeleteRevision,
}: {
  day: DayWithRevision;
  stationno: string;
  onRequestRevision: (day: EditableDay) => void;
  onCancelRevision: (requestno: string) => void;
  onDeleteRevision: (requestno: string) => void;
}) {
  const rev = day.rev;

  if (rev.pending) {
    return (
      <div className="flex items-center gap-2 pt-3">
        <EditButton
          variant="square"
          tooltip="Cancel Revision Request"
          ariaLabel="Cancel Revision Request"
          icon={<Ban className="h-4 w-4" />}
          onClick={() => {
            if (rev.req) onCancelRevision(rev.req.requestno);
            else toast.info("No active revision request to cancel.");
          }}
        />
        <DeleteButton
          variant="square"
          tooltip="Delete Revision Request"
          ariaLabel="Delete Revision Request"
          icon={<Trash2 className="h-4 w-4" />}
          onClick={() => {
            if (rev.req) onDeleteRevision(rev.req.requestno);
            else toast.info("No revision request to delete.");
          }}
        />
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Revision request pending
        </span>
      </div>
    );
  }

  if (rev.needsRequest) {
    return (
      <div className="flex items-center gap-2 pt-3">
        <EditButton
          variant="square"
          tooltip={
            !stationno ? "Select a station to request a revision" : "Request Revision"
          }
          ariaLabel={
            !stationno ? "Select a station to request a revision" : "Request Revision"
          }
          disabled={!stationno}
          icon={<FilePen className="h-4 w-4" />}
          onClick={() => onRequestRevision(day)}
        />
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Request revision for this day
        </span>
      </div>
    );
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Accordion list — one collapsible row per day                               */
/* -------------------------------------------------------------------------- */

/** True when the day already carries an encoded value in any displayed column. */
function dayHasRecord(
  day: DayWithRevision,
  inspectionCols: InspectionCol[],
  groups: { label: string; cols: IssuanceCol[] }[],
): boolean {
  if (inspectionCols.some((c) => num(day.inspection[c.api]) !== 0)) return true;
  return groups.some((g) =>
    g.cols.some((c) => num(day.manual[c.api]) !== 0 || num(day.fsis[c.api]) !== 0),
  );
}

export function MobileEditableActivityList({
  days,
  stationno,
  inspectionLabel,
  inspectionCols,
  groups,
  rowTotal,
  onInspectionChange,
  onIssuanceChange,
  onRequestRevision,
  onCancelRevision,
  onDeleteRevision,
  targetBreakdown = false,
}: {
  days: DayWithRevision[];
  stationno: string;
  inspectionLabel: string;
  inspectionCols: InspectionCol[];
  groups: { label: string; cols: IssuanceCol[] }[];
  rowTotal: (day: EditableDay) => number;
  onInspectionChange: (dayKey: string, field: InspectionField, raw: string) => void;
  onIssuanceChange: (
    dayKey: string,
    mode: "manual" | "fsis",
    field: IssuanceField,
    raw: string,
  ) => void;
  onRequestRevision: (day: EditableDay) => void;
  onCancelRevision: (requestno: string) => void;
  onDeleteRevision: (requestno: string) => void;
  targetBreakdown?: boolean;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const grandTotal = days.reduce((sum, d) => sum + rowTotal(d), 0);

  return (
    <div className="rounded-lg border border-border bg-card px-3 shadow-soft">
      {days.map((day) => {
        const hasRecord = dayHasRecord(day, inspectionCols, groups);
        const lineTotal = rowTotal(day);
        const open = openKey === day.key;
        const ToggleIcon = open ? ChevronUp : ChevronDown;

        return (
          <div key={day.key} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : day.key)}
              aria-expanded={open}
              className="flex min-h-14 w-full items-center justify-between gap-2 px-2 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <span className="flex min-w-0 items-center gap-3 text-sm font-semibold text-foreground">
                <DayLockIcon date={day.key} module="monitoring" className="h-4 w-4 shrink-0" />
                <span className="truncate">{day.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {day.isLocked && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Locked
                  </span>
                )}
                {!hasRecord && !day.isLocked && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    No Record
                  </span>
                )}
                <span className="min-w-8 text-right text-sm font-bold tabular-nums text-primary">
                  {lineTotal.toLocaleString()}
                </span>
                <ToggleIcon className="h-4 w-4 text-foreground/70" />
              </span>
            </button>
            {open && (
              <div className="border-t border-border/40 px-2 pb-2">
                <MobileRevisionActions
                  day={day}
                  stationno={stationno}
                  onRequestRevision={onRequestRevision}
                  onCancelRevision={onCancelRevision}
                  onDeleteRevision={onDeleteRevision}
                />
                <MobileEditDetail
                  day={day}
                  inspectionLabel={inspectionLabel}
                  inspectionCols={inspectionCols}
                  groups={groups}
                  onInspectionChange={onInspectionChange}
                  onIssuanceChange={onIssuanceChange}
                  targetBreakdown={targetBreakdown}
                />
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 border-t-2 border-grid-strong px-2 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <span className="text-sm font-bold tabular-nums text-primary">
          {grandTotal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default MobileEditableActivityList;
