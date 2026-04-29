import { useEffect, useState } from "react";
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
  const [trabajadores, setTrabajadores] = useState<Record<string, string>>({});
  const [carretillas, setCarretillas] = useState<Record<string, string>>({});
  const [productos, setProductos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<{ venta: Venta; lineas: Detalle[] } | null>(null);

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();
    const [v, u, c, p] = await Promise.all([
      sb.from("ventas").select("*").order("created_at", { ascending: false }).limit(200),
      sb.from("usuarios").select("id, nombre"),
      sb.from("carretillas").select("id, codigo"),
      sb.from("productos").select("id, nombre"),
    ]);
    setVentas((v.data ?? []) as Venta[]);
    setTrabajadores(Object.fromEntries((u.data ?? []).map((x: any) => [x.id, x.nombre])));
    setCarretillas(Object.fromEntries((c.data ?? []).map((x: any) => [x.id, x.codigo])));
    setProductos(Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.nombre])));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const verDetalle = async (v: Venta) => {
    const { data } = await supabase().from("detalle_ventas").select("*").eq("venta_id", v.id);
    setDetalle({ venta: v, lineas: (data ?? []) as Detalle[] });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ventas</h2>
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
                  <td className="px-4 py-2">{trabajadores[v.trabajador_id] ?? "—"}</td>
                  <td className="px-4 py-2">{carretillas[v.carretilla_id] ?? "—"}</td>
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
              {new Date(detalle.venta.created_at).toLocaleString()} · {trabajadores[detalle.venta.trabajador_id]} · {carretillas[detalle.venta.carretilla_id]}
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
