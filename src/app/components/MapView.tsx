/**
 * MapView.tsx — Componente de mapa para GranizaTrack
 *
 * - Dibuja todas las rutas con Polyline completa (todos los puntos GPS)
 * - Marcadores de inicio (verde) y fin (rojo) con popups
 * - Círculos pequeños en cada punto GPS intermedio
 * - Simplificación visual automática cuando hay >2000 puntos
 */

import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";
import { useEffect, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ─── Icono default Leaflet ─────────────────────────────────────────── */
const DefaultIcon = L.icon({
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/* ─── Iconos personalizados ─────────────────────────────────────────── */
const InicioIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:20px;height:20px;
    background:#22c55e;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.45);
  "></div>`,
  iconSize:    [20, 20],
  iconAnchor:  [10, 10],
  popupAnchor: [0, -14],
});

const FinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:20px;height:20px;
    background:#ef4444;
    border:3px solid #fff;
    border-radius:50%;
    box-shadow:0 2px 8px rgba(0,0,0,0.45);
  "></div>`,
  iconSize:    [20, 20],
  iconAnchor:  [10, 10],
  popupAnchor: [0, -14],
});

/* ─── Tipo RutaItem ─────────────────────────────────────────────────── */
export type RutaItem = {
  id: string;
  color: string;
  /** Todos los puntos [lat, lng] ordenados por timestamp ASC */
  puntos: [number, number][];
  /** Timestamps ISO de cada punto (mismo índice que puntos) */
  timestamps?: string[];
  carretillaCodigo: string;
  trabajadorNombre: string;
  estado: string;
  horaInicio?: string | null;
  horaFin?: string | null;
};

/* ─── Simplificación de puntos (Nth-point + extremos fijos) ─────────── */
const MAX_VISUAL_POINTS = 600;

/**
 * Reduce un array de puntos a un máximo de `maxPts` puntos
 * distribuidos uniformemente, manteniendo siempre el primero y el último.
 * Se usa para rutas con >2000 puntos para no saturar el render del mapa.
 */
function simplifyNth(
  pts: [number, number][],
  maxPts: number
): [number, number][] {
  const n = pts.length;
  if (n <= maxPts) return pts;

  const result: [number, number][] = [pts[0]];
  // Distribuir (maxPts-2) puntos intermedios uniformemente
  const inner = maxPts - 2;
  const step  = (n - 2) / inner;
  for (let i = 0; i < inner; i++) {
    result.push(pts[Math.round(1 + i * step)]);
  }
  result.push(pts[n - 1]);
  return result;
}

/* ─── FitBounds ─────────────────────────────────────────────────────── */
function FitBounds({ items }: { items: RutaItem[] }) {
  const map = useMap();
  useEffect(() => {
    const all: [number, number][] = items.flatMap((r) => r.puntos);
    if (all.length === 0) return;
    map.fitBounds(
      L.latLngBounds(all.map((p) => L.latLng(p[0], p[1]))),
      { padding: [30, 30] }
    );
  // Solo re-ajustar cuando cambia la lista de IDs, no en cada re-render
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items.map((r) => r.id + r.puntos.length)), map]);
  return null;
}

/* ─── Helpers de formato ────────────────────────────────────────────── */
function fmtHora(ts?: string): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtCoords(p: [number, number]): string {
  return `${p[0].toFixed(6)}, ${p[1].toFixed(6)}`;
}

/* ─── RutaLayer: una ruta completa con todos sus elementos ──────────── */
const RutaLayer = memo(function RutaLayer({ r }: { r: RutaItem }) {
  const n = r.puntos.length;
  if (n === 0) return null;

  const start      = r.puntos[0];
  const end        = r.puntos[n - 1];
  const isSameEnd  = n === 1 || (start[0] === end[0] && start[1] === end[1]);
  const tsStart    = r.timestamps?.[0];
  const tsEnd      = r.timestamps?.[n - 1];

  // ── Simplificación visual si hay >2000 puntos ──────────────────────
  const isHeavy       = n > 2_000;
  const visualPoints  = isHeavy ? simplifyNth(r.puntos, MAX_VISUAL_POINTS) : r.puntos;
  const circlePoints  = isHeavy ? simplifyNth(r.puntos, 300) : r.puntos;
  // Reducir radio de círculos cuando hay muchos puntos
  const circleRadius  = isHeavy ? 2 : 2.5;

  return (
    <>
      {/* ── Polyline con TODOS los puntos (visual simplificado si >2000) ── */}
      {n >= 2 && (
        <Polyline
          positions={visualPoints}
          pathOptions={{
            color:        r.color,
            weight:       4,
            opacity:      0.92,
            smoothFactor: 1,
          }}
        />
      )}

      {/* ── Pequeños círculos en cada punto GPS ── */}
      {circlePoints.map((p, i) => (
        <CircleMarker
          key={`cm-${r.id}-${i}`}
          center={p}
          radius={circleRadius}
          pathOptions={{
            color:       r.color,
            weight:      1,
            opacity:     0.5,
            fillColor:   "#93c5fd",
            fillOpacity: 0.7,
          }}
        />
      ))}

      {/* ── Marcador INICIO (verde) ── */}
      <Marker position={start} icon={InicioIcon}>
        <Popup minWidth={200}>
          <div style={{ lineHeight: "1.65" }}>
            <strong style={{ color: "#16a34a", fontSize: "0.94em" }}>
              🟢 Inicio de jornada
            </strong>
            <br />
            <span style={{ fontSize: "0.88em" }}>
              🕐 <b>{fmtHora(tsStart)}</b>
            </span>
            <br />
            <span style={{ fontSize: "0.77em", color: "#555" }}>
              📍 {fmtCoords(start)}
            </span>
            <br />
            <span style={{ fontSize: "0.82em" }}>
              {r.carretillaCodigo} — {r.trabajadorNombre}
            </span>
          </div>
        </Popup>
      </Marker>

      {/* ── Marcador FIN (rojo / azul para jornada activa) ── */}
      {!isSameEnd && (
        <Marker position={end} icon={FinIcon}>
          <Popup minWidth={200}>
            <div style={{ lineHeight: "1.65" }}>
              <strong
                style={{
                  color:     r.estado === "activa" ? "#2563eb" : "#dc2626",
                  fontSize:  "0.94em",
                }}
              >
                {r.estado === "activa" ? "🔵 Posición actual" : "🔴 Fin de jornada"}
              </strong>
              <br />
              <span style={{ fontSize: "0.88em" }}>
                🕐 <b>{fmtHora(tsEnd)}</b>
              </span>
              <br />
              <span style={{ fontSize: "0.77em", color: "#555" }}>
                📍 {fmtCoords(end)}
              </span>
              <br />
              <span style={{ fontSize: "0.82em" }}>
                {r.carretillaCodigo} — {r.trabajadorNombre}
              </span>
            </div>
          </Popup>
        </Marker>
      )}

      {/* ── Aviso si la ruta fue simplificada visualmente ── */}
      {isHeavy && (
        /* Leaflet no soporta elementos React nativos fuera de capas;
           el aviso se muestra como banner encima del mapa desde MapView */
        <></>
      )}
    </>
  );
});

/* ─── MapView: componente principal exportado ───────────────────────── */
export function MapView({
  rutas,
  height = "100%",
  fallbackCenter = [15.7835, -90.2308],
  fallbackZoom   = 7,
}: {
  rutas: RutaItem[];
  height?: string;
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}) {
  const firstPoint   = rutas.find((r) => r.puntos.length > 0)?.puntos[0];
  const center: [number, number] = firstPoint ?? fallbackCenter;
  const zoom         = firstPoint ? 14 : fallbackZoom;
  const maxPuntos    = Math.max(...rutas.map((r) => r.puntos.length), 0);
  const isSimplified = maxPuntos > 2_000;

  return (
    <div style={{ height, minHeight: 400 }}>
      {/* Banner de simplificación visual */}
      {isSimplified && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-1.5 rounded-t-2xl">
          <span>⚡</span>
          <span>
            <strong>Visualización optimizada:</strong> ruta con {maxPuntos.toLocaleString()} puntos —
            mostrando {MAX_VISUAL_POINTS} puntos representativos para mejorar el rendimiento.
            Los datos completos siguen almacenados en Supabase.
          </span>
        </div>
      )}

      <div
        className={`overflow-hidden border border-gray-200 ${isSimplified ? "rounded-b-2xl border-t-0" : "rounded-2xl"}`}
        style={{ height: isSimplified ? "calc(100% - 32px)" : "100%", minHeight: 400 }}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {rutas.map((r) => (
            <RutaLayer key={r.id} r={r} />
          ))}
          <FitBounds items={rutas} />
        </MapContainer>
      </div>
    </div>
  );
}

/* ─── Paleta de colores ─────────────────────────────────────────────── */
const PALETTE = [
  "#3b82f6",  // azul principal
  "#db2777",
  "#7c3aed",
  "#16a34a",
  "#ea580c",
  "#0284c7",
  "#be185d",
  "#65a30d",
  "#c2410c",
  "#4f46e5",
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}
