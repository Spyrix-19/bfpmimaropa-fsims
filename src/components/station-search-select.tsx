"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import { EMPTY_GUID } from "@/lib/fsims-constants";
import type { SearchStationModel } from "@/types/stationTypes";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { cn } from "@/lib/utils";

type Props = {
  value?: string; // stationno
  valueName?: string; // currently-selected name (so trigger renders even before list loads)
  provinceno?: string; // optional province filter for station lookup
  onChange: (
    stationno: string,
    name: string,
    province?: string,
    station?: SearchStationModel,
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /**
   * When true, prepends an "ALL" option that resolves to `EMPTY_GUID`.
   * Used for editable Station pickers governed by the authorization matrix.
   * When combined with `provinceno`, ALL still respects the province scope
   * (backend receives stationno=EMPTY_GUID + provinceno=<login province>).
   */
  showAllOption?: boolean;
  /** Optional report year context (accepted for API parity; not used by the search endpoint). */
  reportyear?: number;
};

import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";
import { resolvePageCount } from "@/lib/page-count";

/**
 * Searchable + paginated station/unit picker.
 * Hits `stationAPI.searchStation` with pagesize=10 (backend-driven) and exposes Prev/Next.
 */
export default function StationSearchSelect({
  value,
  valueName,
  provinceno,
  onChange,
  placeholder = "Select unit / station",
  disabled,
  readOnly,
  className,
  showAllOption = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchStationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pageCount, setPageCount] = React.useState(1);
  const [label, setLabel] = React.useState<string>(valueName ?? "");

  React.useEffect(() => {
    if (valueName) setLabel(valueName);
  }, [valueName]);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  // Load rows when popover open / search / page changes
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await stationAPI.search(
        {
          searchKey: debounced || "",
          provinceno: provinceno || undefined,
          pageNumber: page,
          pageSize: PAGE_SIZE,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data, total, totalPages } = unwrap<any[]>(resp);
      if (cancelled) return;
      // Map to StationCodeModel. Per spec: use `logourl` directly for the
      // logo — do NOT fall back to filetype/imagedata base64 anymore.
      const mapped: SearchStationModel[] = (ok && Array.isArray(data) ? data : []).map(
        (s: any) =>
          ({
            stationno: s.stationno,
            stationcode: s.stationcode ?? s.stationCode ?? "",
            stationname: s.stationname ?? s.stationName ?? "",
            regionno: s.regionno ?? "",
            regioncode: s.regioncode ?? "",
            regionname: s.regionname ?? s.regionName ?? "",
            provinceno: s.provinceno ?? "",
            provincename: s.provincename ?? s.provinceName ?? "",
            cityno: s.cityno ?? "",
            cityname: s.cityname ?? s.cityName ?? "",
            zipcode: s.zipcode ?? "",
            barangayno: s.barangayno ?? "",
            barangayname: s.barangayname ?? s.barangayName ?? "",
            streetaddress: s.streetaddress ?? s.streetAddress ?? "",
            logourl: s.logourl ?? s.logoUrl ?? "",
            filetype: s.filetype ?? "",
          }) as any,
      );
      setRows(mapped);
      setPageCount(
        resolvePageCount({ total, totalPages, pageSize: PAGE_SIZE, page, rowCount: mapped.length }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, page, provinceno]);

  const select = (r: SearchStationModel) => {
    setLabel(r.stationname);
    onChange(r.stationno, r.stationname, r.provincename, r);
    setOpen(false);
  };

  const selectAll = () => {
    setLabel("ALL");
    onChange(EMPTY_GUID, "ALL");
    setOpen(false);
  };

  const allSelected =
    showAllOption && (value === EMPTY_GUID || value === "" || value === undefined);

  const showPrev = page > 1;
  const showNext = page < pageCount;

  // Disabled + read-only render as a plain read-only field — no dropdown
  // chevron, no interaction affordance — while preserving size/spacing/type.
  if (readOnly || disabled) {
    return (
      <div
        className={cn(
          "h-10 w-full min-w-0 rounded-md border bg-muted/40 px-3 text-sm flex items-center justify-between gap-2 text-left cursor-default",
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
            "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm flex items-center justify-between gap-2 text-left disabled:opacity-50",
            className,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis",
              !label && "text-muted-foreground",
            )}
          >
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
              placeholder="Search unit / station…"
              className="h-9 w-full rounded-md border border-primary/30 bg-background pl-8 pr-9 text-sm transition-colors focus:border-primary focus:outline-none focus-visible:outline-none"
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-transparent hover:text-primary"
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
          ) : rows.length === 0 && !showAllOption ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No units found</div>
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
              {rows.map((r: any) => {
                const selected = r.stationno === value;
                return (
                  <button
                    key={r.stationno || `${r.stationcode}-${r.stationname}`}
                    type="button"
                    onClick={() => select(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      selected && "bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <AvatarWithFallback
                        src={r.logourl || null}
                        entity={r}
                        name={r.stationcode ?? r.stationname}
                        alt={r.stationname}
                        className="w-8 h-8 rounded-md overflow-hidden bg-muted/30"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.stationname}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.stationcode}
                        </div>
                      </div>
                    </div>
                    {selected ? <Check className="h-4 w-4 text-primary" /> : null}
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

export { EMPTY_GUID };
