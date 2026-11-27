import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  GOOGLE_MAPS_API_KEY,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_FOCUS_ZOOM,
} from "@/config/map";
import type { LatLng, ResourceKind, ResourceMarker } from "@/types/resourceType";
import type {
  EvacuationGISModel,
  HydrantGISModel,
  PartnerAgencyGISModel,
  StationGISModel,
} from "@/types/dashboardType";

export type GoogleMapClickEvent = {
  latLng?: {
    lat: () => number;
    lng: () => number;
  } | null;
};

export type GoogleMapInstance = {
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
  addListener?: (event: string, handler: (e?: GoogleMapClickEvent) => void) => void;
};

export type GoogleMarkerInstance = {
  setMap: (map: GoogleMapInstance | null) => void;
  addListener: (event: string, handler: (e?: GoogleMapClickEvent) => void) => void;
  setPosition?: (pos: LatLng) => void;
  getPosition?: () => { lat: () => number; lng: () => number } | null;
};

type GoogleInfoWindowInstance = {
  setContent: (content: string) => void;
  open: (opts: { map: GoogleMapInstance; anchor: GoogleMarkerInstance }) => void;
};

type GoogleMaps = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (opts: Record<string, unknown>) => GoogleMarkerInstance;
  InfoWindow: new () => GoogleInfoWindowInstance;
  Point: new (x: number, y: number) => unknown;
  SymbolPath: { CIRCLE: number; [key: string]: number };
};

declare global {
  interface Window {
    google?: { maps: GoogleMaps };
  }
}

const MARKER_COLOR: Record<ResourceKind, string> = {
  station: "#2563EB",
  hydrant: "#0EA5E9",
  refilling: "#F97316",
  partner: "#16A34A",
  highrisk: "#DC2626",
  business: "#0891B2",
  hazard: "#EAB308",
  critical: "#7C3AED",
  incident: "#991B1B",
};

const HYDRANT_COLOR_BY_CODE: Record<string, string> = {
  green: "#16A34A",
  red: "#DC2626",
  white: "#F8FAFC",
  blue: "#2563EB",
  yellow: "#FACC15",
  orange: "#EA580C",
  black: "#0F172A",
  purple: "#7C3AED",
  violet: "#7C3AED",
  gray: "#94A3B8",
  grey: "#94A3B8",
  silver: "#CBD5E1",
  unpainted: "#CBD5E1",
  lightblue: "#7DD3FC",
  "light blue": "#7DD3FC",
};

const hydrantMarkerColor = (hydrant: HydrantGISModel): string => {
  const direct = (hydrant.colorcode ?? "").trim().toLowerCase();
  if (direct) {
    return HYDRANT_COLOR_BY_CODE[direct] ?? HYDRANT_COLOR_BY_CODE[direct.replace(/\s+/g, "")] ?? MARKER_COLOR.hydrant;
  }

  const colorNo = Number(hydrant.colorno);
  if (Number.isFinite(colorNo)) {
    switch (colorNo) {
      case 1:
        return "#16A34A";
      case 2:
        return "#DC2626";
      case 3:
        return "#F8FAFC";
      case 4:
        return "#2563EB";
      case 5:
        return "#FACC15";
      case 6:
        return "#EA580C";
      case 7:
        return "#0F172A";
      case 8:
        return "#7C3AED";
      case 9:
        return "#94A3B8";
      case 10:
        return "#CBD5E1";
      case 11:
        return "#7DD3FC";
      default:
        return MARKER_COLOR.hydrant;
    }
  }

  return MARKER_COLOR.hydrant;
};

/** Initials fallback, mirroring AvatarWithFallback's getInitials behavior. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * InfoWindow header that mirrors AvatarWithFallback: the logo image sits on
 * top of an initials fallback; if the image fails to load it hides itself,
 * leaving the initials visible — same as the Radix Avatar behavior.
 */
function popupHeader(name: string, code: string, logourl?: string | null): string {
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(code);
  const initials = escapeHtml(initialsOf(name));
  const src = (logourl ?? "").trim();
  const img = src
    ? `<img src="${escapeHtml(src)}" alt="${safeName}" onerror="this.style.display='none'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:9999px;"/>`
    : "";
  return `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="position:relative;width:40px;height:40px;flex:none;border-radius:9999px;background:#F1F5F9;color:#475569;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;overflow:hidden;">
        ${initials}${img}
      </div>
      <div style="min-width:0;">
        <div style="font-weight:600;font-size:13px;color:#0F172A;line-height:1.3;">${safeName}</div>
        <div style="font-size:12px;color:#64748B;">${safeCode}</div>
      </div>
    </div>`;
}

/**
 * Contact / email rows shown under the popup header. Empty values are skipped
 * so the popup stays compact when a record has no contact details.
 */
function popupContactRows(
  contacts: (string | null | undefined)[],
  emails: (string | null | undefined)[],
): string {
  const rows = [
    ...contacts.map((v, i) => ({ label: `Contact No. ${i + 1}`, value: (v ?? "").trim() })),
    ...emails.map((v, i) => ({ label: `Email Address ${i + 1}`, value: (v ?? "").trim() })),
  ].filter((r) => r.value);
  if (!rows.length) return "";
  return `
    <div style="margin-top:8px;border-top:1px solid #E2E8F0;padding-top:6px;display:grid;gap:4px;">
      ${rows
        .map(
          (r) => `
        <div style="min-width:0;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748B;">${r.label}</div>
          <div style="font-size:12px;font-weight:500;color:#0F172A;word-break:break-word;">${escapeHtml(r.value)}</div>
        </div>`,
        )
        .join("")}
    </div>`;
}

/** Generic label/value rows for popups; empty values are skipped. */
function popupRows(rows: { label: string; value: string }[]): string {
  const filled = rows.filter((r) => r.value.trim());
  if (!filled.length) return "";
  return `
    <div style="margin-top:8px;border-top:1px solid #E2E8F0;padding-top:6px;display:grid;gap:4px;">
      ${filled
        .map(
          (r) => `
        <div style="min-width:0;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#64748B;">${r.label}</div>
          <div style="font-size:12px;font-weight:500;color:#0F172A;word-break:break-word;">${escapeHtml(r.value)}</div>
        </div>`,
        )
        .join("")}
    </div>`;
}

/**
 * Compact two-column detail card shared by stations, evacuation centers and
 * partner agencies — same layout as the hydrant popup so all markers feel
 * consistent and fit without scrolling on large screens.
 */
function detailPopup(
  name: string,
  code: string,
  logourl: string | null | undefined,
  cells: { label: string; value: string }[],
  contacts: (string | null | undefined)[],
  emails: (string | null | undefined)[],
): string {
  const filled = cells.filter((c) => c.value.trim());
  const grid = filled
    .map(
      (c) => `
      <div style="background:#F8FAFC;border:1px solid #EEF2F6;border-radius:8px;padding:6px 8px;min-width:0;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748B;">${c.label}</div>
        <div style="font-size:12.5px;font-weight:600;color:#0F172A;word-break:break-word;">${escapeHtml(c.value)}</div>
      </div>`,
    )
    .join("");
  return `<!--wide--><div style="width:300px;max-width:80vw;font-size:12px;line-height:1.4;">
    ${popupHeader(name, code, logourl)}
    ${grid ? `<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">${grid}</div>` : ""}
    ${popupContactRows(contacts, emails)}
  </div>`;
}

/** Compact two-column hydrant card — fits without scrolling on large screens. */
function hydrantPopup(h: HydrantGISModel): string {
  const v = (x: unknown) => (x === null || x === undefined ? "" : String(x).trim());
  const status = v(h.statuscode);
  const ok = /operational|active|good/i.test(status);
  const badge = status
    ? `<span style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;background:${ok ? "#DCFCE7" : "#FEE2E2"};color:${ok ? "#166534" : "#991B1B"};"><span style="width:6px;height:6px;border-radius:9999px;background:${ok ? "#16A34A" : "#DC2626"};"></span>${escapeHtml(status)}</span>`
    : "";
  const cells = [
    { label: "Type", value: v(h.typecode) },
    { label: "Color", value: v(h.colorcode) },
    { label: "Water Source", value: v(h.watersource) },
    { label: "Distribution", value: v(h.distribution) },
    { label: "Flow Rate (LPM)", value: v(h.hydrantflowrate) },
    { label: "Flow Rate (GPM)", value: v(h.hydrantflowrate2) },
    { label: "Residual Pressure", value: v(h.residualpressure) },
    { label: "Land Area", value: v(h.landarea) },
  ].filter((c) => c.value);
  const grid = cells
    .map(
      (c) => `
      <div style="background:#F8FAFC;border:1px solid #EEF2F6;border-radius:8px;padding:6px 8px;min-width:0;">
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748B;">${c.label}</div>
        <div style="font-size:12.5px;font-weight:600;color:#0F172A;word-break:break-word;">${escapeHtml(c.value)}</div>
      </div>`,
    )
    .join("");
  return `<!--wide--><div style="width:300px;max-width:80vw;font-size:12px;line-height:1.4;">
    ${popupHeader(h.hydrantname, h.hydrantcode, h.logourl)}
    ${badge ? `<div style="margin-top:8px;">${badge}</div>` : ""}
    ${grid ? `<div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:6px;">${grid}</div>` : ""}
  </div>`;
}

let loaderPromise: Promise<void> | null = null;

/** Load the Google Maps JS API once per page. */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the map."));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function pinIcon(color: string, emphasized = false) {
  if (emphasized) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="64" viewBox="0 0 54 64"><defs><filter id="s" x="-30%" y="-20%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#0F172A" flood-opacity=".48"/></filter></defs><g filter="url(#s)"><path d="M27 3C15.4 3 6 12.4 6 24c0 15.7 21 36 21 36s21-20.3 21-36C48 12.4 38.6 3 27 3Z" fill="${color}" stroke="#FFFFFF" stroke-width="5"/><path d="M27 3C15.4 3 6 12.4 6 24c0 15.7 21 36 21 36s21-20.3 21-36C48 12.4 38.6 3 27 3Z" fill="none" stroke="#0F172A" stroke-width="1.5"/><circle cx="27" cy="24" r="9" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/><circle cx="27" cy="24" r="3.5" fill="${color}"/></g></svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      scaledSize: { width: 54, height: 64 },
      anchor: { x: 27, y: 60 },
    };
  }

  const maps = window.google?.maps;
  if (!maps) return undefined;
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#FFFFFF",
    strokeWeight: 1.5,
    scale: 1.4,
    anchor: new maps.Point(12, 22),
  };
}

interface GoogleMapViewProps {
  markers?: ResourceMarker[];
  stations?: StationGISModel[];
  hydrants?: HydrantGISModel[];
  evacuations?: EvacuationGISModel[];
  partners?: PartnerAgencyGISModel[];
  currentLocation?: LatLng | null;
  recenter?: number;
  className?: string;
}

/**
 * Thin Google Maps wrapper for the dashboard. Markers are re-created whenever
 * the dataset changes; the map instance itself is created once.
 */
export default function GoogleMapView({
  markers = [],
  stations = [],
  hydrants = [],
  evacuations = [],
  partners = [],
  currentLocation,
  recenter = 0,
  className = "",
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRefs = useRef<GoogleMarkerInstance[]>([]);
  const currentLocationMarkerRefs = useRef<GoogleMarkerInstance[]>([]);
  const infoRef = useRef<GoogleInfoWindowInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const center = useMemo(() => currentLocation ?? MAP_DEFAULT_CENTER, [currentLocation]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setError("Map key is not configured.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const maps = window.google?.maps;
        if (!maps) return;
        mapRef.current = new maps.Map(containerRef.current, {
          center,
          zoom: currentLocation ? MAP_FOCUS_ZOOM : MAP_DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new maps.InfoWindow();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("Unable to load the map right now.");
      });
    return () => {
      cancelled = true;
    };
    // Map instance is created once; center changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Plot markers
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;

    markerRefs.current.forEach((m) => m.setMap(null));

    const plot = (position: LatLng, title: string, color: string, html: string) => {
      const marker = new maps.Marker({ position, map: mapRef.current, title, icon: pinIcon(color) });
      marker.addListener("click", () => {
        infoRef.current?.setContent(
          html.startsWith("<!--wide-->")
            ? html
            : `<div style="max-width:220px;font-size:12px;line-height:1.4">${html}</div>`,
        );
        const map = mapRef.current;
        if (map) infoRef.current?.open({ map, anchor: marker });
      });
      return marker;
    };

    // Each DashboardGIS dataset is plotted from its own model fields only.
    const stationPins = stations.map((s) =>
      plot(
        { lat: s.latitude + 0.00045, lng: s.longitude + 0.00045 },
        s.stationname,
        MARKER_COLOR.station,
        detailPopup(s.stationname, s.stationcode, s.logourl, [], [s.contact1, s.contact2], [s.emailaddress1, s.emailaddress2]),
      ),
    );
    // Hydrants are plotted straight from HydrantGISModel — its own fields only.
    const hydrantPins = hydrants.map((h) =>
      plot(
        { lat: h.latitude, lng: h.longitude },
        h.hydrantname,
        hydrantMarkerColor(h),
        hydrantPopup(h),
      ),
    );
    const evacuationPins = evacuations.map((e) =>
      plot(
        { lat: e.latitude, lng: e.longitude },
        e.evacuationname,
        MARKER_COLOR.refilling,
        detailPopup(e.evacuationname, e.evacuationcode, e.logourl, [], [e.contact1, e.contact2], [e.emailaddress1, e.emailaddress2]),
      ),
    );
    const partnerPins = partners.map((p) =>
      plot(
        { lat: p.latitude, lng: p.longitude },
        p.partnername,
        MARKER_COLOR.partner,
        detailPopup(p.partnername, p.partnercode, p.logourl, [], [p.contact1, p.contact2], [p.emailaddress1, p.emailaddress2]),
      ),
    );

    const otherPins = markers.map((item) =>
      plot(
        { lat: item.lat, lng: item.lng },
        item.name,
        item.color ?? MARKER_COLOR[item.kind] ?? "#2563EB",
        `<strong>${item.name}</strong><br/>
         ${item.code ? `<span>${item.code}</span><br/>` : ""}
         ${item.type ? `<span>${item.type}</span><br/>` : ""}
         ${item.address ? `<span>${item.address}</span><br/>` : ""}
         ${item.status ? `<span>Status: ${item.status}</span>` : ""}`,
      ),
    );

    markerRefs.current = [...stationPins, ...hydrantPins, ...evacuationPins, ...partnerPins, ...otherPins];
  }, [markers, stations, hydrants, evacuations, partners, ready]);

  // Render a distinct current-location marker on top of regular markers.
  useEffect(() => {
    if (!ready || !mapRef.current) {
      currentLocationMarkerRefs.current.forEach((m) => m.setMap(null));
      currentLocationMarkerRefs.current = [];
      return;
    }

    if (!currentLocation) {
      currentLocationMarkerRefs.current.forEach((m) => m.setMap(null));
      currentLocationMarkerRefs.current = [];
      return;
    }

    const maps = window.google?.maps;
    if (!maps) return;
    const ring = new maps.Marker({
      position: currentLocation,
      map: mapRef.current,
      title: "Your current location",
      zIndex: 9998,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#22C55E",
        fillOpacity: 0.18,
        strokeColor: "#22C55E",
        strokeWeight: 2,
        scale: 18,
      },
    });

    const marker = new maps.Marker({
      position: currentLocation,
      map: mapRef.current,
      title: "Your current location",
      zIndex: 9999,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#22C55E",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 3,
        scale: 11,
      },
    });

    currentLocationMarkerRefs.current.forEach((m) => m.setMap(null));
    currentLocationMarkerRefs.current = [ring, marker];

    return () => {
      currentLocationMarkerRefs.current.forEach((m) => m.setMap(null));
      currentLocationMarkerRefs.current = [];
    };
  }, [currentLocation, ready]);

  // Recenter on the user's location
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(currentLocation ? MAP_FOCUS_ZOOM : MAP_DEFAULT_ZOOM);
  }, [center, currentLocation, recenter, ready]);

  if (error) {
    return (
      <div
        className={`grid place-items-center bg-muted/40 text-center text-sm text-muted-foreground ${className}`}
      >
        <div className="flex flex-col items-center gap-2 p-6">
          <MapPin className="h-6 w-6 text-muted-foreground" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-label="Resource map" />;
}
