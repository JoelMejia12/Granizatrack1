import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Venta = {
  id: string;
  trabajador_id: string;
  carretilla_id: string;
  jornada_id: string;
  total: number;
  nota: string | null;
  created_at: string;
};
type Detalle = {
  id: string;
  venta_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
};

export function VentasAdmin() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [trabajadores, setTrabajadores] = useState<{ id: string; nombre: string; rol: string }[]>([]);
  const [carretillas, setCarretillas] = useState<{ id: string; codigo: string }[]>([]);
  const [productos, setProductos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<{ venta: Venta; lineas: Detalle[] } | null>(null);

  const [fTrabajador, setFTrabajador] = useState("");
  const [fCarretilla, setFCarretilla] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const cargarBase = async () => {
    const sb = supabase();
    const [u, c, p] = await Promise.all([
      sb.from("usuarios").select("id, nombre, rol"),
      sb.from("carretillas").select("id, codigo").order("codigo"),
      sb.from("productos").select("id, nombre"),
    ]);
    setTrabajadores((u.data ?? []) as any);
    setCarretillas((c.data ?? []) as any);
    setProductos(Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.nombre])));
  };

  const cargarVentas = async () => {
    setLoading(true);
    const sb = supabase();
    let q = sb.from("ventas").select("*").order("created_at", { ascending: false }).limit(500);
    if (fTrabajador) q = q.eq("trabajador_id", fTrabajador);
    if (fCarretilla) q = q.eq("carretilla_id", fCarretilla);
    if (fDesde) q = q.gte("created_at", new Date(`${fDesde}T00:00:00`).toISOString());
    if (fHasta) q = q.lte("created_at", new Date(`${fHasta}T23:59:59`).toISOString());
    const { data } = await q;
    setVentas((data ?? []) as Venta[]);
    setLoading(false);
  };

  useEffect(() => { cargarBase(); }, []);
  useEffect(() => { cargarVentas(); }, [fTrabajador, fCarretilla, fDesde, fHasta]);

  const trabMap = useMemo(() => Object.fromEntries(trabajadores.map((t) => [t.id, t.nombre])), [trabajadores]);
  const carrMap = useMemo(() => Object.fromEntries(carretillas.map((c) => [c.id, c.codigo])), [carretillas]);
  const trabajadoresList = useMemo(() => trabajadores.filter((t) => t.rol === "trabajador"), [trabajadores]);

  const limpiar = () => {
    setFTrabajador("");
    setFCarretilla("");
    setFDesde("");
    setFHasta("");
  };

  const verDetalle = async (v: Venta) => {
    const { data } = await supabase().from("detalle_ventas").select("*").eq("venta_id", v.id);
    setDetalle({ venta: v, lineas: (data ?? []) as Detalle[] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ventas</h2>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid md:grid-cols-5 gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500">Trabajador</label>
          <select value={fTrabajador} onChange={(e) => setFTrabajador(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-gray-200">
            <option value="">Todos</option>
            {trabajadoresList.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Carretilla</label>
          <select value={fCarretilla} onChange={(e) => setFCarretilla(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-gray-200">
            <option value="">Todas</option>
            {carretillas.map((c) => <option key={c.id} value={c.id}>{c.codigo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Desde</label>
          <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-gray-200" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Hasta</label>
          <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)}
            className="w-full px-2 py-2 rounded-lg border border-gray-200" />
        </div>
        <button onClick={limpiar} className="px-3 py-2 rounded-lg bg-[#F8C8DC] text-sm">Limpiar filtros</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Cargando...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Trabajador</th>
                <th className="px-4 py-2">Carretilla</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Nota</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{new Date(v.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{trabMap[v.trabajador_id] ?? "—"}</td>
                  <td className="px-4 py-2">{carrMap[v.carretilla_id] ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold">{Number(v.total).toFixed(2)}</td>
                  <td className="px-4 py-2 text-gray-500">{v.nota ?? ""}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => verDetalle(v)} className="text-[#0891b2]">Ver detalle</button>
                  </td>
                </tr>
              ))}
              {ventas.length === 0 && <tr><td colSpan={6} className="text-center text-gray-500 py-6">Sin ventas</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {detalle && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setDetalle(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Detalle de venta</h3>
            <div className="text-sm text-gray-600">
              {new Date(detalle.venta.created_at).toLocaleString()} · {trabMap[detalle.venta.trabajador_id]} · {carrMap[detalle.venta.carretilla_id]}
            </div>
            {detalle.venta.nota && <div className="text-sm bg-gray-50 px-3 py-2 rounded-lg">Nota: {detalle.venta.nota}</div>}
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr><th>Producto</th><th className="text-right">Cant</th><th className="text-right">P.U.</th><th className="text-right">Subtotal</th></tr>
              </thead>
              <tbody>
                {detalle.lineas.map((l) => (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="py-1">{productos[l.producto_id] ?? "—"}</td>
                    <td className="text-right">{l.cantidad}</td>
                    <td className="text-right">{Number(l.precio_unitario).toFixed(2)}</td>
                    <td className="text-right">{Number(l.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold">
                  <td colSpan={3} className="py-2 text-right">Total</td>
                  <td className="text-right">{Number(detalle.venta.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="flex justify-end">
              <button onClick={() => setDetalle(null)} className="px-3 py-2 rounded-lg bg-gray-100">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
