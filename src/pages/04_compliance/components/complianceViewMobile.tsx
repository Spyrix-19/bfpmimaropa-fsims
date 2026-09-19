/* ========================================================================== */
/*  Mobile-only accordion for the compliance VIEW page                         */
/*  (Daily Inspection & Issuance / Daily Reinspection)                         */
/*                                                                             */
/*  Independent copy of the compliance ledger's mobile card design             */
/*  (Compliance.tsx MobileLineList) — intentionally NOT shared so the two      */
/*  screens can evolve separately. Rendered only below the `md` breakpoint;    */
/*  desktop keeps the wide ActivityTable untouched.                            */
/* ========================================================================== */

import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DayLockIcon } from "@/components/day-lock-icon";

/* -------------------------------------------------------------------------- */
/*  Loose structural types — compatible with the view page's ViewDay without   */
/*  importing its private types.                                               */
/* -------------------------------------------------------------------------- */

type AnyBucket = Record<string, unknown>;

export interface MobileViewDay {
  day: number;
  label: string;
  key: string;
  inspection: AnyBucket;
  manual: AnyBucket;
  fsis: AnyBucket;
}

interface ColDef {
  api: string;
  label: string;
  target?: string;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pctText(accomplished: number, target: number): { text: string; className: string } {
  if (target > 0 && accomplished === 0) return { text: "0.00%", className: "" };
  if (target === 0 && accomplished > 0) return { text: "100.00%", className: "text-success" };
  const value = target > 0 ? (accomplished / target) * 100 : 0;
  return { text: `${value.toFixed(2)}%`, className: value >= 100 ? "text-success" : "" };
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks (mirrors of the ledger's mobile primitives)          */
/* -------------------------------------------------------------------------- */

/** Right-aligned value; zeros are muted so real activity stands out. */
function MobileValue({ v }: { v: number }) {
  const value = num(v);
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${value ? "text-foreground" : "text-muted-foreground"}`}
    >
      {value.toLocaleString()}
    </span>
  );
}

/** Two equal mobile value cells used for paired metrics and issuance modes. */
function MobileValuePair({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: leftLabel, value: leftValue },
        { label: rightLabel, value: rightValue },
      ].map((item) => (
        <div
          key={item.label}
          className="flex min-h-8 items-center justify-between gap-2 rounded-lg border border-border bg-background px-2"
        >
          <span className="text-[9px] font-bold uppercase text-muted-foreground">{item.label}</span>
          <MobileValue v={item.value} />
        </div>
      ))}
    </div>
  );
}

function MobileModePair({ manual, fsis }: { manual: number; fsis: number }) {
  return (
    <MobileValuePair
      leftLabel="Manual"
      leftValue={manual}
      rightLabel="FSIS"
      rightValue={fsis}
    />
  );
}

/** Group caption inside an expanded mobile row, e.g. "REINSPECTION". */
function MobileGroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-2 pt-4 text-xs font-bold uppercase text-primary">{children}</div>
  );
}

/** One bordered item card inside an expanded mobile period. */
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

/** Sector card with Target / Accomplished / Variance / Positive / %. */
function MobileSectorCard({
  label,
  target,
  accomplished,
}: {
  label: string;
  target: number;
  accomplished: number;
}) {
  const variance = Math.max(target - accomplished, 0);
  const positive = Math.max(accomplished - target, 0);
  const pct = pctText(accomplished, target);
  return (
    <MobileDetailCard label={label}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {(
          [
            ["Target", target],
            ["Accomplished", accomplished],
            ["Variance", variance],
            ["Positive Listing", positive],
          ] as [string, number][]
        ).map(([metricLabel, value]) => (
          <div key={metricLabel} className="flex items-center justify-between gap-2 py-1">
            <span className="text-[10px] text-muted-foreground">{metricLabel}</span>
            <MobileValue v={value} />
          </div>
        ))}
        <div className="col-span-2 flex items-center justify-between border-t border-border pt-1">
          <span className="text-[10px] text-muted-foreground">Percentage</span>
          <span className={`text-xs font-bold tabular-nums ${pct.className}`}>{pct.text}</span>
        </div>
      </div>
    </MobileDetailCard>
  );
}

/* -------------------------------------------------------------------------- */
/*  Expanded detail bodies                                                     */
/* -------------------------------------------------------------------------- */

function MobileInspectionDetail({
  day,
  inspectionCols,
  groups,
}: {
  day: MobileViewDay;
  inspectionCols: ColDef[];
  groups: { label: string; cols: ColDef[] }[];
}) {
  const plainCols = inspectionCols.filter((c) => !c.target);
  const sectorCols = inspectionCols.filter((c) => c.target);
  return (
    <div>
      {plainCols.length > 0 && (
        <div>
          <MobileGroupTitle>Inspection</MobileGroupTitle>
          <div className="space-y-2">
            {plainCols.length === 2 ? (
              <MobileValuePair
                leftLabel={plainCols[0].label}
                leftValue={num(day.inspection[plainCols[0].api])}
                rightLabel={plainCols[1].label}
                rightValue={num(day.inspection[plainCols[1].api])}
              />
            ) : (
              plainCols.map((c) => (
                <MobileDetailCard
                  key={c.api}
                  label={c.label}
                  total={num(day.inspection[c.api])}
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
              <MobileSectorCard
                key={c.api}
                label={c.label}
                target={num(day.inspection[c.target as string])}
                accomplished={num(day.inspection[c.api])}
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
              const skipPair = c.api === "closedcount" || c.api === "reclosurecount";
              return (
                <MobileDetailCard key={c.api} label={c.label} total={manual + fsis}>
                  {!skipPair && <MobileModePair manual={manual} fsis={fsis} />}
                </MobileDetailCard>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileReinspectionDetail({
  day,
  inspectionCols,
  groups,
}: {
  day: MobileViewDay;
  inspectionCols: ColDef[];
  groups: { label: string; cols: ColDef[] }[];
}) {
  return (
    <div>
      <div>
        <MobileGroupTitle>Reinspection</MobileGroupTitle>
        <div className="space-y-2">
          {inspectionCols.map((c) => (
            <MobileDetailCard key={c.api} label={c.label} total={num(day.inspection[c.api])} />
          ))}
        </div>
      </div>
      {groups.map((g, gi) => (
        <div key={g.label} className={gi === groups.length - 1 ? "pb-2" : ""}>
          <MobileGroupTitle>{g.label}</MobileGroupTitle>
          <div className="space-y-2">
            {g.cols.map((c) => {
              const manual = num(day.manual[c.api]);
              const fsis = num(day.fsis[c.api]);
              const skipPair = c.api === "reclosurecount";
              return (
                <MobileDetailCard key={c.api} label={c.label} total={manual + fsis}>
                  {!skipPair && <MobileModePair manual={manual} fsis={fsis} />}
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
/*  Accordion list — one collapsible row per day                               */
/* -------------------------------------------------------------------------- */

function dayHasRecord(day: MobileViewDay): boolean {
  return [day.inspection, day.manual, day.fsis].some((bucket) =>
    Object.values(bucket).some((v) => typeof v === "number" && num(v) !== 0),
  );
}

export function MobileActivityList({
  days,
  variant,
  inspectionCols,
  groups,
  rowTotal,
}: {
  days: MobileViewDay[];
  variant: "inspection" | "reinspection";
  inspectionCols: ColDef[];
  groups: { label: string; cols: ColDef[] }[];
  rowTotal: (day: MobileViewDay) => number;
}) {
  const [openKey, setOpenKey] = React.useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card px-3 shadow-soft">
      {days.map((day) => {
        const hasRecord = dayHasRecord(day);
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
                {!hasRecord && (
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
                {variant === "inspection" ? (
                  <MobileInspectionDetail
                    day={day}
                    inspectionCols={inspectionCols}
                    groups={groups}
                  />
                ) : (
                  <MobileReinspectionDetail
                    day={day}
                    inspectionCols={inspectionCols}
                    groups={groups}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default MobileActivityList;
