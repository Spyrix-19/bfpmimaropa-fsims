import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Shared behavior for whole-number (0-9 only) inputs across the encoding
 * screens: digits-only typing, `0` clears on focus, empty restores to `0` on
 * blur, and Arrow Up/Down moves between sibling numeric inputs.
 */

/** Normalize any incoming value (null/undefined/""/NaN) to a whole number >= 0. */
export function toWholeNumber(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Keep digits only and strip redundant leading zeros ("007" -> "7"). */
export function sanitizeWholeNumber(raw: string): string {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  if (digits === "") return "";
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  return trimmed === "" ? "0" : trimmed;
}

const NAV_ATTR = "data-numeric-input";

function moveFocus(current: HTMLInputElement, delta: number) {
  const scope = current.closest("form, table, [data-numeric-group]") ?? current.ownerDocument.body;
  const nodes = Array.from(scope.querySelectorAll<HTMLInputElement>(`input[${NAV_ATTR}]`)).filter(
    (el) => !el.disabled && !el.readOnly && el.tabIndex !== -1,
  );
  const index = nodes.indexOf(current);
  if (index === -1) return;
  const next = nodes[index + delta];
  if (!next) return;
  next.focus();
  next.select?.();
}

export interface NumericFieldOptions {
  /** Current committed value (may be null/undefined/empty — treated as 0). */
  value: unknown;
  /** Receives the sanitized raw string ("" while the field is being cleared). */
  onValueChange: (raw: string) => void;
  disabled?: boolean;
}

/**
 * Props spread onto a native `<input>` (or the shadcn `Input`) to get the
 * shared numeric behavior. Focus/blur clearing is done directly on the DOM
 * node so it never touches form state (keeps dirty-tracking accurate).
 */
export function numericFieldProps({ value, onValueChange, disabled }: NumericFieldOptions) {
  const numeric = toWholeNumber(value);
  return {
    type: "text" as const,
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    autoComplete: "off",
    [NAV_ATTR]: "",
    value: String(numeric),
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.target.value === "0") e.target.value = "";
      else e.target.select();
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.target.value === "") e.target.value = String(toWholeNumber(value));
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        moveFocus(e.currentTarget, e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[0-9]/.test(e.key)) {
        e.preventDefault();
      }
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      const next = sanitizeWholeNumber(e.target.value);
      e.target.value = next;
      onValueChange(next);
    },
  };
}

export interface NumericInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "onValueChange"
> {
  value: unknown;
  onValueChange: (raw: string) => void;
}

/** shadcn `Input` wired with the shared whole-number behavior. */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, disabled, readOnly, ...rest }, ref) => {
    const props = numericFieldProps({
      value,
      onValueChange,
      disabled: Boolean(disabled || readOnly),
    });
    return <Input ref={ref} {...props} disabled={disabled} readOnly={readOnly} {...rest} />;
  },
);
NumericInput.displayName = "NumericInput";
