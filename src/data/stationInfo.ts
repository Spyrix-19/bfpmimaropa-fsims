import type { CityMunicipalityModel } from "@/data/cityMunicipalityData";

/**
 * Derives a synthetic "station" record for a City / Municipality using the
 * centralized dummy data. Replace with a real station lookup once the
 * backend endpoint is available.
 */

export interface StationInfo {
  stationCode: string;
  stationName: string;
  logoUrl: string; // empty string when no logo — UI falls back to placeholder
  barangay: string;
  city: string;
  province: string;
  region: string;
  zipCode: string;
}

const REGION_BY_PROVINCE: Record<string, string> = {
  "Occidental Mindoro": "MIMAROPA Region",
  "Oriental Mindoro": "MIMAROPA Region",
  Marinduque: "MIMAROPA Region",
  Romblon: "MIMAROPA Region",
  Palawan: "MIMAROPA Region",
};

const ZIP_BY_PROVINCE: Record<string, string> = {
  "Occidental Mindoro": "5100",
  "Oriental Mindoro": "5200",
  Marinduque: "4900",
  Romblon: "5500",
  Palawan: "5300",
};

export function getStationInfo(city: CityMunicipalityModel): StationInfo {
  return {
    stationCode: `${city.cityMunicipalityCode}-FS`,
    stationName: `${city.cityMunicipalityName} Fire Station`,
    logoUrl: "",
    barangay: "Brgy. Poblacion",
    city: city.cityMunicipalityName,
    province: city.province,
    region: REGION_BY_PROVINCE[city.province] ?? "MIMAROPA Region",
    zipCode: ZIP_BY_PROVINCE[city.province] ?? "5100",
  };
}

export function formatCompleteAddress(info: StationInfo): string[] {
  return [info.barangay, info.city, info.province, info.region, info.zipCode];
}
