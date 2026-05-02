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
const GAP_PAUSA_MS = 5 * 60 * 1000; // 5 minutos
const MAX_TIMELINE = 250; // máx. puntos a mostrar en el timeline

/* ─── Helpers de formato ─────────────────────────────────────────────── */
function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("es-GT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDuracion(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

/* ─── TimelineJornada ────────────────────────────────────────────────── */
function TimelineJornada({
  puntos,
  timestamps,
  color,
}: {
  puntos: [number, number][];
  timestamps: string[];
  color: string;
}) {
  const total = puntos.length;
  if (total === 0) return null;

  // Limitar display a MAX_TIMELINE puntos (siempre primer y último)
  const truncado = total > MAX_TIMELINE;
  let indices: number[] = [];
  if (!truncado) {
    indices = Array.from({ length: total }, (_, i) => i);
  } else {
    indices = [0];
    const inner = MAX_TIMELINE - 2;
    const step = (total - 2) / inner;
    for (let i = 0; i < inner; i++) indices.push(Math.round(1 + i * step));
    indices.push(total - 1);
  }

  // Duración total de la jornada
  const durMs =
    timestamps[total - 1] && timestamps[0]
      ? new Date(timestamps[total - 1]).getTime() - new Date(timestamps[0]).getTime()
      : 0;

  // Contar pausas
  let numPausas = 0;
  for (let i = 1; i < total; i++) {
    const gap =
      new Date(timestamps[i]).getTime() - new Date(timestamps[i - 1]).getTime();
    if (gap > GAP_PAUSA_MS) numPausas++;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-base">🗓️</span>
          <h3 className="font-semibold text-gray-800">Historial de recorrido</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {total} punto{total !== 1 ? "s" : ""}
          </span>
          {durMs > 0 && (
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">
              ⏱ {fmtDuracion(durMs)}
            </span>
          )}
          {numPausas > 0 && (
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              ⏸ {numPausas} pausa{numPausas !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Lista de puntos */}
      <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
        {truncado && (
          <div className="text-xs text-gray-400 text-center py-1.5 border-b border-dashed border-gray-100 bg-blue-50 text-blue-600">
            Mostrando {MAX_TIMELINE} de {total} puntos (representación uniforme)
          </div>
        )}

        <div className="px-4 py-2 space-y-0">
          {indices.map((idx, display) => {
            const pt = puntos[idx];
            const ts = timestamps[idx];
            const prevIdx = display > 0 ? indices[display - 1] : null;
            const prevTs = prevIdx !== null ? timestamps[prevIdx] : null;

            const isFirst = idx === 0;
            const isLast  = idx === total - 1;

            const gapMs =
              prevTs && ts
                ? new Date(ts).getTime() - new Date(prevTs).getTime()
                : 0;
            const isPausa = gapMs > GAP_PAUSA_MS;

            const dotBg = isFirst
              ? "#22c55e"
              : isLast
              ? "#ef4444"
              : color;

            const label = isFirst
              ? "Inicio de jornada"
              : isLast
              ? "Última ubicación"
              : "Ubicación registrada";

            const labelColor = isFirst
              ? "text-green-600"
              : isLast
              ? "text-red-500"
              : "text-gray-500";

            return (
              <div key={idx}>
                {/* Indicador de pausa entre puntos */}
                {isPausa && (
                  <div className="flex items-center gap-2 my-1 ml-5 pl-3 border-l-2 border-amber-300">
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs px-2.5 py-1 rounded-lg">
                      <span>⏸</span>
                      <span className="font-medium">
                        Pausa de ~{Math.round(gapMs / 60000)} min detectada
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-stretch gap-3 py-1">
                  {/* Línea vertical + punto */}
                  <div className="flex flex-col items-center" style={{ width: 16 }}>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5 border-2 border-white"
                      style={{
                        backgroundColor: dotBg,
                        boxShadow: `0 0 0 1.5px ${dotBg}`,
                      }}
                    />
                    {display < indices.length - 1 && (
                      <div
                        className="flex-1 w-0.5 mt-0.5"
                        style={{ backgroundColor: isPausa ? "#fcd34d" : "#e5e7eb", minHeight: 12 }}
                      />
                    )}
                  </div>

                  {/* Contenido del punto */}
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 tabular-nums">
                        {ts ? fmtTime(ts) : "—"}
                      </span>
                      <span className={`text-xs font-medium ${labelColor}`}>
                        {label}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                      {pt[0].toFixed(5)}, {pt[1].toFixed(5)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Rutas ──────────────────────────────────────────────────────────── */
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

  const verRuta = async (j: Jornada) => {
    setLoadingRuta(true);
    setRutaSel(null);

    const { data: ubis, error } = await supabase()
      .from("ubicaciones")
      .select("latitud, longitud, timestamp")
      .eq("jornada_id", j.id)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error al cargar ubicaciones:", error);
      setLoadingRuta(false);
      return;
    }

    const registros = ubis ?? [];
    const carr = carretillas.find((c) => c.id === j.carretilla_id);

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

          {/* ── Historial de recorrido (timeline) ── */}
          {rutaSel.puntos.length > 0 && rutaSel.timestamps && rutaSel.timestamps.length > 0 && (
            <TimelineJornada
              puntos={rutaSel.puntos}
              timestamps={rutaSel.timestamps}
              color={rutaSel.color}
            />
          )}
        </>
      )}
    </div>
  );
}