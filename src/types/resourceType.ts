export interface LatLng {
  lat: number;
  lng: number;
}

export type ResourceKind =
  | "station"
  | "hydrant"
  | "refilling"
  | "partner"
  | "highrisk"
  | "business"
  | "hazard"
  | "critical"
  | "incident";

export interface ResourceMarker {
  lat: number;
  lng: number;
  name: string;
  kind: ResourceKind;
  color?: string;
  code?: string;
  type?: string;
  address?: string;
  status?: string;
}