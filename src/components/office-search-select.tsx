"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { officeAPI } from "@/services/officeAPI";
import { unwrap } from "@/lib/api-envelope";
import type { SearchOfficeModel } from "@/types/officeTypes";
import { cn } from "@/lib/utils";

type Props = {
  value?: string; // detno as string
  valueName?: string;
  onChange: (detno: string, name: string, row?: SearchOfficeModel) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
};

import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";
import { resolvePageCount } from "@/lib/page-count";

/** Searchable + paginated picker for BFP offices backed by `officeAPI.search`. */
export default function OfficeSearchSelect({
  value,
  valueName,
  onChange,
  placeholder = "Select office",
  disabled,
  readOnly,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchOfficeModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pageCount, setPageCount] = React.useState(1);
  const [label, setLabel] = React.useState<string>(valueName ?? "");

  React.useEffect(() => {
    if (valueName) setLabel(valueName);
  }, [valueName]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await officeAPI.search(
        { searchKey: debounced || "", pageNumber: page, pageSize: PAGE_SIZE },
        { suppressGlobalLoading: true },
      );
      const { ok, data, total, totalPages } = unwrap<SearchOfficeModel[]>(resp);
      if (cancelled) return;
      const loaded = ok && Array.isArray(data) ? data : [];
      setRows(loaded);
      setPageCount(
        resolvePageCount({ total, totalPages, pageSize: PAGE_SIZE, page, rowCount: loaded.length }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, page]);

  const select = (r: SearchOfficeModel) => {
    const name = r.description ?? r.recordcode ?? "";
    setLabel(name);
    onChange(String(r.detno), name, r);
    setOpen(false);
  };

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
        <span
          className={cn(
            "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis",
            !label && "text-muted-foreground",
          )}
        >
          {label || placeholder}
        </span>
      </div>
    );
  }

  const showPrev = page > 1;
  const showNext = page < pageCount;

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
          <span className={cn("min-w-0 flex-1 truncate", !label && "text-muted-foreground")}>
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
              placeholder="Search office…"
              className="h-9 w-full rounded-md border border-primary/30 bg-background pl-8 pr-9 text-sm transition-colors hover:border-primary/50 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No data available</div>
          ) : (
            rows.map((r) => {
              const selected = String(r.detno) === String(value ?? "");
              return (
                <button
                  key={r.detno}
                  type="button"
                  onClick={() => select(r)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    selected && "bg-muted",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.description}</div>
                    {r.recordcode ? (
                      <div className="truncate text-xs text-muted-foreground">{r.recordcode}</div>
                    ) : null}
                  </div>
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </button>
              );
            })
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
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
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
