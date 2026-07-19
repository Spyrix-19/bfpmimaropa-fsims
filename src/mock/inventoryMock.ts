/**
 * Centralized mock data source for FSIS Inventory.
 *
 * ⚠️ Single source of truth. Every screen (Ledger, Daily Add, Monthly Edit,
 * Monthly View, Matrix, Export, Summary Cards, Drill-down) reads / mutates
 * this store through `inventoryAPI`. No component imports this file directly.
 *
 * When the backend becomes available, only `src/services/inventoryAPI.ts`
 * changes — this file is retired without touching any UI.
 */
import type { DailyInventoryDTO } from "@/types/inventoryType";
import { calendarDaysInMonth, parseISODate } from "@/lib/inventoryHelpers";

interface StationSeed {
  stationno: string;
  stationcode: string;
  stationname: string;
  cityno: string;
  cityname: string;
  provinceno: string;
  provincename: string;
}

const STATIONS: StationSeed[] = [
  // Occidental Mindoro
  { stationno: "OCM-SANJ-FS", stationcode: "SANJ-FS", stationname: "San Jose Fire Station",
    cityno: "OCM-10", cityname: "San Jose",
    provinceno: "OCM", provincename: "Occidental Mindoro" },
  { stationno: "OCM-MAMB-FS", stationcode: "MAMB-FS", stationname: "Mamburao Fire Station",
    cityno: "OCM-06", cityname: "Mamburao",
    provinceno: "OCM", provincename: "Occidental Mindoro" },
  { stationno: "OCM-SABL-FS", stationcode: "SABL-FS", stationname: "Sablayan Fire Station",
    cityno: "OCM-09", cityname: "Sablayan",
    provinceno: "OCM", provincename: "Occidental Mindoro" },

  // Oriental Mindoro
  { stationno: "ORM-CALA-FS", stationcode: "CALA-FS", stationname: "Calapan Fire Station",
    cityno: "ORM-04", cityname: "Calapan City",
    provinceno: "ORM", provincename: "Oriental Mindoro" },
  { stationno: "ORM-PINA-FS", stationcode: "PINA-FS", stationname: "Pinamalayan Fire Station",
    cityno: "ORM-07", cityname: "Pinamalayan",
    provinceno: "ORM", provincename: "Oriental Mindoro" },
  { stationno: "ORM-NAUJ-FS", stationcode: "NAUJ-FS", stationname: "Naujan Fire Station",
    cityno: "ORM-06", cityname: "Naujan",
    provinceno: "ORM", provincename: "Oriental Mindoro" },

  // Marinduque
  { stationno: "MRQ-BOAC-FS", stationcode: "BOAC-FS", stationname: "Boac Fire Station",
    cityno: "MRQ-01", cityname: "Boac",
    provinceno: "MRQ", provincename: "Marinduque" },
  { stationno: "MRQ-STCM-FS", stationcode: "STCM-FS", stationname: "Santa Cruz Fire Station",
    cityno: "MRQ-05", cityname: "Santa Cruz (Mrq)",
    provinceno: "MRQ", provincename: "Marinduque" },

  // Romblon
  { stationno: "ROM-ODIO-FS", stationcode: "ODIO-FS", stationname: "Odiongan Fire Station",
    cityno: "ROM-01", cityname: "Odiongan",
    provinceno: "ROM", provincename: "Romblon" },
  { stationno: "ROM-ROMC-FS", stationcode: "ROMC-FS", stationname: "Romblon Fire Station",
    cityno: "ROM-02", cityname: "Romblon",
    provinceno: "ROM", provincename: "Romblon" },

  // Palawan
  { stationno: "PLW-PPCC-FS", stationcode: "PPCC-FS", stationname: "Puerto Princesa Fire Station",
    cityno: "PLW-01", cityname: "Puerto Princesa City",
    provinceno: "PLW", provincename: "Palawan" },
  { stationno: "PLW-CORN-FS", stationcode: "CORN-FS", stationname: "Coron Fire Station",
    cityno: "PLW-02", cityname: "Coron",
    provinceno: "PLW", provincename: "Palawan" },
];

export const INVENTORY_STATIONS: readonly StationSeed[] = STATIONS;

// --- Deterministic pseudo-random helpers -----------------------------------
// Using seeded RNG keeps the mock stable between reloads (same values each
// time the app loads). Nothing depends on true randomness.
function seededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

interface DayCoverage {
  /** 1.0 = every day encoded, 0.5 = every other day, 0.2 = sparse. */
  fraction: number;
  /** Optional "hot" bias: whether to skip certain weekdays. */
  skipWeekends?: boolean;
}

/** Coverage profile per (station, year, month). Missing entries → no data. */
function coverageFor(stationIdx: number, year: number, month: number): DayCoverage | null {
  // Provide realistic mix: full months, partial, sparse, or empty.
  const key = (stationIdx * 31 + month + year * 12) % 10;
  if (year !== CURRENT_YEAR && year !== CURRENT_YEAR - 1) return null;
  if (year === CURRENT_YEAR && month > CURRENT_MONTH) return null;
  switch (key) {
    case 0: return { fraction: 1.0 };
    case 1: return { fraction: 0.9, skipWeekends: true };
    case 2: return { fraction: 0.5 };
    case 3: return { fraction: 0.2 };
    case 4: return { fraction: 0.75 };
    case 5: return { fraction: 1.0, skipWeekends: true };
    case 6: return null;
    case 7: return { fraction: 0.4 };
    case 8: return { fraction: 0.6 };
    default: return { fraction: 0.85 };
  }
}

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1;

function seedDaily(stationIdx: number, year: number, month: number, day: number): DailyInventoryDTO {
  const st = STATIONS[stationIdx];
  const rng = seededRng(stationIdx * 100000 + year * 400 + month * 32 + day);
  return {
    inventoryno: `${st.stationno}-${year}${pad2(month)}${pad2(day)}`,
    stationno: st.stationno,
    stationcode: st.stationcode,
    stationname: st.stationname,
    cityno: st.cityno,
    cityname: st.cityname,
    provinceno: st.provinceno,
    provincename: st.provincename,
    dateinspected: isoDate(year, month, day),

    insp_during: randInt(rng, 0, 4),
    insp_after: randInt(rng, 0, 3),
    insp_bplo: randInt(rng, 0, 12),
    insp_gov: randInt(rng, 0, 3),
    insp_peza: randInt(rng, 0, 1),
    insp_tieza: randInt(rng, 0, 1),

    fsec_building: randInt(rng, 0, 5),
    fsec_gov: randInt(rng, 0, 2),
    fsec_peza: randInt(rng, 0, 1),
    fsec_tieza: randInt(rng, 0, 1),

    fsic_occupancy: randInt(rng, 0, 3),
    fsic_bplo_new: randInt(rng, 0, 4),
    fsic_bplo_renewal: randInt(rng, 0, 8),
    fsic_gov: randInt(rng, 0, 2),
    fsic_peza: randInt(rng, 0, 1),
    fsic_tieza: randInt(rng, 0, 1),

    not_nod: randInt(rng, 0, 2),
    not_ntc: randInt(rng, 0, 2),
    not_ntcv: randInt(rng, 0, 1),
    not_abatement: randInt(rng, 0, 1),
    not_closure: randInt(rng, 0, 1),

    remarks: "",
    encodedby: "seed",
    encodedbyname: "Seed",
    lastupdated: new Date(year, month - 1, day, 17, 0).toISOString(),
    deletedat: null,
  };
}

function buildSeedData(): DailyInventoryDTO[] {
  const rows: DailyInventoryDTO[] = [];
  const years = [CURRENT_YEAR - 1, CURRENT_YEAR];
  for (let s = 0; s < STATIONS.length; s++) {
    for (const y of years) {
      const maxMonth = y === CURRENT_YEAR ? CURRENT_MONTH : 12;
      for (let m = 1; m <= maxMonth; m++) {
        const cov = coverageFor(s, y, m);
        if (!cov) continue;
        const days = calendarDaysInMonth(y, m);
        const skipRng = seededRng(s * 7919 + y * 53 + m);
        for (let d = 1; d <= days; d++) {
          if (skipRng() > cov.fraction) continue;
          if (cov.skipWeekends) {
            const w = new Date(y, m - 1, d).getDay();
            if (w === 0 || w === 6) continue;
          }
          rows.push(seedDaily(s, y, m, d));
        }
      }
    }
  }
  return rows;
}

/**
 * In-memory store. Simulates persistence for the current session; refreshes
 * back to seed data on page reload. This is intentional — the eventual
 * backend replaces this with real HTTP calls.
 */
class InventoryMockStore {
  private rows: DailyInventoryDTO[] = buildSeedData();

  all(): DailyInventoryDTO[] {
    return this.rows;
  }

  live(): DailyInventoryDTO[] {
    return this.rows.filter((r) => !r.deletedat);
  }

  findDaily(stationno: string, dateinspected: string): DailyInventoryDTO | undefined {
    return this.rows.find(
      (r) => r.stationno === stationno && r.dateinspected === dateinspected && !r.deletedat,
    );
  }

  insert(row: DailyInventoryDTO): void {
    this.rows.push(row);
  }

  update(row: DailyInventoryDTO): void {
    const idx = this.rows.findIndex((r) => r.inventoryno === row.inventoryno);
    if (idx >= 0) this.rows[idx] = row;
    else this.rows.push(row);
  }

  softDeleteMonth(stationno: string, year: number, month: number, at: string): number {
    let n = 0;
    for (const r of this.rows) {
      if (r.deletedat) continue;
      if (r.stationno !== stationno) continue;
      const p = parseISODate(r.dateinspected);
      if (p.year === year && p.month === month) {
        r.deletedat = at;
        n++;
      }
    }
    return n;
  }

  resolveStation(stationno: string): StationSeed | undefined {
    return STATIONS.find((s) => s.stationno === stationno);
  }
}

export const inventoryStore = new InventoryMockStore();