import * as React from "react";
import { cn } from "@/lib/utils";
import ResetFiltersButton from "@/components/reset-filters-button";

/**
 * Inline pill-style filter bar shared by Fire Safety Compliance,
 * Accomplished Notices and Target Reference. Controls render as rounded
 * pills in a single wrapping row, with a text "Reset" action at the end.
 */
export function FilterRow({
  children,
  onReset,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 sm:gap-3",
        // Pill styling for every control rendered inside the row.
        "[&_button[role=combobox]]:h-10 [&_button[role=combobox]]:rounded-full [&_button[role=combobox]]:min-w-[150px] [&_button[role=combobox]]:shadow-sm",
        "[&_input]:h-10 [&_input]:rounded-full",
        className,
      )}
    >
      {children}
      {onReset && <ResetFiltersButton onReset={onReset} className="ml-auto" />}
    </div>
  );
}

export default FilterRow;
