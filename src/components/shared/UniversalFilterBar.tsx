import * as React from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SearchKey from "@/components/search-key";
import { cn } from "@/lib/utils";

export interface UniversalFilterBarProps {
  /** Committed search value. */
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  /**
   * Additional filter controls. When omitted the Filter toggle is hidden —
   * modules without extra filters show only the search field.
   */
  filters?: React.ReactNode;
  /** Number of non-default filters, shown as a badge on the Filter button. */
  activeFilterCount?: number;
  /** Optional reset action rendered at the end of the filter popover. */
  onReset?: () => void;
  /** Action buttons — primary is the Add button, secondary the Export button. */
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * UniversalFilterBar — one shared toolbar layout for every ledger module.
 *
 * Desktop: search on the far left (narrow), optional Filter popover trigger on the far right.
 * Mobile: search on top, then
 *   - with filters: Filter (left) + Export (right) at 50% each, Add full width below
 *   - without filters: Add (left) + Export (right) at 50% each, or a single full-width button
 */
export function UniversalFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  activeFilterCount = 0,
  onReset,
  primaryAction,
  secondaryAction,
  className,
}: UniversalFilterBarProps) {
  const hasFilters = Boolean(filters);

  const FilterPopover = ({ fullWidth }: { fullWidth?: boolean }) => {
    const [open, setOpen] = React.useState(false);
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            className={cn("h-10 min-w-0 justify-center gap-2", fullWidth ? "w-full" : "shrink-0")}
          >
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="z-50 w-[min(22rem,calc(100vw-2rem))] p-3"
          onPointerDownOutside={(e) => {
            // Keep the filter popover open when interacting with nested
            // picker popovers (e.g. searchable Province / Station selects).
            if ((e.target as HTMLElement).closest('[role="dialog"]')) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if ((e.target as HTMLElement).closest('[role="dialog"]')) e.preventDefault();
          }}
        >
          <div className="grid grid-cols-1 gap-3">{filters}</div>

          {onReset ? (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={onReset}
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  };

  const wrap = (node: React.ReactNode, key: string) => (
    <div key={key} className="[&>*]:w-full">
      {node}
    </div>
  );

  // Mobile action rows
  const mobileRows: React.ReactNode[] = [];
  if (hasFilters) {
    mobileRows.push(
      <div
        key="row-filter"
        className={cn("grid gap-3", secondaryAction ? "grid-cols-2" : "grid-cols-1")}
      >
        <FilterPopover fullWidth />
        {secondaryAction ? wrap(secondaryAction, "export") : null}
      </div>,
    );
    if (primaryAction) {
      mobileRows.push(
        <div key="row-add" className="grid grid-cols-1 gap-3">
          {wrap(primaryAction, "add")}
        </div>,
      );
    }
  } else {
    const actions = [primaryAction, secondaryAction].filter(Boolean) as React.ReactNode[];
    if (actions.length > 0) {
      mobileRows.push(
        <div
          key="row-actions"
          className={cn("grid gap-3", actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}
        >
          {actions.map((a, i) => wrap(a, `a${i}`))}
        </div>,
      );
    }
  }

  return (
    <Card className={cn("border-border/60 p-3 sm:p-4", className)}>
      <div className="grid gap-3">
        {/* Search + (optional) filter popover */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchKey
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            widthClass="w-full md:w-72 lg:w-80"
          />

          <div className="hidden md:flex md:items-center md:gap-3">
            {hasFilters ? <FilterPopover /> : null}

            <div className="flex items-center gap-2">
              {secondaryAction ? <div className="hidden md:block">{secondaryAction}</div> : null}
              {primaryAction ? <div className="hidden md:block">{primaryAction}</div> : null}
            </div>
          </div>
        </div>

        {/* Mobile-only rows */}
        {mobileRows.length > 0 ? <div className="grid gap-3 md:hidden">{mobileRows}</div> : null}
      </div>
    </Card>
  );
}

export default UniversalFilterBar;
