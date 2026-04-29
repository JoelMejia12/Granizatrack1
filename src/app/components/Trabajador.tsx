import { useEffect, useState } from "react";
import { supabase, Usuario } from "../lib/supabase";
import { useGpsTracker } from "../lib/gps";
import { Ventas } from "./Ventas";

type Carretilla = { id: string; codigo: string; estado: string };
type Jornada = { id: string; carretilla_id: string; estado: string; hora_inicio: string; hora_fin: string | null };

export function Trabajador({ usuario, onSignOut }: { usuario: Usuario; onSignOut: () => void }) {
  const [tab, setTab] = useState<"jornada" | "ventas">("jornada");
  const [asignacion, setAsignacion] = useState<Carretilla | null>(null);
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
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
      const { data: c } = await sb.from("carretillas").select("id, codigo, estado").eq("id", asig.carretilla_id).maybeSingle();
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
    const { data, error } = await supabase().from("jornadas").insert({
      trabajador_id: usuario.id,
      carretilla_id: asignacion.id,
      estado: "activa",
      hora_inicio: new Date().toISOString(),
    }).select().single();
    if (!error && data) setJornada(data as any);
  };

  const finalizar = async () => {
    if (!jornada) return;
    await supabase().from("jornadas").update({
      estado: "finalizada",
      hora_fin: new Date().toISOString(),
    }).eq("id", jornada.id);
    setJornada(null);
  };

  return (
    <div className="min-h-screen bg-[#FDF7FA]">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-semibold" style={{ color: "#0891b2" }}>GranizaTrack</h1>
          <p className="text-xs text-gray-500">{usuario.nombre} · trabajador</p>
        </div>
        <button onClick={onSignOut} className="text-sm text-gray-500">Salir</button>
      </header>

      <div className="px-4 py-2 flex gap-2 border-b border-gray-200 bg-white">
        {[
          { k: "jornada", label: "Jornada" },
          { k: "ventas", label: "Ventas" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-3 py-1.5 rounded-full text-sm ${tab === t.k ? "bg-[#AEE6F9]" : "bg-gray-100"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-4 space-y-4">
        {tab === "jornada" && (
          <>
            {loading ? <div>Cargando...</div> : (
              <>
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

                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <h3 className="font-medium">Jornada</h3>
                  {jornada ? (
                    <>
                      <div className="text-sm">
                        Iniciada: {new Date(jornada.hora_inicio).toLocaleString()}
                      </div>
                      <div className={`text-sm px-3 py-2 rounded-lg ${gps.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                        {gps.error ? `GPS error: ${gps.error}` : "📡 GPS activo"}
                        {gps.lat && gps.lng && (
                          <div className="text-xs mt-1">
                            {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · {gps.lastAt?.toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                      <button onClick={finalizar} className="w-full py-2.5 rounded-lg bg-[#F8C8DC] font-medium">
                        Finalizar jornada
                      </button>
                    </>
                  ) : (
                    <button onClick={iniciar} disabled={!asignacion}
                      className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
                      style={{ backgroundColor: "#0891b2" }}>
                      Iniciar jornada
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {tab === "ventas" && (
          <Ventas usuario={usuario} jornadaActiva={jornada ? { id: jornada.id, carretilla_id: jornada.carretilla_id } : null} />
        )}
      </main>
    </div>
  );
}
