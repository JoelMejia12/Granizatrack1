import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapView, RutaItem } from "./MapView";

type Carretilla = { id: string; codigo: string; estado: string };
type Jornada = {
  id: string;
  trabajador_id: string;
  carretilla_id: string;
  estado: string;
  hora_inicio: string;
  hora_fin: string | null;
};

const COLOR_RUTA = "#3b82f6";

export function Rutas() {
  const [carretillas, setCarretillas] = useState<Carretilla[]>([]);
  const [carretillaId, setCarretillaId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [jornadas, setJornadas] = useState<Jornada[]>([]);
  const [trabajadores, setTrabajadores] = useState<Record<string, string>>({});
  const [rutaSel, setRutaSel] = useState<RutaItem | null>(null);
  const [loadingRuta, setLoadingRuta] = useState(false);

  useEffect(() => {
    supabase()
      .from("carretillas")
      .select("id, codigo, estado")
      .then(({ data }) => setCarretillas((data ?? []) as Carretilla[]));

    supabase()
      .from("usuarios")
      .select("id, nombre")
      .then(({ data }) => {
        const m: Record<string, string> = {};
        (data ?? []).forEach((u: any) => (m[u.id] = u.nombre));
        setTrabajadores(m);
      });
  }, []);

  useEffect(() => {
    if (!carretillaId || !fecha) {
      setJornadas([]);
      return;
    }
    const desde = new Date(`${fecha}T00:00:00`).toISOString();
    const hasta = new Date(`${fecha}T23:59:59`).toISOString();
    supabase()
      .from("jornadas")
      .select("id, trabajador_id, carretilla_id, estado, hora_inicio, hora_fin")
      .eq("carretilla_id", carretillaId)
      .gte("hora_inicio", desde)
      .lte("hora_inicio", hasta)
      .order("hora_inicio", { ascending: true })
      .then(({ data }) => {
        setJornadas((data ?? []) as Jornada[]);
        setRutaSel(null);
      });
  }, [carretillaId, fecha]);

  /**
   * Carga TODOS los puntos GPS de la jornada seleccionada
   * ordenados por timestamp ASC (obligatorio para ruta correcta).
   */
  const verRuta = async (j: Jornada) => {
    setLoadingRuta(true);
    setRutaSel(null);

    const { data: ubis, error } = await supabase()
      .from("ubicaciones")
      .select("latitud, longitud, timestamp")
      .eq("jornada_id", j.id)
      .order("timestamp", { ascending: true }); // ← orden ASC obligatorio

    if (error) {
      console.error("Error al cargar ubicaciones:", error);
      setLoadingRuta(false);
      return;
    }

    const registros = ubis ?? [];
    const carr = carretillas.find((c) => c.id === j.carretilla_id);

    // Convertir TODOS los registros en coordenadas y timestamps
    const puntos: [number, number][] = registros.map((u: any) => [
      Number(u.latitud),
      Number(u.longitud),
    ]);
    const timestamps: string[] = registros.map((u: any) => u.timestamp as string);

    setRutaSel({
      id: j.id,
      color: COLOR_RUTA,
      puntos,
      timestamps,
      carretillaCodigo: carr?.codigo ?? "—",
      trabajadorNombre: trabajadores[j.trabajador_id] ?? "—",
      estado: j.estado,
      horaInicio: j.hora_inicio,
      horaFin: j.hora_fin,
    });
    setLoadingRuta(false);
  };

  /* ── Renderizado ── */
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Rutas (jornadas históricas)</h2>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Columna 1: Carretillas */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-medium">Carretillas</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {carretillas.map((c) => (
              <button
                key={c.id}
                onClick={() => setCarretillaId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex justify-between items-center ${
                  carretillaId === c.id
                    ? "bg-[#AEE6F9]"
                    : "hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{c.codigo}</span>
                <span className="text-xs text-gray-500">{c.estado}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Columna 2: Fecha + Jornadas */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <h3 className="font-medium">Fecha</h3>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {jornadas.length === 0 && carretillaId && (
              <div className="text-sm text-gray-500">Sin jornadas en esta fecha</div>
            )}
            {jornadas.map((j) => (
              <button
                key={j.id}
                onClick={() => verRuta(j)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  rutaSel?.id === j.id ? "bg-[#F8C8DC]" : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{trabajadores[j.trabajador_id] ?? "—"}</div>
                <div className="text-xs text-gray-500">
                  {new Date(j.hora_inicio).toLocaleTimeString()} →{" "}
                  {j.hora_fin ? new Date(j.hora_fin).toLocaleTimeString() : "—"} ·{" "}
                  {j.estado}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Columna 3: Información de la jornada seleccionada */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Información</h3>
          {loadingRuta ? (
            <div className="text-sm text-gray-400 animate-pulse">Cargando puntos GPS…</div>
          ) : rutaSel ? (
            <div className="text-sm space-y-1">
              <div>
                <strong>Carretilla:</strong> {rutaSel.carretillaCodigo}
              </div>
              <div>
                <strong>Trabajador:</strong> {rutaSel.trabajadorNombre}
              </div>
              <div>
                <strong>Estado:</strong>{" "}
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    rutaSel.estado === "activa"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {rutaSel.estado}
                </span>
              </div>
              <div>
                <strong>Inicio:</strong>{" "}
                {rutaSel.horaInicio
                  ? new Date(rutaSel.horaInicio).toLocaleString()
                  : "—"}
              </div>
              <div>
                <strong>Fin:</strong>{" "}
                {rutaSel.horaFin
                  ? new Date(rutaSel.horaFin).toLocaleString()
                  : "—"}
              </div>
              <div>
                <strong>Puntos GPS:</strong>{" "}
                <span
                  className={`font-semibold ${
                    rutaSel.puntos.length < 10
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                >
                  {rutaSel.puntos.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Selecciona una jornada</div>
          )}
        </div>
      </div>

      {/* ── Área del mapa ── */}
      {rutaSel && (
        <>
          {/* Sin ningún punto GPS */}
          {rutaSel.puntos.length === 0 && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded-2xl text-sm">
              <span className="text-2xl">📭</span>
              <span>
                <strong>No hay datos de ubicación para esta jornada.</strong>
                <br />
                El trabajador aún no ha registrado ningún punto GPS.
              </span>
            </div>
          )}

          {/* Pocos puntos: ruta aproximada */}
          {rutaSel.puntos.length > 0 && rutaSel.puntos.length < 10 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-2xl text-sm">
              <span className="text-2xl">⚠️</span>
              <span>
                <strong>Ruta aproximada:</strong> no hay suficientes puntos GPS para
                reconstruir el recorrido con precisión ({rutaSel.puntos.length} punto
                {rutaSel.puntos.length !== 1 ? "s" : ""} registrado
                {rutaSel.puntos.length !== 1 ? "s" : ""}).
              </span>
            </div>
          )}

          {/* Mapa con la ruta completa */}
          {rutaSel.puntos.length > 0 && (
            <div style={{ height: 520 }}>
              <MapView rutas={[rutaSel]} height="100%" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
