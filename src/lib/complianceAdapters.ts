/**
 * Adapters that translate the FSISCompliance API payloads (station wrapper +
 * `compliancelist` with a nested `issuancelist`) into the flat, per-day shapes
 * the compliance ledger / matrix / edit / view screens already render.
 *
 * These exist so the UI layer keeps its current data contracts while all
 * network calls go through `complianceAPI` (the legacy FSISInventory endpoints
 * are gone).
 */
import type {
  FSISComplianceClassModel,
  FSISComplianceDetailClassModel,
  FSISComplianceDetailModel,
  FSISComplianceModel,
  FSISComplianceDailyClass,
  FSISComplianceMonthlyLedgerModel,
  FSISIssuanceClassModel,
  TargetAccomplishmentModel,
} from "@/types/complianceType";

export const ISSUANCE_COUNT_KEYS = [
  "fsecbuildingcount",
  "fsecgovcount",
  "fsecpezacount",
  "fsectiezacount",
  "fsicoccupancycount",
  "fsicbplonewcount",
  "fsicbplorenewcount",
  "fsicgovcount",
  "fsicpezacount",
  "fsictiezacount",
  "nodcount",
  "ntccount",
  "ntcvcount",
  "abatementcount",
  "closurecount",
] as const;

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Sums every issuance mode (MANUAL 96 + FSIS 97) into one flat bucket. */
export function sumIssuances(
  list: readonly Partial<FSISIssuanceClassModel>[] | null | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ISSUANCE_COUNT_KEYS) out[k] = 0;
  for (const iss of Array.isArray(list) ? list : []) {
    for (const k of ISSUANCE_COUNT_KEYS) out[k] += n((iss as Record<string, unknown>)?.[k]);
  }
  return out;
}

/** Loose record shape accepted from either the Ledger or the Detail payload. */
export type AnyComplianceRecord = {
  fsisno?: string;
  dateinspected?: string | Date;
  remarks?: string | null;
  inspectduringcount?: number;
  inspectaftercount?: number;
  inspectbplocount?: number;
  inspectgovcount?: number;
  inspectpezacount?: number;
  inspecttiezacount?: number;
  dailytargetbplo?: number;
  dailytargetgov?: number;
  dailytargetpeza?: number;
  dailytargettieza?: number;
  isrevisionrequest?: boolean;
  editablestatus?: number;
  issuancelist?: Partial<FSISIssuanceClassModel>[];
};

/**
 * One compliance day record → the flat daily row shape (inspection counts +
 * summed issuance counts) while preserving the per-mode `issuancelist`.
 */
export function toDailyRow(
  rec: AnyComplianceRecord,
): FSISComplianceDailyClass & Partial<FSISIssuanceClassModel> {
  const issuancelist = Array.isArray(rec?.issuancelist) ? rec.issuancelist : [];
  return {
    fsisno: String(rec?.fsisno ?? ""),
    inspectduringcount: n(rec?.inspectduringcount),
    inspectaftercount: n(rec?.inspectaftercount),
    inspectbplocount: n(rec?.inspectbplocount),
    inspectgovcount: n(rec?.inspectgovcount),
    inspectpezacount: n(rec?.inspectpezacount),
    inspecttiezacount: n(rec?.inspecttiezacount),
    dailytargetbplo: n(rec?.dailytargetbplo),
    dailytargetgov: n(rec?.dailytargetgov),
    dailytargetpeza: n(rec?.dailytargetpeza),
    dailytargettieza: n(rec?.dailytargettieza),
    isrevisionrequest: Boolean(rec?.isrevisionrequest),
    editablestatus: n(rec?.editablestatus),
    remarks: String(rec?.remarks ?? ""),
    dateinspected: rec?.dateinspected ?? "",
    issuancelist: issuancelist as FSISIssuanceClassModel[],
    ...(sumIssuances(issuancelist) as unknown as Partial<FSISIssuanceClassModel>),
  };
}

export type AnyComplianceStation = {
  stationno?: string;
  stationcode?: string;
  stationname?: string;
  provinceno?: string;
  provincename?: string;
  logourl?: string;
  cityname?: string;
  dailytargetbplo?: number;
  dailytargetgov?: number;
  dailytargetpeza?: number;
  dailytargettieza?: number;
  compliancelist?: AnyComplianceRecord[];
};

/**
 * Station wrapper (Ledger or Detail) → the monthly ledger model the compliance
 * screens consume, with `fsisInventoryLedgerList` populated from
 * `compliancelist`.
 */
export function toMonthlyLedgerModel(
  station: AnyComplianceStation,
  year: number,
  month: number,
): FSISComplianceMonthlyLedgerModel {
  const pick = (recVal: unknown, stationVal: unknown) =>
    recVal === undefined || recVal === null ? stationVal : recVal;

  const daily = (Array.isArray(station?.compliancelist) ? station.compliancelist : []).map(
    (rec) =>
      toDailyRow({
        ...rec,
        // Ledger payloads carry dailytarget* on each record; Detail payloads
        // carry them on the station wrapper. Prefer the record's own values.
        dailytargetbplo: pick(rec?.dailytargetbplo, station.dailytargetbplo) as number,
        dailytargetgov: pick(rec?.dailytargetgov, station.dailytargetgov) as number,
        dailytargetpeza: pick(rec?.dailytargetpeza, station.dailytargetpeza) as number,
        dailytargettieza: pick(rec?.dailytargettieza, station.dailytargettieza) as number,
      }),
  );


  const sum = (key: keyof FSISComplianceDailyClass) =>
    daily.reduce((acc, d) => acc + n(d[key]), 0);

  return {
    stationno: String(station?.stationno ?? ""),
    stationcode: String(station?.stationcode ?? ""),
    stationname: String(station?.stationname ?? ""),

    regionno: "",
    regioncode: "",
    regionname: "",

    provinceno: String(station?.provinceno ?? ""),
    provincename: String(station?.provincename ?? ""),

    cityno: "",
    zipcode: "",
    cityname: String(station?.cityname ?? ""),

    barangayno: "",
    barangayname: "",

    streetaddress: "",
    logourl: String(station?.logourl ?? ""),

    month,
    year,

    totaltargetbplo: sum("dailytargetbplo"),
    totaltargetgov: sum("dailytargetgov"),
    totaltargetpeza: sum("dailytargetpeza"),
    totaltargettieza: sum("dailytargettieza"),

    totalAccomplishmentbplo: sum("inspectbplocount"),
    totalAccomplishmentgov: sum("inspectgovcount"),
    totalAccomplishmentpeza: sum("inspectpezacount"),
    totalAccomplishmenttieza: sum("inspecttiezacount"),

    updatedby: "",
    encodedby: "",

    fsisInventoryLedgerList: daily,
  };
}

/** Derives the monthly Target vs. Accomplishment summary from a Detail payload. */
export function toTargetAccomplishment(
  station: AnyComplianceStation,
  year: number,
  month: number,
): TargetAccomplishmentModel {
  const m = toMonthlyLedgerModel(station, year, month);
  return {
    stationno: m.stationno,
    month,
    year,
    totaltargetbplo: m.totaltargetbplo,
    totaltargetgov: m.totaltargetgov,
    totaltargetpeza: m.totaltargetpeza,
    totaltargettieza: m.totaltargettieza,
    totalAccomplishmentbplo: m.totalAccomplishmentbplo,
    totalAccomplishmentgov: m.totalAccomplishmentgov,
    totalAccomplishmentpeza: m.totalAccomplishmentpeza,
    totalAccomplishmenttieza: m.totalAccomplishmenttieza,
  };
}

/** Month (1-12) of a compliance record's `dateinspected`, or null. */
export function monthOfRecord(dateinspected: unknown): number | null {
  const raw = String(dateinspected ?? "").trim();
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw);
  if (iso) return Number(iso[2]) || null;
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(raw);
  if (slash) return Number(slash[1]) || null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getMonth() + 1;
}
