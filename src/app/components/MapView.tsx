import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export type RutaItem = {
  id: string;
  color: string;
  puntos: [number, number][];
  carretillaCodigo: string;
  trabajadorNombre: string;
  estado: string;
  horaInicio?: string | null;
  horaFin?: string | null;
};

function FitBounds({ items }: { items: RutaItem[] }) {
  const map = useMap();
  useEffect(() => {
    const all: [number, number][] = items.flatMap((r) => r.puntos);
    if (all.length === 0) return;
    map.fitBounds(L.latLngBounds(all.map((p) => L.latLng(p[0], p[1]))), { padding: [30, 30] });
  }, [items, map]);
  return null;
}

export function MapView({
  rutas,
  height = "100%",
  fallbackCenter = [15.7835, -90.2308],
  fallbackZoom = 7,
}: {
  rutas: RutaItem[];
  height?: string;
  fallbackCenter?: [number, number];
  fallbackZoom?: number;
}) {
  const firstPoint = rutas.find((r) => r.puntos.length > 0)?.puntos[0];
  const center: [number, number] = firstPoint ?? fallbackCenter;
  const zoom = firstPoint ? 13 : fallbackZoom;

  const layers: ReactNode[] = [];
  rutas.forEach((r) => {
    const start = r.puntos[0];
    const end = r.puntos[r.puntos.length - 1];
    if (r.puntos.length > 1) {
      layers.push(
        <Polyline key={`p-${r.id}`} positions={r.puntos} pathOptions={{ color: r.color, weight: 4 }} />
      );
    }
    if (start) {
      layers.push(
        <Marker key={`s-${r.id}`} position={start}>
          <Popup>
            <strong>Inicio</strong>
            <br />
            {r.carretillaCodigo} — {r.trabajadorNombre}
            <br />
            {r.horaInicio ? new Date(r.horaInicio).toLocaleString() : ""}
          </Popup>
        </Marker>
      );
    }
    if (end && end !== start) {
      layers.push(
        <Marker key={`e-${r.id}`} position={end}>
          <Popup>
            <strong>{r.estado === "activa" ? "Posición actual" : "Final"}</strong>
            <br />
            {r.carretillaCodigo} — {r.trabajadorNombre}
            <br />
            {r.estado === "activa"
              ? "Jornada activa"
              : r.horaFin
              ? `Finalizada: ${new Date(r.horaFin).toLocaleString()}`
              : ""}
          </Popup>
        </Marker>
      );
    }
  });

  return (
    <div style={{ height, minHeight: 400 }} className="rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={zoom} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {layers}
        <FitBounds items={rutas} />
      </MapContainer>
    </div>
  );
}

const PALETTE = [
  "#0891b2", "#db2777", "#7c3aed", "#16a34a", "#ea580c",
  "#0284c7", "#be185d", "#65a30d", "#c2410c", "#4f46e5",
];

export function colorForIndex(i: number) {
  return PALETTE[i % PALETTE.length];
}
