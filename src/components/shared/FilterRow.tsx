import * as React from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [spinKey, setSpinKey] = React.useState(0);

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
      {onReset && (
        <button
          type="button"
          onClick={() => {
            setSpinKey((k) => k + 1);
            onReset();
          }}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RotateCw
            key={spinKey}
            className={cn("h-4 w-4", spinKey > 0 && "[animation:spin_400ms_ease-out_1]")}
          />
          Reset
        </button>
      )}
    </div>
  );
}

export default FilterRow;
