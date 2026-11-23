import type { LatLng } from "@/types/resourceType";

const envNearRadiusM = Number(import.meta.env?.VITE_ALLOWED_RADIUS_M ?? 0);
const envFarRadiusM = Number(import.meta.env?.VITE_FAR_RADIUS_M ?? 0);

/** Tight radius used when the "nearby only" filter is switched on. */
export const MAP_NEAR_RADIUS_M =
  Number.isFinite(envNearRadiusM) && envNearRadiusM > 0 ? Math.max(envNearRadiusM, 1000) : 1000;

/** Broader radius used by default on the dashboard map. */
export const MAP_FAR_RADIUS_M =
  Number.isFinite(envFarRadiusM) && envFarRadiusM > 0 ? Math.max(envFarRadiusM, 150000) : 150000;

/** Regional fallback center (MIMAROPA) when geolocation is unavailable. */
export const MAP_DEFAULT_CENTER: LatLng = { lat: 12.8797, lng: 121.324 };

export const MAP_DEFAULT_ZOOM = 8;
export const MAP_FOCUS_ZOOM = 13;

export const GOOGLE_MAPS_API_KEY =
  (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";
