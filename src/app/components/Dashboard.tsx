import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { MapView, RutaItem, colorForIndex } from "./MapView";

type Carretilla = { id: string; codigo: string; estado: string };
type Usuario = { id: string; nombre: string; activo: boolean; rol: string };
type Jornada = { id: string; trabajador_id: string; carretilla_id: string; estado: string; hora_inicio: string };
type Venta = { id: string; trabajador_id: string; carretilla_id: string; total: number; nota: string | null; created_at: string };
type Detalle = { venta_id: string; producto_id: string; cantidad: number; subtotal: number };

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [carretillas, setCarretillas] = useState<Carretilla[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [jornadasActivas, setJornadasActivas] = useState<Jornada[]>([]);
  const [ventasHoy, setVentasHoy] = useState<Venta[]>([]);
  const [todasVentas, setTodasVentas] = useState<Venta[]>([]);
  const [detallesHoy, setDetallesHoy] = useState<Detalle[]>([]);
  const [productosMap, setProductosMap] = useState<Record<string, string>>({});
  const [rutasActivas, setRutasActivas] = useState<RutaItem[]>([]);

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    const [c, u, ja, vh, vt, p] = await Promise.all([
      sb.from("carretillas").select("id, codigo, estado").order("codigo"),
      sb.from("usuarios").select("id, nombre, activo, rol"),
      sb.from("jornadas").select("id, trabajador_id, carretilla_id, estado, hora_inicio").eq("estado", "activa"),
      sb.from("ventas").select("*").gte("created_at", startToday.toISOString()).lte("created_at", endToday.toISOString()),
      sb.from("ventas").select("id, trabajador_id, carretilla_id, total, nota, created_at").order("created_at", { ascending: false }).limit(8),
      sb.from("productos").select("id, nombre"),
    ]);

    const carretillasArr = (c.data ?? []) as Carretilla[];
    const usuariosArr = (u.data ?? []) as Usuario[];
    const jornadasArr = (ja.data ?? []) as Jornada[];
    const ventasHoyArr = (vh.data ?? []) as Venta[];
    setCarretillas(carretillasArr);
    setUsuarios(usuariosArr);
    setJornadasActivas(jornadasArr);
    setVentasHoy(ventasHoyArr);
    setTodasVentas((vt.data ?? []) as Venta[]);
    setProductosMap(Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.nombre])));

    if (ventasHoyArr.length > 0) {
      const ids = ventasHoyArr.map((v) => v.id);
      const { data: ds } = await sb.from("detalle_ventas").select("venta_id, producto_id, cantidad, subtotal").in("venta_id", ids);
      setDetallesHoy((ds ?? []) as Detalle[]);
    } else {
      setDetallesHoy([]);
    }

    const tMap = new Map(usuariosArr.map((x) => [x.id, x.nombre]));
    const cMap = new Map(carretillasArr.map((x) => [x.id, x.codigo]));
    const rutas: RutaItem[] = [];
    for (let i = 0; i < jornadasArr.length; i++) {
      const j = jornadasArr[i];
      const { data: ubis } = await sb
        .from("ubicaciones")
        .select("latitud, longitud, timestamp")
        .eq("jornada_id", j.id)
        .order("timestamp", { ascending: true });
      rutas.push({
        id: j.id,
        color: colorForIndex(i),
        puntos: (ubis ?? []).map((x: any) => [Number(x.latitud), Number(x.longitud)]),
        carretillaCodigo: cMap.get(j.carretilla_id) ?? "—",
        trabajadorNombre: tMap.get(j.trabajador_id) ?? "—",
        estado: j.estado,
        horaInicio: j.hora_inicio,
        horaFin: null,
      });
    }
    setRutasActivas(rutas);

    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, []);

  const tMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nombre])), [usuarios]);
  const jornadaPorCarretilla = useMemo(() => {
    const m: Record<string, Jornada> = {};
    jornadasActivas.forEach((j) => { m[j.carretilla_id] = j; });
    return m;
  }, [jornadasActivas]);

  const totalVentasHoy = ventasHoy.reduce((s, v) => s + Number(v.total), 0);
  const cantVentasHoy = ventasHoy.length;
  const cantCarretillasActivas = jornadasActivas.length;
  const trabajadoresActivosIds = new Set(jornadasActivas.map((j) => j.trabajador_id));

  const ventasPorHora = useMemo(() => {
    const buckets: Record<number, number> = {};
    for (let h = 0; h < 24; h++) buckets[h] = 0;
    ventasHoy.forEach((v) => {
      const h = new Date(v.created_at).getHours();
      buckets[h] += Number(v.total);
    });
    return Object.entries(buckets).map(([h, total]) => ({ hora: `${h}h`, total }));
  }, [ventasHoy]);

  const productosTopHoy = useMemo(() => {
    const m: Record<string, number> = {};
    detallesHoy.forEach((d) => { m[d.producto_id] = (m[d.producto_id] ?? 0) + Number(d.cantidad); });
    const used = new Set<string>();
    return Object.entries(m)
      .map(([id, cant]) => {
        let name = productosMap[id] ?? id.slice(0, 6);
        if (used.has(name)) name = `${name} (${id.slice(0, 4)})`;
        used.add(name);
        return { name, cant };
      })
      .sort((a, b) => b.cant - a.cant)
      .slice(0, 5);
  }, [detallesHoy, productosMap]);

  const cards = [
    { label: "Ventas del día", value: `Q ${totalVentasHoy.toFixed(2)}`, sub: `${cantVentasHoy} ventas`, color: "#AEE6F9" },
    { label: "Total ventas (hist.)", value: String(todasVentas.length > 0 ? "—" : "0"), sub: "Últimas registradas: " + todasVentas.length, color: "#F8C8DC" },
    { label: "Carretillas activas", value: String(cantCarretillasActivas), sub: `de ${carretillas.length} totales`, color: "#AEE6F9" },
    { label: "Trabajadores activos", value: String(trabajadoresActivosIds.size), sub: `con jornada abierta`, color: "#F8C8DC" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <button onClick={cargar} className="px-3 py-1.5 rounded-full text-sm bg-[#F8C8DC]">Actualizar</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div className="text-xs text-gray-500">{c.label}</div>
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
            </div>
            <div className="text-2xl font-semibold mt-2">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:col-span-2 space-y-2">
          <h3 className="font-medium">Estado de carretillas</h3>
          {loading ? <div className="text-sm text-gray-500">Cargando...</div> : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {carretillas.map((c) => {
                const j = jornadaPorCarretilla[c.id];
                const activa = !!j;
                return (
                  <div key={c.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${activa ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="font-medium">{c.codigo}</span>
                      <span className="text-xs text-gray-500">· {c.estado}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs">{j ? tMap.get(j.trabajador_id) ?? "—" : <span className="text-gray-400">sin asignar</span>}</div>
                      <div className={`text-xs ${activa ? "text-green-600" : "text-gray-400"}`}>{activa ? "activa" : "inactiva"}</div>
                    </div>
                  </div>
                );
              })}
              {carretillas.length === 0 && <div className="text-sm text-gray-500">Sin carretillas</div>}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Productos más vendidos (hoy)</h3>
          {productosTopHoy.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">Sin ventas hoy</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const max = Math.max(...productosTopHoy.map((p) => p.cant), 1);
                return productosTopHoy.map((p) => (
                  <div key={p.name} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-500">{p.cant}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.cant / max) * 100}%`, backgroundColor: "#F8C8DC" }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Ventas del día por hora</h3>
        {totalVentasHoy === 0 ? (
          <div className="text-sm text-gray-500 py-12 text-center">Sin ventas hoy</div>
        ) : (
          <div className="flex items-end gap-1 h-48 px-2 border-b border-l border-gray-200">
            {(() => {
              const max = Math.max(...ventasPorHora.map((v) => v.total), 1);
              return ventasPorHora.map((v) => (
                <div key={v.hora} className="flex-1 flex flex-col items-center justify-end h-full" title={`${v.hora}: Q ${v.total.toFixed(2)}`}>
                  <div className="w-full rounded-t" style={{ height: `${(v.total / max) * 100}%`, backgroundColor: "#AEE6F9", minHeight: v.total > 0 ? 2 : 0 }} />
                  <div className="text-[10px] text-gray-400 mt-1">{v.hora.replace("h", "")}</div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Últimas ventas</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {todasVentas.length === 0 && <div className="text-sm text-gray-500">Sin ventas registradas</div>}
            {todasVentas.map((v) => (
              <div key={v.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
                <div>
                  <div className="font-medium">{tMap.get(v.trabajador_id) ?? "—"}</div>
                  <div className="text-xs text-gray-500">{new Date(v.created_at).toLocaleString()}</div>
                </div>
                <div className="font-semibold">Q {Number(v.total).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Inicios de jornada (activas)</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {jornadasActivas.length === 0 && <div className="text-sm text-gray-500">Sin jornadas activas</div>}
            {jornadasActivas
              .slice()
              .sort((a, b) => b.hora_inicio.localeCompare(a.hora_inicio))
              .map((j) => {
                const carr = carretillas.find((c) => c.id === j.carretilla_id);
                return (
                  <div key={j.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
                    <div>
                      <div className="font-medium">{tMap.get(j.trabajador_id) ?? "—"}</div>
                      <div className="text-xs text-gray-500">{carr?.codigo ?? "—"}</div>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(j.hora_inicio).toLocaleString()}</div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Mini mapa</h3>
        <div style={{ height: 280 }}>
          <MapView rutas={rutasActivas} fallbackCenter={[15.7835, -90.2308]} fallbackZoom={7} />
        </div>
      </div>
    </div>
  );
}
