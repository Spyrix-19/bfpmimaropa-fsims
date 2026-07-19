import React from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

// Generic Option type — default value type is string
export type Option<V = string> = { value: V; label: string; raw?: any };

export default function GentableSelect<V extends string | number = string>(props: {
  value?: V;
  onChange?: (v: V, opt?: Option<V>) => void;
  options: Option<V>[];
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  // allow passing additional classNames to the trigger button
  className?: string;
  // optional custom stringifier for values when matching/keys are required
  valueToString?: (v: V) => string;
  "aria-label"?: string;
  id?: string;
}) {
  const { value, onChange, options, placeholder, disabled, readOnly, className, valueToString, id } = props;
  const ariaLabel = props["aria-label"];

  const toStr = (v: any) => (valueToString ? valueToString(v) : String(v ?? ""));

  const current = options.find((o) => toStr(o.value) === toStr(value));
  const displayLabel = current ? current.label : (placeholder ?? "-- Select --");
  const isInert = disabled || readOnly;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isInert}>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel ?? displayLabel}
          aria-disabled={isInert || undefined}
          aria-readonly={readOnly || undefined}
          className={
            (className ?? "") +
            " h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm text-left inline-flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" +
            (disabled ? " disabled:opacity-60 disabled:cursor-not-allowed" : "") +
            (readOnly && !disabled ? " cursor-default" : "")
          }
        >
          <span className={(current ? "" : "text-muted-foreground") + " min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis"}>{displayLabel}</span>
          {!isInert ? (
            <ChevronDown className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      {!isInert ? (
        <DropdownMenuContent className="w-max min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-auto">
          <DropdownMenuItem onSelect={() => onChange?.("" as unknown as V)}>
            {placeholder ?? "-- Select --"}
          </DropdownMenuItem>
          {options.map((o) => (
            <DropdownMenuItem key={toStr(o.value)} onSelect={() => onChange?.(o.value, o)}>
              {o.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : null}
    </DropdownMenu>
  );
}
