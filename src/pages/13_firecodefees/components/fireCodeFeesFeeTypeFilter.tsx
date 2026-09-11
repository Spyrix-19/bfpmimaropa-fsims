import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/api-envelope";
import { gentableAPI } from "@/services/gentableAPI";
import type { SearchGentableModel } from "@/types/gentableType";

/**
 * Fee-type filter of the Fire Code Fees ENTRY FORM only. It is intentionally a
 * standalone copy of the dashboard filter so the two features stay independent.
 */
export const FIRE_CODE_FEES_TABLE = "FIRE CODE FEES";

export interface FeeTypeOption {
  detno: number;
  /** `recordcode`, e.g. "628-BFP-01" — matches the parent code of the matrix. */
  code: string;
  /** Fee parent name, e.g. "Fire Code Construction Tax". */
  name: string;
  label: string;
}

/** Loads the "FIRE CODE FEES" parent codes used by the entry-form filter. */
export function useFeeTypes() {
  const [options, setOptions] = React.useState<FeeTypeOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const resp = await gentableAPI.getCode(FIRE_CODE_FEES_TABLE, {
        suppressGlobalLoading: true,
        suppressErrorToast: true,
      });
      const { ok, data } = unwrap<SearchGentableModel[]>(resp);
      if (cancelled) return;
      const rows = ok && Array.isArray(data) ? [...data] : [];
      rows.sort((a, b) => Number(a.sortorder ?? 0) - Number(b.sortorder ?? 0));
      setOptions(
        rows.map((r) => {
          const code = String(r.recordcode ?? "").trim();
          const name = String(r.description ?? "").replace(/\s+/g, " ").trim();
          return {
            detno: Number(r.detno ?? 0),
            code,
            name,
            label: name ? `${code} — ${name}` : code,
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, loading };
}

export function FeeTypeMultiSelect({
  options,
  loading,
  value,
  onChange,
  className,
}: {
  options: FeeTypeOption[];
  loading?: boolean;
  /** Selected `recordcode` values. Empty means all fee types. */
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const selected = options.filter((o) => value.includes(o.code));
  const label = loading
    ? "Loading fee types…"
    : selected.length === 0
      ? "All fee types"
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} fee types`;

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  return (
    <Popover modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("w-full shrink-0 justify-between sm:w-[280px]", className)}
          title={selected.map((o) => o.label).join(", ")}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      {/* z-index sits above the dialog (z-200) this form is rendered inside. */}
      <PopoverContent align="end" className="z-[300] w-[340px] p-0">
        <div className="p-3 pb-0">
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-medium hover:bg-muted",
              value.length === 0 && "bg-muted",
            )}
          >
            <Checkbox
              checked={value.length === 0}
              onCheckedChange={(checkedState: boolean | "indeterminate") => {
                if (checkedState === "indeterminate" || value.length === 0) return;
                onChange([]);
              }}
              aria-label="Select all fee types"
            />
            <span className="text-sm leading-snug">ALL FEES</span>
          </label>
        </div>
        <div className="mx-3 mt-2 border-b border-border" />
        <div className="p-3 pt-2">
          <div className="max-h-[280px] space-y-1 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground">
                {loading ? "Loading…" : "No fee types available."}
              </div>
            ) : (
              options.map((o) => (
                <label
                  key={`${o.detno}-${o.code}`}
                  className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-muted"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={value.includes(o.code)}
                    onCheckedChange={(checkedState: boolean | "indeterminate") => {
                      if (checkedState === "indeterminate") return;
                      toggle(o.code);
                    }}
                    aria-label={`Toggle ${o.label}`}
                  />
                  <span className="text-sm leading-snug">{o.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
