import * as React from "react";
import { ChevronDown, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Unified Filter Popover shell used across Personnel, All Attendance,
 * Unit Assignment, and Leave Request pages.
 *
 * - Same trigger styling everywhere: bordered pill with the emerald/green
 *   theme colors used across the app. Hover flips background to
 *   `emerald-600` with white foreground.
 * - Same popover shell: padded box, vertical stack of filter rows (supplied
 *   as `children`), and a right-aligned "Clear filters" action.
 * - Consumers own the individual filter fields (each page has its own set)
 *   but MUST render them inside this shell so behavior/spacing/hover match.
 *
 * Do NOT create page-specific filter popovers — reuse this component.
 */
type Props = {
  /** Number of active filters — appended to the trigger label as "(N)". */
  activeCount?: number;
  /** Clear-all handler shown at the popover footer. Omit to hide the link. */
  onClear?: () => void;
  /** Popover alignment relative to the trigger. */
  align?: "start" | "center" | "end";
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
  /** Extra classes for the popover content (width/height tweaks). */
  contentClassName?: string;
  /** Filter rows. Wrap each field in a <FilterRow label="…"> for consistency. */
  children: React.ReactNode;
};

export default function FilterPopoverShell({
  activeCount = 0,
  onClear,
  align = "end",
  triggerClassName,
  contentClassName,
  children,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group h-10 inline-flex items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm",
            "hover:bg-primary hover:text-white",
            triggerClassName,
          )}
        >
          <Filter className="h-4 w-4 text-primary group-hover:text-white" />
          <span>Filter{activeCount ? ` (${activeCount})` : ""}</span>
          <ChevronDown className="h-4 w-4 text-primary group-hover:text-white" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("w-[320px] space-y-3 p-3", contentClassName)}
      >
        {children}
        {onClear ? (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Row wrapper: uppercase label + control below. Matches Station page. */
export function FilterRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
