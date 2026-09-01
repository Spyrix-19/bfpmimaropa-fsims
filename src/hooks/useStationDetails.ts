import * as React from "react";
import { stationAPI } from "@/services/stationAPI";
import { unwrap } from "@/lib/api-envelope";
import { EMPTY_GUID } from "@/lib/fsims-constants";
import type { SearchStationModel } from "@/types/stationTypes";
import { useAuth } from "@/lib/auth";

/**
 * Resolves the full station record (code, city / municipality, province, logo)
 * for a given `stationno`.
 *
 * The backend station search is text-based (station code / name), not GUID, so
 * we query with the best available search key and then pick the row whose
 * `stationno` matches. Values always fall back to the authenticated user's own
 * station scope so the Station Information card never renders empty dashes for
 * a station-scoped login.
 */
export interface UseStationDetailsOptions {
  /** Selected station GUID. `EMPTY_GUID` / empty disables the lookup. */
  stationno?: string | null;
  /** Station model already provided by a picker — skips the network lookup. */
  preloaded?: SearchStationModel | null;
  /** Optional text hint (station code or name) used as the search key. */
  searchKey?: string | null;
  /** Optional province scope for the lookup. */
  provinceno?: string | null;
  /** Set false to pause the lookup (e.g. closed dialog). */
  enabled?: boolean;
}

export interface StationDetails {
  station: SearchStationModel | null;
  loading: boolean;
  stationCode: string;
  stationName: string;
  cityName: string;
  provinceName: string;
  logoUrl: string;
}

function isRealStationNo(no?: string | null) {
  return Boolean(no) && no !== EMPTY_GUID;
}

export function useStationDetails({
  stationno,
  preloaded,
  searchKey,
  provinceno,
  enabled = true,
}: UseStationDetailsOptions): StationDetails {
  const { user } = useAuth();
  const [fetched, setFetched] = React.useState<SearchStationModel | null>(null);
  const [loading, setLoading] = React.useState(false);

  const isOwnStation = Boolean(
    user?.stationno && stationno && String(user.stationno) === String(stationno),
  );

  React.useEffect(() => {
    if (!enabled || !isRealStationNo(stationno) || preloaded) {
      setFetched(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const key =
        searchKey || (isOwnStation ? user?.stationcode || user?.stationname || "" : "") || "";
      const resp = await stationAPI.search(
        {
          searchKey: key,
          provinceno: provinceno && provinceno !== EMPTY_GUID ? provinceno : undefined,
          pageNumber: 1,
          pageSize: 50,
        },
        { suppressGlobalLoading: true },
      );
      const { ok, data } = unwrap<SearchStationModel[]>(resp);
      if (cancelled) return;
      const list = ok && Array.isArray(data) ? data : [];
      setFetched(list.find((s) => String(s.stationno) === String(stationno)) ?? list[0] ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    stationno,
    preloaded,
    searchKey,
    provinceno,
    isOwnStation,
    user?.stationcode,
    user?.stationname,
  ]);

  const station = preloaded ?? fetched;

  // Only fall back to the login's own scope when the station being displayed is
  // the login's station — otherwise we'd show the wrong city / province.
  const fallback = isOwnStation || !isRealStationNo(stationno) ? user : undefined;

  return {
    station,
    loading,
    stationCode: station?.stationcode || fallback?.stationcode || "",
    stationName: station?.stationname || fallback?.stationname || "",
    cityName: station?.cityname || fallback?.cityname || "",
    provinceName: station?.provincename || fallback?.provincename || "",
    logoUrl: station?.logourl || "",
  };
}

export default useStationDetails;
