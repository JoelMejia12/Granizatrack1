import { useEffect, useState } from "react";
import { supabase, Usuario } from "../lib/supabase";

type Producto = { id: string; nombre: string; activo: boolean };
type LineaVenta = { producto_id: string; cantidad: number; precio_unitario: number };
type Venta = {
  id: string;
  trabajador_id: string;
  carretilla_id: string;
  jornada_id: string;
  total: number;
  nota: string | null;
  created_at: string;
};

export function Ventas({ usuario, jornadaActiva }: { usuario: Usuario; jornadaActiva: { id: string; carretilla_id: string } | null }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lineas, setLineas] = useState<LineaVenta[]>([]);
  const [nota, setNota] = useState("");
  const [historial, setHistorial] = useState<Venta[]>([]);
  const [productosMap, setProductosMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = usuario.rol === "admin";

  const cargarProductos = async () => {
    const { data } = await supabase().from("productos").select("id, nombre, activo").eq("activo", true).order("nombre");
    const list = (data ?? []) as Producto[];
    setProductos(list);
    const m: Record<string, string> = {};
    list.forEach((p) => (m[p.id] = p.nombre));
    setProductosMap(m);
  };

  const cargarHistorial = async () => {
    let q = supabase()
      .from("ventas")
      .select("id, trabajador_id, carretilla_id, jornada_id, total, nota, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!isAdmin) q = q.eq("trabajador_id", usuario.id);
    const { data } = await q;
    setHistorial((data ?? []) as Venta[]);
  };

  useEffect(() => {
    cargarProductos();
    cargarHistorial();
  }, []);

  const total = lineas.reduce((s, l) => s + l.cantidad * l.precio_unitario, 0);

  const addLinea = () => {
    if (productos.length === 0) return;
    setLineas([...lineas, { producto_id: productos[0].id, cantidad: 1, precio_unitario: 0 }]);
  };

  const updLinea = (i: number, patch: Partial<LineaVenta>) => {
    setLineas(lineas.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const remLinea = (i: number) => setLineas(lineas.filter((_, idx) => idx !== i));

  const registrar = async () => {
    setError("");
    if (!jornadaActiva) {
      setError("Necesitas una jornada activa para registrar ventas");
      return;
    }
    if (lineas.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }
    if (lineas.some((l) => l.cantidad <= 0 || l.precio_unitario <= 0)) {
      setError("Cantidad y precio deben ser mayores a 0");
      return;
    }
    setSaving(true);
    try {
      const sb = supabase();
      const { data: venta, error: vErr } = await sb
        .from("ventas")
        .insert({
          trabajador_id: usuario.id,
          carretilla_id: jornadaActiva.carretilla_id,
          jornada_id: jornadaActiva.id,
          total,
          nota: nota || null,
        })
        .select()
        .single();
      if (vErr) throw vErr;
      const detalles = lineas.map((l) => ({
        venta_id: venta.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.cantidad * l.precio_unitario,
      }));
      const { error: dErr } = await sb.from("detalle_ventas").insert(detalles);
      if (dErr) throw dErr;
      setLineas([]);
      setNota("");
      await cargarHistorial();
    } catch (e: any) {
      setError(e.message ?? "Error registrando venta");
    } finally {
      setSaving(false);
    }
  };

  const [nuevoProducto, setNuevoProducto] = useState("");
  const crearProducto = async () => {
    if (!nuevoProducto.trim()) return;
    await supabase().from("productos").insert({ nombre: nuevoProducto.trim(), activo: true });
    setNuevoProducto("");
    await cargarProductos();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Ventas</h2>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Productos</h3>
          <div className="flex gap-2 mb-2">
            <input value={nuevoProducto} onChange={(e) => setNuevoProducto(e.target.value)}
              placeholder="Nombre del producto"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200" />
            <button onClick={crearProducto} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#0891b2" }}>
              Crear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {productos.map((p) => (
              <span key={p.id} className="px-3 py-1 rounded-full text-sm bg-[#AEE6F9]/40">{p.nombre}</span>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <h3 className="font-medium">Nueva venta</h3>
          {!jornadaActiva && (
            <div className="text-sm bg-yellow-50 text-yellow-800 px-3 py-2 rounded-lg">
              Inicia una jornada antes de registrar ventas.
            </div>
          )}
          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={l.producto_id} onChange={(e) => updLinea(i, { producto_id: e.target.value })}
                  className="col-span-5 px-2 py-2 rounded-lg border border-gray-200">
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
                <input type="number" min="1" value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: Number(e.target.value) })}
                  placeholder="Cant"
                  className="col-span-2 px-2 py-2 rounded-lg border border-gray-200" />
                <input type="number" min="0" step="0.01" value={l.precio_unitario}
                  onChange={(e) => updLinea(i, { precio_unitario: Number(e.target.value) })}
                  placeholder="Precio"
                  className="col-span-3 px-2 py-2 rounded-lg border border-gray-200" />
                <div className="col-span-1 text-sm text-right">{(l.cantidad * l.precio_unitario).toFixed(2)}</div>
                <button onClick={() => remLinea(i)} className="col-span-1 text-red-500">✕</button>
              </div>
            ))}
            <button onClick={addLinea} disabled={productos.length === 0}
              className="px-3 py-2 rounded-lg bg-[#F8C8DC]/50 text-sm">+ Producto</button>
          </div>
          <input value={nota} onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (ej: extra leche, más jarabe)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200" />
          <div className="flex justify-between items-center">
            <div className="text-lg font-semibold">Total: {total.toFixed(2)}</div>
            <button onClick={registrar} disabled={saving || !jornadaActiva || lineas.length === 0}
              className="px-4 py-2 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "#0891b2" }}>
              {saving ? "Guardando..." : "Registrar venta"}
            </button>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <h3 className="font-medium mb-2">Historial de ventas</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {historial.length === 0 && <div className="text-sm text-gray-500">Sin ventas</div>}
          {historial.map((v) => (
            <div key={v.id} className="flex justify-between text-sm border-b border-gray-100 py-2">
              <div>
                <div className="font-medium">{new Date(v.created_at).toLocaleString()}</div>
                {v.nota && <div className="text-xs text-gray-500">{v.nota}</div>}
              </div>
              <div className="font-semibold">{Number(v.total).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
