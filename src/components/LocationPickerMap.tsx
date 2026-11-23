import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import {
  GOOGLE_MAPS_API_KEY,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_FOCUS_ZOOM,
} from "@/config/map";
import {
  loadGoogleMaps,
  pinIcon,
  type GoogleMapClickEvent,
  type GoogleMapInstance,
  type GoogleMarkerInstance,
} from "@/components/GoogleMapView";

interface Props {
  lat?: number | null;
  lng?: number | null;
  /** When provided, clicking the map or dragging the pin updates the location. */
  onChange?: (lat: number, lng: number) => void;
  color?: string;
  className?: string;
  disabled?: boolean;
}

const isValid = (lat?: number | null, lng?: number | null) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  !(Number(lat) === 0 && Number(lng) === 0) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Small map that shows one pin; editable when `onChange` is passed. */
export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  color = "#DC2626",
  className = "",
  disabled = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = !!onChange && !disabled;

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
        const has = isValid(lat, lng);
        const map = new maps.Map(containerRef.current, {
          center: has ? { lat: Number(lat), lng: Number(lng) } : MAP_DEFAULT_CENTER,
          zoom: has ? MAP_FOCUS_ZOOM + 3 : MAP_DEFAULT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          draggableCursor: editable ? "crosshair" : undefined,
        });
        mapRef.current = map;
        map.addListener?.("click", (e?: GoogleMapClickEvent) => {
          if (disabled) return;
          const fn = onChangeRef.current;
          if (!fn || !e?.latLng) return;
          fn(round(e.latLng.lat()), round(e.latLng.lng()));
        });
        setReady(true);
      })
      .catch(() => !cancelled && setError("Unable to load the map right now."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const maps = window.google?.maps;
    if (!maps) return;
    if (!isValid(lat, lng)) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }
    const pos = { lat: Number(lat), lng: Number(lng) };
    markerRef.current?.setMap(null);
    const marker = new maps.Marker({
      position: pos,
      map: mapRef.current,
      draggable: editable,
      icon: pinIcon(color, true),
      title: "Exact plotted location",
      zIndex: 1000,
    });
    marker.addListener("dragend", (e?: GoogleMapClickEvent) => {
      if (disabled) return;
      const fn = onChangeRef.current;
      if (!fn || !e?.latLng) return;
      fn(round(e.latLng.lat()), round(e.latLng.lng()));
    });
    markerRef.current = marker;
    mapRef.current.setCenter(pos);
  }, [lat, lng, color, ready, editable, disabled]);

  if (error) {
    return (
      <div
        className={`grid place-items-center rounded-md border border-border bg-muted/40 text-sm text-muted-foreground ${className}`}
      >
        <div className="flex flex-col items-center gap-2 p-6">
          <MapPin className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-md border border-border ${className}`}
      aria-label={editable ? "Click the map to set the location" : "Location map"}
    />
  );
}
