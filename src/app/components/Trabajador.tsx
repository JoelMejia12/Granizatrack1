import { useEffect, useState } from "react";
import { supabase, Usuario } from "../lib/supabase";
import { useGpsTracker } from "../lib/gps";
import { Ventas } from "./Ventas";

type Carretilla = { id: string; codigo: string; estado: string };
type Jornada    = { id: string; carretilla_id: string; estado: string; hora_inicio: string; hora_fin: string | null };

/* ─── Panel de estado GPS ────────────────────────────────────────────── */
function GpsPanel({
  gps,
  onSync,
}: {
  gps: ReturnType<typeof useGpsTracker>;
  onSync: () => void;
}) {
  const hasError   = Boolean(gps.error);
  const hasCoords  = gps.lat !== null && gps.lng !== null;

  return (
    <div
      className={`rounded-xl border px-4 py-3 space-y-2 text-sm ${
        hasError
          ? "bg-red-50 border-red-200 text-red-700"
          : gps.active
          ? "bg-green-50 border-green-200 text-green-800"
          : "bg-gray-50 border-gray-200 text-gray-600"
      }`}
    >
      {/* Fila principal: estado GPS + conectividad */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          {hasError ? (
            <span>❌ GPS — Error</span>
          ) : gps.active ? (
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"
                title="GPS activo"
              />
              📡 GPS activo
            </span>
          ) : (
            <span>⏸ GPS inactivo</span>
          )}
        </div>

        {/* Indicador de conectividad */}
        <span
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
            gps.isOnline
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              gps.isOnline ? "bg-green-500" : "bg-orange-500"
            }`}
          />
          {gps.isOnline ? "En línea" : "Sin conexión"}
        </span>
      </div>

      {/* Error detallado */}
      {hasError && (
        <div className="text-xs text-red-600 leading-snug">{gps.error}</div>
      )}

      {/* Coordenadas + precisión */}
      {hasCoords && !hasError && (
        <div className="text-xs text-gray-600 space-y-0.5">
          <div>
            📍 {gps.lat!.toFixed(6)}, {gps.lng!.toFixed(6)}
            {gps.accuracy !== null && (
              <span className="ml-2 text-gray-400">±{Math.round(gps.accuracy)}m</span>
            )}
          </div>
          {gps.lastAt && (
            <div className="text-gray-400">
              Última lectura:{" "}
              {gps.lastAt.toLocaleTimeString("es-GT", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
          )}
        </div>
      )}

      {/* Contadores */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="text-gray-500">
          📌 Puntos guardados: <strong className="text-gray-700">{gps.savedCount}</strong>
        </span>
        <span className="text-gray-500">
          🗺 Total registrados: <strong className="text-gray-700">{gps.totalTracked}</strong>
        </span>
      </div>

      {/* Buffer offline */}
      {gps.pendingCount > 0 && (
        <div className="flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <div>
            <div className="text-orange-700 font-medium text-xs">
              📦 {gps.pendingCount} punto{gps.pendingCount !== 1 ? "s" : ""} en buffer offline
            </div>
            <div className="text-orange-600 text-xs">
              {gps.isOnline
                ? "Se sincronizarán automáticamente."
                : "Se enviarán al recuperar conexión."}
            </div>
          </div>
          {gps.isOnline && !gps.syncing && (
            <button
              onClick={onSync}
              className="text-xs px-2.5 py-1 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 font-medium transition-colors"
            >
              Sincronizar
            </button>
          )}
          {gps.syncing && (
            <span className="text-xs text-orange-500 animate-pulse">
              Sincronizando…
            </span>
          )}
        </div>
      )}

      {/* Sincronizando indicador general */}
      {gps.syncing && gps.pendingCount === 0 && (
        <div className="text-xs text-green-600 animate-pulse">
          ✅ Sincronización completada
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal Trabajador ──────────────────────────────── */
export function Trabajador({
  usuario,
  onSignOut,
}: {
  usuario: Usuario;
  onSignOut: () => void;
}) {
  const [tab,       setTab]       = useState<"jornada" | "ventas">("jornada");
  const [asignacion, setAsignacion] = useState<Carretilla | null>(null);
  const [jornada,   setJornada]   = useState<Jornada | null>(null);
  const [loading,   setLoading]   = useState(true);

  // GPS activo SOLO cuando hay jornada activa
  const gps = useGpsTracker(jornada?.estado === "activa" ? jornada.id : null);

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();

    const { data: asig } = await sb
      .from("asignaciones")
      .select("carretilla_id")
      .eq("trabajador_id", usuario.id)
      .eq("activa", true)
      .maybeSingle();

    if (asig?.carretilla_id) {
      const { data: c } = await sb
        .from("carretillas")
        .select("id, codigo, estado")
        .eq("id", asig.carretilla_id)
        .maybeSingle();
      setAsignacion((c ?? null) as any);
    } else {
      setAsignacion(null);
    }

    const { data: j } = await sb
      .from("jornadas")
      .select("id, carretilla_id, estado, hora_inicio, hora_fin")
      .eq("trabajador_id", usuario.id)
      .eq("estado", "activa")
      .maybeSingle();
    setJornada((j ?? null) as any);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const iniciar = async () => {
    if (!asignacion) return;
    const { data, error } = await supabase()
      .from("jornadas")
      .insert({
        trabajador_id: usuario.id,
        carretilla_id: asignacion.id,
        estado:        "activa",
        hora_inicio:   new Date().toISOString(),
      })
      .select()
      .single();
    if (!error && data) setJornada(data as any);
  };

  const finalizar = async () => {
    if (!jornada) return;
    await supabase()
      .from("jornadas")
      .update({ estado: "finalizada", hora_fin: new Date().toISOString() })
      .eq("id", jornada.id);
    setJornada(null);
  };

  return (
    <div className="min-h-screen bg-[#FDF7FA]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-semibold" style={{ color: "#0891b2" }}>
            GranizaTrack
          </h1>
          <p className="text-xs text-gray-500">{usuario.nombre} · trabajador</p>
        </div>
        <button onClick={onSignOut} className="text-sm text-gray-500 hover:text-gray-800">
          Salir
        </button>
      </header>

      {/* ── Tabs ── */}
      <div className="px-4 py-2 flex gap-2 border-b border-gray-200 bg-white">
        {[
          { k: "jornada", label: "Jornada" },
          { k: "ventas",  label: "Ventas"  },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as any)}
            className={`px-3 py-1.5 rounded-full text-sm ${
              tab === t.k ? "bg-[#AEE6F9]" : "bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      <main className="p-4 space-y-4">
        {tab === "jornada" && (
          <>
            {loading ? (
              <div className="text-sm text-gray-400 animate-pulse p-4">Cargando…</div>
            ) : (
              <>
                {/* Carretilla asignada */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h3 className="font-medium mb-1">Carretilla asignada</h3>
                  {asignacion ? (
                    <div>
                      <div className="text-lg font-semibold">{asignacion.codigo}</div>
                      <div className="text-xs text-gray-500">Estado: {asignacion.estado}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">Sin asignación activa</div>
                  )}
                </div>

                {/* Jornada + GPS */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <h3 className="font-medium">Jornada</h3>

                  {jornada ? (
                    <>
                      <div className="text-sm text-gray-600">
                        ▶ Iniciada:{" "}
                        <span className="font-medium">
                          {new Date(jornada.hora_inicio).toLocaleString()}
                        </span>
                      </div>

                      {/* Panel GPS detallado */}
                      <GpsPanel gps={gps} onSync={gps.syncPending} />

                      <button
                        onClick={finalizar}
                        className="w-full py-2.5 rounded-lg bg-[#F8C8DC] font-medium hover:bg-pink-200 transition-colors"
                      >
                        Finalizar jornada
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={iniciar}
                      disabled={!asignacion}
                      className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
                      style={{ backgroundColor: "#0891b2" }}
                    >
                      Iniciar jornada
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {tab === "ventas" && (
          <Ventas
            usuario={usuario}
            jornadaActiva={
              jornada
                ? { id: jornada.id, carretilla_id: jornada.carretilla_id }
                : null
            }
          />
        )}
      </main>
    </div>
  );
}
