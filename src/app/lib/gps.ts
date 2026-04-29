import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export type GpsState = {
  active: boolean;
  lat: number | null;
  lng: number | null;
  lastAt: Date | null;
  error: string | null;
};

function distMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function useGpsTracker(jornadaId: string | null) {
  const [state, setState] = useState<GpsState>({
    active: false,
    lat: null,
    lng: null,
    lastAt: null,
    error: null,
  });
  const lastSavedRef = useRef<{ at: number; coords: [number, number] } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!jornadaId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState((s) => ({ ...s, active: false }));
      return;
    }
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, error: "GPS no disponible" }));
      return;
    }

    setState((s) => ({ ...s, active: true, error: null }));

    const onPos = async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const now = Date.now();
      setState({ active: true, lat, lng, lastAt: new Date(), error: null });

      const last = lastSavedRef.current;
      const moved = last ? distMeters(last.coords, [lat, lng]) : Infinity;
      const elapsed = last ? now - last.at : Infinity;

      if (elapsed >= 30000 || moved >= 20) {
        try {
          const { error } = await supabase().from("ubicaciones").insert({
            jornada_id: jornadaId,
            latitud: lat,
            longitud: lng,
            timestamp: new Date().toISOString(),
          });
          if (!error) {
            lastSavedRef.current = { at: now, coords: [lat, lng] };
          }
        } catch (e) {
          console.error("Error guardando ubicación:", e);
        }
      }
    };

    const onErr = (err: GeolocationPositionError) => {
      setState((s) => ({ ...s, error: err.message }));
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [jornadaId]);

  return state;
}
