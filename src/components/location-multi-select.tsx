"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { locationAPI } from "@/services/locationAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import type { SearchLocationModel } from "@/types/locationType";
import { cn } from "@/lib/utils";
import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";
import { resolvePageCount } from "@/lib/page-count";

export type LocationType = "REGION" | "PROVINCE" | "CITY" | "BARANGAY";

export interface SelectedLocation {
  locationno: string;
  locationname: string;
}

export type LocationMultiSelectProps = {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  mode: "location";
  value: SelectedLocation[];
  locationtype: LocationType;
  parentcode?: string;
  onChange: (selected: SelectedLocation[]) => void;
  hideCode?: boolean;
  useStationApi?: boolean;
  reportyear?: number;
};

export function LocationMultiSelect(props: LocationMultiSelectProps) {
  const {
    value,
    locationtype,
    parentcode = "",
    onChange,
    placeholder = "Select…",
    disabled,
    className,
    hideCode = false,
    useStationApi = false,
    reportyear = 0,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchLocationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pageCount, setPageCount] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (useStationApi) {
        const resp = await stationAPI.searchStationMultiple(
          {
            searchkey: debounced || "",
            reportyear: Number(reportyear) || 0,
            provinces: [],
          },
          { Pagenumber: page, Pagesize: PAGE_SIZE },
          { suppressGlobalLoading: true },
        );
        const { ok, data, total, totalPages } = unwrap<unknown[]>(resp);
        if (cancelled) return;
        const provinceRows = Array.isArray(data)
          ? (() => {
              const entries = (data as Array<Record<string, any>>).map((item) => {
                const provinceno =
                  item.provinceno ?? item.provinceNo ?? item.province_no ?? item.provinceid ?? item.provinceId ?? null;
                const provincename =
                  item.provincename ?? item.provinceName ?? item.province_name ?? item.provname ?? item.province ?? null;
                return { provinceno, provincename };
              });

              const map = new Map<string, SearchLocationModel>();
              for (const e of entries) {
                if (!e.provinceno && !e.provincename) continue;
                const key = String(e.provinceno ?? e.provincename);
                if (!map.has(key)) {
                  map.set(key, {
                    locationno: String(e.provinceno ?? ""),
                    locationcode: String(e.provinceno ?? ""),
                    locationname: String(e.provincename ?? ""),
                    locationtype: "PROVINCE",
                    sortorder: 0,
                  });
                }
              }

              return Array.from(map.values());
            })()
          : [];

        // If station API returned no province grouping, fallback to location API.
        if (!provinceRows.length) {
          const locResp = await locationAPI.search(
            {
              searchkey: debounced || "",
              parentcode: parentcode || "",
              locationtype: "PROVINCE",
              pagenumber: page,
              pagesize: PAGE_SIZE,
            },
            { suppressGlobalLoading: true },
          );
          const { ok: lok, data: ldata, total: ltotal, totalPages: ltotalPages } = unwrap<SearchLocationModel[] | null>(locResp);
          const loaded = lok && Array.isArray(ldata) ? ldata : [];
          setRows(loaded);
          setPageCount(
            resolvePageCount({ total: ltotal ?? 0, totalPages: ltotalPages ?? 0, pageSize: PAGE_SIZE, page, rowCount: loaded.length }),
          );
          setLoading(false);
          return;
        }

        setRows(provinceRows);
        setPageCount(
          resolvePageCount({
            total,
            totalPages,
            pageSize: PAGE_SIZE,
            page,
            rowCount: provinceRows.length,
          }),
        );
        setLoading(false);
        return;
      }

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
      const { ok, data, total, totalPages } = unwrap<SearchLocationModel[]>(resp);
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
  }, [open, debounced, page, parentcode, locationtype, useStationApi, reportyear]);

  const isSelected = (no: string) => value.some((v) => v.locationno === no);

  const toggle = (r: SearchLocationModel) => {
    if (isSelected(r.locationno)) {
      onChange(value.filter((v) => v.locationno !== r.locationno));
    } else {
      onChange([...value, { locationno: r.locationno, locationname: r.locationname }]);
    }
  };

  const selectAll = () => onChange([]);

  const allSelected = value.length === 0;
  const label =
    value.length === 0
      ? "ALL"
      : value.length === 1
        ? value[0].locationname
        : `${value.length} selected`;

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
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
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
          ) : (
            <>
              {page === 1 ? (
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
              {rows.length === 0 && !loading && page === 1 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">No results</div>
              ) : null}
              {rows.map((r) => {
                const sel = isSelected(r.locationno);
                return (
                  <button
                    key={r.locationno}
                    type="button"
                    onClick={() => toggle(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      sel && "bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.locationname}</div>
                      {!hideCode && r.locationcode ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {r.locationcode}
                        </div>
                      ) : null}
                    </div>
                    {sel ? <Check className="h-4 w-4 text-primary" /> : null}
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

export default LocationMultiSelect;
