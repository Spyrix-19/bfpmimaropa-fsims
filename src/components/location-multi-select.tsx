"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { locationAPI } from "@/services/locationAPI";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import type { SearchLocationModel } from "@/types/locationType";
import { cn } from "@/lib/utils";
import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";

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
  } = props;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchLocationModel[]>([]);
  const [loading, setLoading] = React.useState(false);

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
            reportyear: 0,
            provinces: [],
          },
          { Pagenumber: page, Pagesize: PAGE_SIZE },
          { suppressGlobalLoading: true },
        );
        const { ok, data } = unwrap<unknown[]>(resp);
        if (cancelled) return;
        const provinceRows = Array.isArray(data)
          ? Array.from(
              new Map(
                (data as Array<{ provinceno?: string; provincename?: string }>).map((item) => [
                  item.provinceno ?? item.provincename ?? "",
                  {
                    locationno: item.provinceno ?? "",
                    locationcode: item.provinceno ?? "",
                    locationname: item.provincename ?? "",
                    locationtype: "PROVINCE",
                    sortorder: 0,
                  } satisfies SearchLocationModel,
                ]),
              ).values(),
            )
          : [];
        setRows(provinceRows);
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
      const { ok, data } = unwrap<SearchLocationModel[]>(resp);
      if (cancelled) return;
      setRows(ok && Array.isArray(data) ? data : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, page, parentcode, locationtype, useStationApi]);

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
  const showNext = rows.length === PAGE_SIZE;

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
              className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
            />
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

export default LocationMultiSelect;
