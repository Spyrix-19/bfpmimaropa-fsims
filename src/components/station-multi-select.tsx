"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import type {
  SearchStationModel,
  StationMultipleSearchRequest,
  ProvinceStationSelection,
} from "@/types/stationTypes";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { cn } from "@/lib/utils";
import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";
import { resolvePageCount } from "@/lib/page-count";

export interface SelectedStation {
  stationno: string;
  stationname: string;
  provinceno: string;
  provincename: string;
}

export type StationMultiSelectProps = {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  mode: "station";
  value: SelectedStation[];
  provinces: ProvinceStationSelection[];
  reportyear?: number;
  onChange: (selected: SelectedStation[]) => void;
  alwaysEnabled?: boolean;
};

export function StationMultiSelect(props: StationMultiSelectProps) {
  const {
    value,
    provinces,
    reportyear = 0,
    onChange,
    placeholder = "Select unit / station",
    disabled,
    className,
    alwaysEnabled = false,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<SearchStationModel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pageCount, setPageCount] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  const provincesKey = React.useMemo(
    () =>
      provinces
        .map((p) => p.provinceno)
        .sort()
        .join(","),
    [provinces],
  );

  React.useEffect(() => {
    setPage(1);
  }, [provincesKey]);

  const noProvince = provinces.length === 0;

  React.useEffect(() => {
    if (alwaysEnabled) return;
    if (noProvince) {
      if (value.length > 0) onChange([]);
      return;
    }
    const allowed = new Set(provinces.map((p) => p.provinceno));
    const filtered = value.filter((v) => allowed.has(v.provinceno));
    if (filtered.length !== value.length) onChange(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provincesKey]);

  React.useEffect(() => {
    if (!open) return;
    if (noProvince && !alwaysEnabled) {
      setRows([]);
      setPageCount(1);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const body: StationMultipleSearchRequest = {
        searchkey: debounced || "",
        reportyear: Number(reportyear) || 0,
        provinces,
      };
      const resp = await stationAPI.searchStationMultiple(
        body,
        { Pagenumber: page, Pagesize: PAGE_SIZE },
        { suppressGlobalLoading: true },
      );
      const { ok, data, total, totalPages } = unwrap<SearchStationModel[]>(resp);
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
  }, [open, debounced, page, provincesKey, reportyear, noProvince, alwaysEnabled]);

  const isSelected = (no: string) => value.some((v) => v.stationno === no);

  const toggle = (r: SearchStationModel) => {
    if (isSelected(r.stationno)) {
      onChange(value.filter((v) => v.stationno !== r.stationno));
    } else {
      if (value.some((v) => v.stationno === r.stationno)) return;
      onChange([
        ...value,
        {
          stationno: r.stationno,
          stationname: r.stationname,
          provinceno: r.provinceno,
          provincename: r.provincename,
        },
      ]);
    }
  };

  const selectAll = () => onChange([]);

  const allSelected = value.length === 0;
  const label =
    value.length === 0
      ? "ALL"
      : value.length === 1
        ? `${value[0].stationname}${value[0].provincename ? ` (${value[0].provincename})` : ""}`
        : `${value.length} selected`;

  const showPrev = page > 1;
  const showNext = page < pageCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || (noProvince && !alwaysEnabled)}
          className={cn(
            "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 text-left text-sm disabled:opacity-50",
            className,
          )}
        >
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
            {noProvince && !alwaysEnabled ? "Select a province first" : label || placeholder}
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
                <div className="py-6 text-center text-sm text-muted-foreground">No units found</div>
              ) : null}
              {rows.map((r) => {
                const sel = isSelected(r.stationno);
                return (
                  <button
                    key={r.stationno || `${r.stationcode}-${r.stationname}`}
                    type="button"
                    onClick={() => toggle(r)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                      sel && "bg-muted",
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
                          {r.provincename ? " · " + r.provincename : ""}
                        </div>
                      </div>
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

export default StationMultiSelect;
