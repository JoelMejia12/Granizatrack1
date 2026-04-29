import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import { Fragment, useEffect } from "react";

const FragmentWithKey = Fragment as any;
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundlers
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

export function MapView({ rutas, height = "100%" }: { rutas: RutaItem[]; height?: string }) {
  const center: [number, number] = rutas[0]?.puntos[0] ?? [-12.0464, -77.0428];
  return (
    <div style={{ height, minHeight: 400 }} className="rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {rutas.map((r) => {
          const start = r.puntos[0];
          const end = r.puntos[r.puntos.length - 1];
          return (
            <FragmentWithKey key={r.id}>
              {r.puntos.length > 1 && (
                <Polyline positions={r.puntos} pathOptions={{ color: r.color, weight: 4 }} />
              )}
              {start && (
                <Marker position={start}>
                  <Popup>
                    <strong>Inicio</strong>
                    <br />
                    {r.carretillaCodigo} — {r.trabajadorNombre}
                    <br />
                    {r.horaInicio ? new Date(r.horaInicio).toLocaleString() : ""}
                  </Popup>
                </Marker>
              )}
              {end && end !== start && (
                <Marker position={end}>
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
              )}
            </FragmentWithKey>
          );
        })}
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
