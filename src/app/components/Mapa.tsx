import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapView, RutaItem, colorForIndex } from "./MapView";

export function Mapa() {
  const [rutas, setRutas] = useState<RutaItem[]>([]);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();
    const { data: jornadas } = await sb
      .from("jornadas")
      .select("id, trabajador_id, carretilla_id, estado, hora_inicio, hora_fin")
      .eq("estado", "activa");

    if (!jornadas || jornadas.length === 0) {
      setRutas([]);
      setLoading(false);
      return;
    }

    const trabIds = [...new Set(jornadas.map((j: any) => j.trabajador_id))];
    const carrIds = [...new Set(jornadas.map((j: any) => j.carretilla_id))];

    const [{ data: trabajadores }, { data: carretillas }] = await Promise.all([
      sb.from("usuarios").select("id, nombre").in("id", trabIds),
      sb.from("carretillas").select("id, codigo").in("id", carrIds),
    ]);

    const tMap = new Map((trabajadores ?? []).map((t: any) => [t.id, t.nombre]));
    const cMap = new Map((carretillas ?? []).map((c: any) => [c.id, c.codigo]));

    const result: RutaItem[] = [];
    for (let i = 0; i < jornadas.length; i++) {
      const j: any = jornadas[i];
      const { data: ubis } = await sb
        .from("ubicaciones")
        .select("latitud, longitud, timestamp")
        .eq("jornada_id", j.id)
        .order("timestamp", { ascending: true });
      const puntos: [number, number][] = (ubis ?? []).map((u: any) => [Number(u.latitud), Number(u.longitud)]);
      result.push({
        id: j.id,
        color: colorForIndex(i),
        puntos,
        carretillaCodigo: cMap.get(j.carretilla_id) ?? "—",
        trabajadorNombre: tMap.get(j.trabajador_id) ?? "—",
        estado: j.estado,
        horaInicio: j.hora_inicio,
        horaFin: j.hora_fin,
      });
    }
    setRutas(result);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, []);

  const visibles = seleccion ? rutas.filter((r) => r.id === seleccion) : rutas;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <h2 className="text-xl font-semibold mr-2">Mapa en tiempo real</h2>
        <button
          onClick={() => setSeleccion(null)}
          className={`px-3 py-1.5 rounded-full text-sm border ${!seleccion ? "bg-[#AEE6F9] border-[#AEE6F9]" : "bg-white border-gray-200"}`}>
          Todas ({rutas.length})
        </button>
        {rutas.map((r) => (
          <button key={r.id} onClick={() => setSeleccion(r.id)}
            className={`px-3 py-1.5 rounded-full text-sm border flex items-center gap-2 ${seleccion === r.id ? "border-gray-800" : "border-gray-200 bg-white"}`}>
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
            {r.carretillaCodigo} · {r.trabajadorNombre}
          </button>
        ))}
        <button onClick={cargar} className="ml-auto px-3 py-1.5 rounded-full text-sm bg-[#F8C8DC]">Actualizar</button>
      </div>
      {rutas.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-2xl text-sm">
          No hay jornadas activas en este momento
        </div>
      )}
      <div style={{ height: "calc(100vh - 240px)", minHeight: 400 }}>
        <MapView rutas={visibles} fallbackCenter={[15.7835, -90.2308]} fallbackZoom={7} />
      </div>
    </div>
  );
}
