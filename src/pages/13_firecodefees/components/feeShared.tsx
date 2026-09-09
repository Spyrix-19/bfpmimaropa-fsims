/**
 * Shared building blocks for the Fire Code Fees screens.
 *
 * The New, Edit and View screens each live in their own file; this module only
 * holds the primitives they have in common (value shapes, amount helpers and
 * the wide fee-category matrix) so the three screens can evolve separately.
 */
import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

import {
  FEE_SECTORS,
  FIRE_CODE_MODES,
  FIRE_CODE_MODE_FSIS,
  FIRE_CODE_MODE_MANUAL,
  groupAmountText,
  peso,
  type FeeAmounts,
  type FireCodeSectorKey,
} from "../feeColumns";
import { groupCategories, type FeeCategory } from "./feeCategories";

/* -------------------------------------------------------------------------- */
/*  Types & value helpers                                                      */
/* -------------------------------------------------------------------------- */

export const MODES = FIRE_CODE_MODES;

export type ModeCode = typeof FIRE_CODE_MODE_MANUAL | typeof FIRE_CODE_MODE_FSIS;
export type Amounts = FeeAmounts;
export type SectorValues = Record<FireCodeSectorKey, Record<ModeCode, Amounts>>;

/** Station context handed to the Edit and View screens. */
export interface FeeEditorStation {
  stationno: string;
  stationcode?: string;
  stationname: string;
  provinceno?: string;
  provincename?: string;
}

const emptyAmounts = (): Amounts => ({});

export const emptyValues = (): SectorValues =>
  Object.fromEntries(
    FEE_SECTORS.map((s) => [
      s.key,
      { [FIRE_CODE_MODE_MANUAL]: emptyAmounts(), [FIRE_CODE_MODE_FSIS]: emptyAmounts() },
    ]),
  ) as unknown as SectorValues;

export const sumAmounts = (amounts: Amounts) =>
  Object.values(amounts).reduce((a, b) => a + (Number(b) || 0), 0);

export const monthTotal = (v: SectorValues) =>
  FEE_SECTORS.reduce((a, s) => a + MODES.reduce((b, m) => b + sumAmounts(v[s.key][m.code]), 0), 0);

export const sectorTotal = (v: SectorValues, sector: FireCodeSectorKey) =>
  MODES.reduce((b, m) => b + sumAmounts(v[sector][m.code]), 0);

export const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-01`;

/** First day of the current month, in ms. */
function startOfCurrentMonth(): number {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}

/** True when the given year/month is earlier than the current month. */
export function isPastMonth(year: number, month: number): boolean {
  return new Date(year, month - 1, 1).getTime() < startOfCurrentMonth();
}

/** Keeps digits and a single decimal point, max two decimals. */
export function sanitizeAmount(raw: string): string {
  let s = String(raw ?? "").replace(/[^0-9.]/g, "");
  const first = s.indexOf(".");
  if (first >= 0) s = s.slice(0, first + 1) + s.slice(first + 1).replace(/\./g, "");
  const [whole, dec] = s.split(".");
  const cleanWhole = whole.replace(/^0+(?=\d)/, "");
  return dec === undefined ? cleanWhole : `${cleanWhole}.${dec.slice(0, 2)}`;
}

export const toAmount = (raw: string) => {
  const n = Number(sanitizeAmount(raw));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/* -------------------------------------------------------------------------- */
/*  Cells                                                                      */
/* -------------------------------------------------------------------------- */

/** Peso amount input — grouped thousands, always two decimals when idle. */
export function AmountInput({
  value,
  onValueChange,
  disabled,
}: {
  value: number;
  onValueChange: (raw: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = React.useState(() => peso(value));
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) setText(peso(value));
  }, [value, focused]);

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      disabled={disabled}
      readOnly={disabled}
      className={cn("h-9 text-right tabular-nums", disabled && "cursor-not-allowed opacity-60")}
      onFocus={(e) => {
        if (disabled) return;
        setFocused(true);
        const plain = sanitizeAmount(e.target.value);
        if (toAmount(plain) === 0) setText("");
        else {
          setText(groupAmountText(plain));
          requestAnimationFrame(() => e.target.select());
        }
      }}
      onBlur={() => {
        if (disabled) return;
        setFocused(false);
        const amount = toAmount(text);
        setText(peso(amount));
        onValueChange(String(amount));
      }}
      onChange={(e) => {
        if (disabled) return;
        const next = sanitizeAmount(e.target.value);
        setText(groupAmountText(next));
        onValueChange(next);
      }}
    />
  );
}

/** Static peso cell used by the read-only variants of the matrix. */
export function ReadOnlyAmount({ value }: { value: number }) {
  const v = Number(value) || 0;
  return (
    <span
      className={cn(
        "block rounded-md border border-border/40 bg-muted/30 px-2 py-1.5 text-right text-xs tabular-nums",
        !v && "text-muted-foreground",
      )}
    >
      {peso(v)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wide fee-category matrix                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fee categories as rows; TOTAL plus one column group per establishment sector
 * (BPLO, GOV, PEZA, TIEZA) with a MANUAL and an FSIC amount each.
 *
 * Pass `onChange` for the editable variant; omit it for a read-only table.
 */
export function FeeMatrixTable({
  categories,
  values,
  onChange,
  locked,
}: {
  categories: FeeCategory[];
  values: SectorValues;
  onChange?: (sector: FireCodeSectorKey, mode: ModeCode, feecateg: number, raw: string) => void;
  locked?: boolean;
}) {
  const groups = React.useMemo(() => groupCategories(categories), [categories]);
  const editable = typeof onChange === "function";

  const columnTotals = React.useMemo(
    () =>
      FEE_SECTORS.map((s) => ({
        key: s.key,
        byMode: MODES.map((m) => ({ code: m.code, total: sumAmounts(values[s.key][m.code]) })),
      })),
    [values],
  );

  const grand = React.useMemo(
    () => columnTotals.reduce((a, s) => a + s.byMode.reduce((b, m) => b + m.total, 0), 0),
    [columnTotals],
  );

  const cell = (sector: FireCodeSectorKey, mode: ModeCode, detno: number) => {
    const amount = values[sector][mode][detno] ?? 0;
    return editable ? (
      <AmountInput
        value={amount}
        disabled={locked}
        onValueChange={(raw) => onChange?.(sector, mode, detno, raw)}
      />
    ) : (
      <ReadOnlyAmount value={amount} />
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
        <colgroup>
          <col className="w-64" />
          <col className="w-28" />
          {FEE_SECTORS.map((s) => (
            <React.Fragment key={`${s.key}-cols`}>
              <col className="w-36" />
              <col className="w-36" />
            </React.Fragment>
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="head-soft sticky left-0 z-30 w-64 min-w-64 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider"
            >
              Fee Category
            </th>
            <th
              rowSpan={2}
              className="head-soft sticky left-64 z-30 w-28 min-w-28 border-l border-grid px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wider"
            >
              Total
            </th>
            {FEE_SECTORS.map((s) => (
              <th
                key={s.key}
                colSpan={2}
                className="head-soft border-l border-grid px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider"
              >
                {s.label}
              </th>
            ))}
          </tr>
          <tr>
            {FEE_SECTORS.map((s) => (
              <React.Fragment key={`${s.key}-sub`}>
                {MODES.map((m, mi) => (
                  <th
                    key={`${s.key}-${m.code}`}
                    className={cn(
                      "head-soft w-36 min-w-36 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider",
                      mi === 0 && "border-l border-grid",
                    )}
                  >
                    {m.label}
                  </th>
                ))}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.label}>
              <tr className="bg-primary/5">
                <td
                  colSpan={2}
                  className="sticky left-0 z-20 bg-card px-3 py-1.5 before:pointer-events-none before:absolute before:inset-0 before:bg-primary/5 before:content-['']"
                >
                  <span className="relative text-[10px] font-bold uppercase tracking-wider text-primary">
                    {g.code || g.label}
                  </span>
                  {g.items.length > 1 && g.label ? (
                    <span className="relative ml-2 text-[10px] font-normal normal-case text-muted-foreground">
                      {g.label}
                    </span>
                  ) : null}
                </td>
                {FEE_SECTORS.map((s) => (
                  <td key={`${s.key}-g`} colSpan={2} className="border-l border-grid px-3 py-1.5" />
                ))}
              </tr>
              {g.items.map((c) => {
                const rowTotal = FEE_SECTORS.reduce(
                  (a, s) => a + MODES.reduce((b, m) => b + (values[s.key][m.code][c.detno] ?? 0), 0),
                  0,
                );
                return (
                  <tr key={c.key} className="border-t border-grid">
                    <td className="sticky left-0 z-20 w-64 min-w-64 border-t border-grid bg-card px-3 py-1.5 align-middle text-foreground/90">
                      {c.label}
                    </td>
                    <td className="sticky left-64 z-20 w-28 min-w-28 border-l border-t border-grid bg-card px-3 py-1.5 text-right font-semibold tabular-nums">
                      {peso(rowTotal)}
                    </td>
                    {FEE_SECTORS.map((s) => (
                      <React.Fragment key={`${s.key}-${c.key}`}>
                        <td className="w-36 min-w-36 border-l border-t border-grid px-2 py-1.5">
                          {cell(s.key, FIRE_CODE_MODE_MANUAL, c.detno)}
                        </td>
                        <td className="w-36 min-w-36 border-t border-grid px-2 py-1.5">
                          {cell(s.key, FIRE_CODE_MODE_FSIS, c.detno)}
                        </td>
                      </React.Fragment>
                    ))}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-grid bg-muted/60">
            <td className="sticky left-0 z-30 w-64 min-w-64 bg-muted px-3 py-2 text-[10px] font-bold uppercase tracking-wider">
              Total
            </td>
            <td className="sticky left-64 z-30 w-28 min-w-28 border-l border-grid bg-muted px-3 py-2 text-right font-bold tabular-nums text-primary">
              {peso(grand)}
            </td>
            {columnTotals.map((s) => (
              <React.Fragment key={`${s.key}-total`}>
                {s.byMode.map((m, mi) => (
                  <td
                    key={`${s.key}-${m.code}-total`}
                    className={cn(
                      "w-36 min-w-36 px-3 py-2 text-right font-bold tabular-nums",
                      mi === 0 && "border-l border-grid",
                    )}
                  >
                    {peso(m.total)}
                  </td>
                ))}
              </React.Fragment>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
