"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { locationAPI } from "@/services/locationAPI";
import { unwrap, EMPTY_GUID } from "@/lib/api-envelope";
import type { SearchLocationModel } from "@/types/locationType";
import { cn } from "@/lib/utils";

export type LocationType = "REGION" | "PROVINCE" | "CITY" | "BARANGAY";

type Props = {
  value?: string; // locationno
  valueName?: string; // fallback label before the list loads
  /** Which level of location this picker resolves. */
  locationtype: LocationType;
  /** Parent locationcode used to scope the query (e.g. a region code for provinces). */
  parentcode?: string;
  onChange: (locationno: string, locationname: string, item?: SearchLocationModel) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** Hide the `locationcode` subtitle (used by Province / Barangay pickers). */
  hideCode?: boolean;
  /**
   * When true, prepends an "ALL" option that resolves to `EMPTY_GUID`.
   * Used for editable Province/Station pickers governed by the authorization matrix.
   */
  showAllOption?: boolean;
};

import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";

/**
 * Searchable + paginated location picker backed by `locationAPI.search`.
 * The `locationtype` prop selects the level (REGION / PROVINCE / CITY / BARANGAY)
 * and `parentcode` scopes the results to the selected parent.
 */
export default function LocationSearchSelect({
  value,
  valueName,
  locationtype,
  parentcode = "",
  onChange,
  placeholder = "Select…",
  disabled,
  readOnly,
  className,
  hideCode = false,
  showAllOption = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchLocationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [label, setLabel] = React.useState<string>(valueName ?? "");

  React.useEffect(() => {
    if (valueName) setLabel(valueName);
  }, [valueName]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  // Load rows when popover opens / search / page / parent changes
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await locationAPI.search(
        {
          searchkey: debounced || "",
          parentcode: parentcode || "",
          locationtype,
          pagenumber: page,
          pagesize: PAGE_SIZE,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<SearchLocationModel[]>(resp);
      if (cancelled) return;
      setRows(ok && Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, page, parentcode, locationtype]);

  const select = (r: SearchLocationModel) => {
    setLabel(r.locationname);
    onChange(r.locationno, r.locationname, r);
    setOpen(false);
  };

  const selectAll = () => {
    setLabel("ALL");
    onChange(EMPTY_GUID, "ALL");
    setOpen(false);
  };

  const allSelected = showAllOption && (value === EMPTY_GUID || value === "" || value === undefined);

  const showPrev = page > 1;
  const showNext = rows.length === PAGE_SIZE;

  // Disabled + read-only render as a plain read-only field — no dropdown
  // chevron, no interaction affordance — while preserving size/spacing/type.
  if (readOnly || disabled) {
    return (
      <div
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 text-left text-sm cursor-default",
          className,
        )}
        aria-readonly
        aria-disabled={disabled || undefined}
      >
        <span className={cn("min-w-0 flex-1 truncate", !label && "text-muted-foreground")}>
          {label || placeholder}
        </span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis", !label && "text-muted-foreground")}>
            {label || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-max min-w-[320px] p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 && !showAllOption ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No results</div>
          ) : (
            <>
              {showAllOption && page === 1 ? (
                <button
                  type="button"
                  onClick={selectAll}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    allSelected && "bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">ALL</div>
                  </div>
                  {allSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              ) : null}
              {rows.map((r) => {
              const isSelected = r.locationno === value;
              return (
                <button
                  key={r.locationno}
                  type="button"
                  onClick={() => select(r)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    isSelected && "bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.locationname}</div>
                    {!hideCode && r.locationcode ? (
                      <div className="truncate text-xs text-muted-foreground">{r.locationcode}</div>
                    ) : null}
                  </div>
                  {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
              })}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!showPrev || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!showNext || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
