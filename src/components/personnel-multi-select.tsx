"use client";

import * as React from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Loader2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { personnelAPI } from "@/services/personnelAPI";
import { unwrap } from "@/lib/api-envelope";
import AvatarWithFallback from "@/components/avatar-with-fallback";
import { cn } from "@/lib/utils";
import { SEARCH_POPOVER_PAGE_SIZE as PAGE_SIZE } from "@/lib/ui-constants";

export interface SelectedPersonnel {
  memberno: string;
  fullname: string;
}

/** The Personnel/Search endpoint returns PascalCase keys, so normalize both shapes. */
interface RawMember {
  Memberno?: string;
  memberno?: string;
  Fullname?: string;
  fullname?: string;
  Badgeno?: string;
  badgeno?: string;
  Rankcode?: string;
  rankcode?: string;
  Profileurl?: string;
  profileurl?: string;
}

function normalize(row: RawMember) {
  return {
    memberno: row.Memberno ?? row.memberno ?? "",
    fullname: row.Fullname ?? row.fullname ?? "",
    badgeno: row.Badgeno ?? row.badgeno ?? "",
    rankcode: row.Rankcode ?? row.rankcode ?? "",
    profileurl: row.Profileurl ?? row.profileurl ?? "",
  };
}

export type PersonnelMultiSelectProps = {
  value: SelectedPersonnel[];
  onChange: (selected: SelectedPersonnel[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function PersonnelMultiSelect({
  value,
  onChange,
  placeholder = "Select personnel",
  disabled,
  className,
}: PersonnelMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<ReturnType<typeof normalize>[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setPage(1);
  }, [debounced]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await personnelAPI.search(
        { searchKey: debounced || "", pageNumber: page, pageSize: PAGE_SIZE },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<RawMember[]>(resp);
      if (cancelled) return;
      setRows(ok && Array.isArray(data) ? data.map(normalize) : []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debounced, page]);

  const isSelected = (no: string) => value.some((v) => v.memberno === no);

  const toggle = (r: ReturnType<typeof normalize>) => {
    if (isSelected(r.memberno)) {
      onChange(value.filter((v) => v.memberno !== r.memberno));
    } else {
      onChange([...value, { memberno: r.memberno, fullname: r.fullname }]);
    }
  };

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? value[0].fullname
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
          <span
            className={cn(
              "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis",
              value.length === 0 && "text-muted-foreground",
            )}
          >
            {label}
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
              placeholder="Search personnel…"
              className="h-9 w-full rounded-md border bg-background pl-8 pr-2 text-sm"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No personnel found</div>
          ) : (
            rows.map((r) => {
              const sel = isSelected(r.memberno);
              return (
                <button
                  key={r.memberno || r.badgeno}
                  type="button"
                  onClick={() => toggle(r)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    sel && "bg-muted",
                  )}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <AvatarWithFallback
                      src={r.profileurl || null}
                      entity={r}
                      name={r.fullname}
                      alt={r.fullname}
                      className="h-8 w-8 overflow-hidden rounded-full bg-muted/30"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {r.rankcode ? `${r.rankcode} ` : ""}
                        {r.fullname}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{r.badgeno}</div>
                    </div>
                  </div>
                  {sel ? <Check className="h-4 w-4 text-primary" /> : null}
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

export default PersonnelMultiSelect;
