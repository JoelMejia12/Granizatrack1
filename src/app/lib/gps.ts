/**
 * gps.ts — Sistema de tracking GPS de alta precisión para GranizaTrack
 *
 * Características:
 * - watchPosition con enableHighAccuracy + maximumAge:0 + timeout:5000
 * - Filtro Haversine: guarda solo si ≥5s transcurridos O ≥10m recorridos
 * - Modo offline: buffer en localStorage si sin internet
 * - Sincronización automática al recuperar conexión
 * - Solo activo durante jornada activa
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabase";

/* ─── Constantes de configuración ──────────────────────────────────── */
const MIN_ELAPSED_MS  = 5_000;  // 5 segundos mínimo entre puntos
const MIN_DISTANCE_M  = 10;     // 10 metros mínimo de movimiento
const PENDING_KEY     = "graniza_gps_pending_v2";

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,       // nunca usar posición cacheada
  timeout: 5_000,      // 5 s máximo por lectura del GPS
};

/* ─── Tipos ─────────────────────────────────────────────────────────── */
export interface PendingPoint {
  jornada_id: string;
  latitud: number;
  longitud: number;
  timestamp: string;
}

export interface GpsState {
  /** Watch activo */
  active: boolean;
  /** Última latitud recibida (puede no haberse guardado todavía) */
  lat: number | null;
  /** Última longitud recibida */
  lng: number | null;
  /** Precisión en metros de la última lectura */
  accuracy: number | null;
  /** Hora de la última lectura */
  lastAt: Date | null;
  /** Mensaje de error, si existe */
  error: string | null;
  /** Conectividad actual */
  isOnline: boolean;
  /** Puntos en buffer offline pendientes de sincronizar */
  pendingCount: number;
  /** Sincronización en curso */
  syncing: boolean;
  /** Total de puntos guardados en Supabase esta sesión */
  savedCount: number;
  /** Total de puntos registrados (online + offline) esta sesión */
  totalTracked: number;
}

/* ─── Utilidades localStorage ───────────────────────────────────────── */
function getPending(): PendingPoint[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingPoint[]) : [];
  } catch {
    return [];
  }
}

function savePending(points: PendingPoint[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(points));
  } catch (e) {
    console.warn("GranizaTrack GPS: no se pudo escribir en localStorage:", e);
  }
}

function enqueuePending(point: PendingPoint): void {
  const list = getPending();
  list.push(point);
  savePending(list);
}

/* ─── Fórmula Haversine ─────────────────────────────────────────────── */
/**
 * Calcula la distancia en metros entre dos puntos geográficos
 * usando la fórmula de Haversine (exacta para distancias cortas y largas).
 */
export function haversineMeters(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6_371_000; // radio de la Tierra en metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const chord =
    sinLat * sinLat +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;

  return 2 * R * Math.asin(Math.sqrt(chord));
}

/* ─── Sincronizador offline ─────────────────────────────────────────── */
/**
 * Intenta enviar todos los puntos del buffer offline a Supabase.
 * Los que fallen vuelven al buffer para el siguiente intento.
 */
async function flushPendingToSupabase(
  onProgress: (remaining: number) => void
): Promise<void> {
  const pending = getPending();
  if (pending.length === 0) return;

  const failed: PendingPoint[] = [];

  for (const pt of pending) {
    try {
      const { error } = await supabase().from("ubicaciones").insert(pt);
      if (error) {
        console.warn("GranizaTrack GPS: error al sincronizar punto:", error.message);
        failed.push(pt);
      }
    } catch (e) {
      console.warn("GranizaTrack GPS: excepción al sincronizar punto:", e);
      failed.push(pt);
    }
  }

  savePending(failed);
  onProgress(failed.length);
}

/* ─── Hook principal ────────────────────────────────────────────────── */
export function useGpsTracker(jornadaId: string | null): GpsState & {
  syncPending: () => Promise<void>;
} {
  const [state, setState] = useState<GpsState>({
    active: false,
    lat: null,
    lng: null,
    accuracy: null,
    lastAt: null,
    error: null,
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    pendingCount: getPending().length,
    syncing: false,
    savedCount: 0,
    totalTracked: 0,
  });

  // Refs para valores que se usan dentro de callbacks sin causar re-renders
  const lastSavedRef  = useRef<{ at: number; coords: [number, number] } | null>(null);
  const watchIdRef    = useRef<number | null>(null);
  const syncingRef    = useRef(false);
  const jornadaIdRef  = useRef<string | null>(jornadaId);
  jornadaIdRef.current = jornadaId;

  /* ── Sincronizar buffer offline ── */
  const syncPending = useCallback(async (): Promise<void> => {
    if (syncingRef.current) return;
    const pending = getPending();
    if (pending.length === 0) return;

    syncingRef.current = true;
    setState((s) => ({ ...s, syncing: true }));

    await flushPendingToSupabase((remaining) => {
      setState((s) => ({
        ...s,
        pendingCount: remaining,
        // Cuántos se lograron sincronizar en este intento
        savedCount: s.savedCount + (pending.length - remaining),
      }));
    });

    syncingRef.current = false;
    setState((s) => ({ ...s, syncing: false, pendingCount: getPending().length }));
  }, []);

  /* ── Listeners de conectividad ── */
  useEffect(() => {
    const handleOnline = () => {
      setState((s) => ({ ...s, isOnline: true }));
      // Al recuperar conexión → sincronizar automáticamente
      syncPending();
    };
    const handleOffline = () => {
      setState((s) => ({ ...s, isOnline: false }));
    };

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPending]);

  /* ── watchPosition: activo solo durante jornada activa ── */
  useEffect(() => {
    // Sin jornada activa → detener el watch
    if (!jornadaId) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState((s) => ({
        ...s,
        active: false,
        lat: null,
        lng: null,
        accuracy: null,
      }));
      return;
    }

    // Verificar soporte
    if (!("geolocation" in navigator)) {
      setState((s) => ({
        ...s,
        error: "GPS no disponible en este dispositivo",
      }));
      return;
    }

    setState((s) => ({ ...s, active: true, error: null }));

    // Al iniciar jornada → intentar sync de puntos offline anteriores
    if (navigator.onLine) {
      syncPending();
    }

    /* ── Callback de nueva posición ── */
    const onPosition = async (pos: GeolocationPosition) => {
      const lat      = pos.coords.latitude;
      const lng      = pos.coords.longitude;
      const accuracy = pos.coords.accuracy ?? null;
      const now      = Date.now();
      const nowIso   = new Date(now).toISOString();

      // Actualizar UI con la posición más reciente
      setState((s) => ({
        ...s,
        active: true,
        lat,
        lng,
        accuracy,
        lastAt: new Date(now),
        error: null,
        isOnline: navigator.onLine,
      }));

      /* ── Filtro de guardado: Haversine + tiempo ── */
      const last    = lastSavedRef.current;
      const elapsed = last ? now - last.at : Infinity;
      const moved   = last
        ? haversineMeters(last.coords, [lat, lng])
        : Infinity;

      // Guardar SOLO si pasaron ≥5s O se movió ≥10m
      const shouldSave = elapsed >= MIN_ELAPSED_MS || moved >= MIN_DISTANCE_M;
      if (!shouldSave) return;

      const punto: PendingPoint = {
        jornada_id: jornadaIdRef.current!,
        latitud: lat,
        longitud: lng,
        timestamp: nowIso,
      };

      // Marcar como "guardado" de inmediato para evitar duplicados
      lastSavedRef.current = { at: now, coords: [lat, lng] };

      /* ── Online: intentar Supabase directo ── */
      if (navigator.onLine) {
        try {
          const { error } = await supabase().from("ubicaciones").insert(punto);
          if (!error) {
            setState((s) => ({
              ...s,
              savedCount: s.savedCount + 1,
              totalTracked: s.totalTracked + 1,
            }));
            // Aprovechar para limpiar pendientes si los hay
            if (getPending().length > 0) syncPending();
            return;
          }
          // Error de BD → caer al buffer offline
          console.warn("GranizaTrack GPS: insert falló, guardando offline:", error.message);
        } catch (e) {
          console.warn("GranizaTrack GPS: excepción en insert, guardando offline:", e);
        }
      }

      /* ── Offline (o error): guardar en localStorage ── */
      enqueuePending(punto);
      setState((s) => ({
        ...s,
        pendingCount: getPending().length,
        totalTracked: s.totalTracked + 1,
      }));
    };

    /* ── Callback de error GPS ── */
    const onError = (err: GeolocationPositionError) => {
      let msg: string;
      switch (err.code) {
        case GeolocationPositionError.PERMISSION_DENIED:
          msg = "Permiso GPS denegado. Activa la ubicación en tu navegador.";
          break;
        case GeolocationPositionError.POSITION_UNAVAILABLE:
          msg = "Señal GPS no disponible. Muévete a un lugar con mejor cobertura.";
          break;
        case GeolocationPositionError.TIMEOUT:
          msg = "Tiempo de espera GPS agotado. Reintentando…";
          break;
        default:
          msg = `Error GPS desconocido: ${err.message}`;
      }
      setState((s) => ({ ...s, error: msg }));
    };

    /* ── Iniciar watchPosition ── */
    watchIdRef.current = navigator.geolocation.watchPosition(
      onPosition,
      onError,
      GPS_OPTIONS
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [jornadaId, syncPending]);

  return { ...state, syncPending };
}
