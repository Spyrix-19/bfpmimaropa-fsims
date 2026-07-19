/**
 * FSIS Inventory service facade.
 *
 * Every UI screen consumes THIS module — never the mock store directly.
 * Method signatures, DTOs, and envelope shape mirror how the real backend
 * will be called via `apiGet` / `apiPost`. When the endpoints go live,
 * swap the internals of each method to `await apiPost(...)` and the UI
 * layer will not require any changes.
 */
import type {
  DailyInventoryDTO,
  DailyInventoryUpsertDTO,
  InventoryCategory,
  InventorySearchParams,
  MatrixProvinceGroup,
  MockApiResponse,
  MonthlyInventoryRow,
} from "@/types/inventoryType";
import { inventoryStore } from "@/mock/inventoryMock";
import {
  buildMatrix,
  buildReportMatrix,
  breakdownFor,
  bucketFor,
  calendarDaysInMonth,
  daysEncoded,
  groupByStationMonth,
  isSameMonth,
  parseISODate,
  type ReportMatrixProvinceGroup,
} from "@/lib/inventoryHelpers";

function ok<T>(data: T, total = 0): MockApiResponse<T> {
  const arrTotal = Array.isArray(data) ? (data as unknown as unknown[]).length : total;
  return {
    data: {
      statusCode: 200,
      isSuccess: true,
      errorMessages: "",
      draw: 0,
      recordsTotal: arrTotal,
      recordsFiltered: arrTotal,
      pageNumber: 1,
      pageSize: arrTotal,
      totalPages: 1,
      data,
    },
  };
}

function fail<T>(message: string): MockApiResponse<T> {
  return {
    data: {
      statusCode: 400,
      isSuccess: false,
      errorMessages: message,
      draw: 0,
      recordsTotal: 0,
      recordsFiltered: 0,
      pageNumber: 1,
      pageSize: 0,
      totalPages: 0,
      data: null as unknown as T,
    },
  };
}

/** Fake network latency so React Query / toasts behave realistically. */
function delay<T>(payload: T, ms = 120): Promise<T> {
  return new Promise((res) => setTimeout(() => res(payload), ms));
}

function matchesFilters(
  row: DailyInventoryDTO,
  { year, month, provinceno, stationno, searchkey }: InventorySearchParams,
): boolean {
  if (row.deletedat) return false;
  const p = parseISODate(row.dateinspected);
  if (p.year !== year) return false;
  if (month && p.month !== month) return false;
  if (provinceno && row.provinceno !== provinceno) return false;
  if (stationno && row.stationno !== stationno) return false;
  if (searchkey) {
    const q = searchkey.trim().toLowerCase();
    if (!q) return true;
    const hay =
      `${row.stationname} ${row.stationcode} ${row.provincename} ${row.cityname}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const inventoryAPI = {
  /** Ledger — one row per (station, year, month) with computed totals. */
  async searchMonthlyInventory(params: InventorySearchParams) {
    const filtered = inventoryStore.live().filter((r) => matchesFilters(r, params));
    const groups = groupByStationMonth(filtered);
    const rows: MonthlyInventoryRow[] = [];
    groups.forEach((daily, key) => {
      const [stationno, y, m] = key.split("|");
      const year = Number(y),
        month = Number(m);
      const sample = daily[0];
      const latest =
        daily
          .map((r) => r.lastupdated)
          .sort()
          .slice(-1)[0] ?? "";
      rows.push({
        key,
        stationno,
        stationcode: sample.stationcode,
        stationname: sample.stationname,
        provinceno: sample.provinceno,
        provincename: sample.provincename,
        cityname: sample.cityname,
        year,
        month,
        daysEncoded: daysEncoded(daily),
        daysInMonth: calendarDaysInMonth(year, month),
        totals: bucketFor(daily),
        breakdown: breakdownFor(daily),
        lastupdated: latest,
      });
    });
    rows.sort(
      (a, b) =>
        b.year - a.year ||
        b.month - a.month ||
        a.provincename.localeCompare(b.provincename) ||
        a.stationname.localeCompare(b.stationname),
    );
    return delay(ok(rows));
  },

  /** Every daily record for one (station, year, month) — soft-deleted excluded. */
  async getMonthlyInventory(stationno: string, year: number, month: number) {
    const rows = inventoryStore
      .live()
      .filter((r) => r.stationno === stationno && isSameMonth(r.dateinspected, year, month))
      .sort((a, b) => a.dateinspected.localeCompare(b.dateinspected));
    return delay(ok(rows));
  },

  /** Single daily record — used by the Daily Add duplicate guard. */
  async getDailyInventory(stationno: string, dateinspected: string) {
    const row = inventoryStore.findDaily(stationno, dateinspected);
    return delay(ok(row ?? null));
  },

  /** Insert one daily record. Rejects when (station, date) already exists. */
  async saveDailyInventory(dto: DailyInventoryUpsertDTO) {
    const existing = inventoryStore.findDaily(dto.stationno, dto.dateinspected);
    if (existing) {
      return delay(
        fail<DailyInventoryDTO>("Inventory for this date already exists. Please use Edit instead."),
      );
    }
    const inventoryno = `${dto.stationno}-${dto.dateinspected.replace(/-/g, "")}`;
    const row: DailyInventoryDTO = {
      ...dto,
      inventoryno,
      lastupdated: new Date().toISOString(),
      deletedat: null,
    };
    inventoryStore.insert(row);
    return delay(ok<DailyInventoryDTO>(row));
  },

  /** UPSERT every daily row of a (station, month, year) — used by the Excel-style editor. */
  async updateMonthlyInventory(
    stationno: string,
    year: number,
    month: number,
    rows: DailyInventoryUpsertDTO[],
  ) {
    const now = new Date().toISOString();
    for (const dto of rows) {
      const existing = inventoryStore.findDaily(dto.stationno, dto.dateinspected);
      const inventoryno =
        existing?.inventoryno ?? `${dto.stationno}-${dto.dateinspected.replace(/-/g, "")}`;
      inventoryStore.update({
        ...dto,
        inventoryno,
        lastupdated: now,
        deletedat: null,
      });
    }
    // Return the freshly-saved month so callers can refresh their view.
    const persisted = inventoryStore
      .live()
      .filter((r) => r.stationno === stationno && isSameMonth(r.dateinspected, year, month));
    return delay(ok(persisted));
  },

  /** Soft-delete every non-deleted daily row for (station, year, month). */
  async deleteMonthlyInventory(stationno: string, year: number, month: number) {
    const at = new Date().toISOString();
    const n = inventoryStore.softDeleteMonth(stationno, year, month, at);
    return delay(ok({ deleted: n }));
  },

  /** Matrix — full filtered dataset grouped into province → station × months. */
  async getInventoryMatrix(params: InventorySearchParams, category: InventoryCategory) {
    const rows = inventoryStore.live().filter((r) => matchesFilters(r, params));
    const groups: MatrixProvinceGroup[] = buildMatrix(rows, category);
    return delay(ok(groups));
  },

  /**
   * Report Matrix — same shape as `getInventoryMatrix` but every field cell
   * carries { target, actual }. Consumed by Reports → Matrix Report.
   * Sourced from the centralized inventory mock — no live API calls.
   */
  async getInventoryReportMatrix(params: InventorySearchParams, category: InventoryCategory) {
    const rows = inventoryStore.live().filter((r) => matchesFilters(r, params));
    const groups: ReportMatrixProvinceGroup[] = buildReportMatrix(rows, category);
    return delay(ok(groups));
  },
};
