import * as React from "react";
import { unwrap } from "@/lib/api-envelope";
import { gentableAPI } from "@/services/gentableAPI";
import type { SearchGentableModel } from "@/types/gentableType";
import type { Option } from "@/components/gentable-select";

export const BUSINESS_STATUS_TABLE = "BUSINESS ESTABLISHMENT STATUS";

export function useBusinessOptions(tablename: string) {
  const [options, setOptions] = React.useState<Option<number>[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await gentableAPI.search(
          { tablename, searchKey: "", pageNumber: 1, pageSize: 200 },
          { suppressGlobalLoading: true, suppressErrorToast: true },
        );
        const { ok, data } = unwrap<SearchGentableModel[]>(resp);
        if (!cancelled) {
          setOptions((ok && Array.isArray(data) ? data : [])
            .filter((r) => Number(r.detno) > 0 && String(r.description ?? "").trim())
            .map((r) => ({ value: Number(r.detno), label: String(r.description).trim() })));
        }
      } catch {
        if (!cancelled) setOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [tablename]);
  return options;
}
