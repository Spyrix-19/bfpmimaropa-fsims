import type { DashboardClass } from "@/types/dashboardType";
import type { SelectedStation } from "@/components/station-multi-select";

export interface ProvinceSelection {
  locationno: string;
}

/**
 * Builds the `Provinces` payload for the year-to-year dashboard endpoints.
 * Each entry is a province with the (optional) list of selected stations
 * under it. Provinces with no explicit station pick send an empty list,
 * which the API treats as "all stations of that province".
 */
export function buildDashboardProvinces(
  provinces: ProvinceSelection[] = [],
  stations: SelectedStation[] = [],
): DashboardClass[] {
  const map = new Map<string, string[]>();
  provinces.forEach((p) => {
    if (p.locationno) map.set(p.locationno, []);
  });
  stations.forEach((s) => {
    if (!s.provinceno || !s.stationno) return;
    const list = map.get(s.provinceno) ?? [];
    if (!list.includes(s.stationno)) list.push(s.stationno);
    map.set(s.provinceno, list);
  });
  return Array.from(map.entries()).map(([provinceno, stationnos]) => ({
    provinceno,
    stationnos,
  }));
}

/** Stable dependency key for a `Provinces` payload. */
export function provincesPayloadKey(payload: DashboardClass[]): string {
  return payload
    .map((p) => `${p.provinceno}:${[...p.stationnos].sort().join("|")}`)
    .sort()
    .join(",");
}
