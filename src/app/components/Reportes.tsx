import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

type Venta = { id: string; trabajador_id: string; carretilla_id: string; jornada_id: string; total: number; nota: string | null; created_at: string };
type Detalle = { id: string; venta_id: string; producto_id: string; cantidad: number; precio_unitario: number; subtotal: number };

export function Reportes() {
  const today = new Date().toISOString().slice(0, 10);
  const ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(ago);
  const [hasta, setHasta] = useState(today);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [carretillaId, setCarretillaId] = useState("");
  const [productoId, setProductoId] = useState("");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [detalles, setDetalles] = useState<Detalle[]>([]);
  const [trabajadores, setTrabajadores] = useState<{ id: string; nombre: string }[]>([]);
  const [carretillas, setCarretillas] = useState<{ id: string; codigo: string }[]>([]);
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([]);

  useEffect(() => {
    const sb = supabase();
    sb.from("usuarios").select("id, nombre").then(({ data }) => setTrabajadores((data ?? []) as any));
    sb.from("carretillas").select("id, codigo").then(({ data }) => setCarretillas((data ?? []) as any));
    sb.from("productos").select("id, nombre").then(({ data }) => setProductos((data ?? []) as any));
  }, []);

  const cargar = async () => {
    const sb = supabase();
    const desdeIso = new Date(`${desde}T00:00:00`).toISOString();
    const hastaIso = new Date(`${hasta}T23:59:59`).toISOString();
    let q = sb.from("ventas").select("*").gte("created_at", desdeIso).lte("created_at", hastaIso);
    if (trabajadorId) q = q.eq("trabajador_id", trabajadorId);
    if (carretillaId) q = q.eq("carretilla_id", carretillaId);
    const { data: vs } = await q;
    const ventasArr = (vs ?? []) as Venta[];
    setVentas(ventasArr);
    if (ventasArr.length === 0) {
      setDetalles([]);
      return;
    }
    const ids = ventasArr.map((v) => v.id);
    let dq = sb.from("detalle_ventas").select("*").in("venta_id", ids);
    if (productoId) dq = dq.eq("producto_id", productoId);
    const { data: ds } = await dq;
    setDetalles((ds ?? []) as Detalle[]);
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const ventasFiltradas = useMemo(() => {
    if (!productoId) return ventas;
    const ids = new Set(detalles.map((d) => d.venta_id));
    return ventas.filter((v) => ids.has(v.id));
  }, [ventas, detalles, productoId]);

  const totalVendido = ventasFiltradas.reduce((s, v) => s + Number(v.total), 0);
  const totalVentas = ventasFiltradas.length;

  const productoMap = new Map(productos.map((p) => [p.id, p.nombre]));
  const trabMap = new Map(trabajadores.map((t) => [t.id, t.nombre]));
  const carrMap = new Map(carretillas.map((c) => [c.id, c.codigo]));

  const ventasPorProducto = useMemo(() => {
    const m: Record<string, number> = {};
    detalles.forEach((d) => {
      m[d.producto_id] = (m[d.producto_id] ?? 0) + Number(d.subtotal);
    });
    return Object.entries(m).map(([id, total]) => ({ name: productoMap.get(id) ?? id.slice(0, 6), total })).sort((a, b) => b.total - a.total);
  }, [detalles, productos]);

  const productoTop = ventasPorProducto[0]?.name ?? "—";

  const porTrabajador = useMemo(() => {
    const m: Record<string, number> = {};
    ventasFiltradas.forEach((v) => { m[v.trabajador_id] = (m[v.trabajador_id] ?? 0) + Number(v.total); });
    return Object.entries(m).map(([id, total]) => ({ id, nombre: trabMap.get(id) ?? id, total })).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas, trabajadores]);

  const porCarretilla = useMemo(() => {
    const m: Record<string, number> = {};
    ventasFiltradas.forEach((v) => { m[v.carretilla_id] = (m[v.carretilla_id] ?? 0) + Number(v.total); });
    return Object.entries(m).map(([id, total]) => ({ id, codigo: carrMap.get(id) ?? id, total })).sort((a, b) => b.total - a.total);
  }, [ventasFiltradas, carretillas]);

  const ventasPorDia = useMemo(() => {
    const m: Record<string, number> = {};
    ventasFiltradas.forEach((v) => {
      const d = v.created_at.slice(0, 10);
      m[d] = (m[d] ?? 0) + Number(v.total);
    });
    return Object.entries(m).map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [ventasFiltradas]);

  const exportCSV = () => {
    const rows = [
      ["fecha", "trabajador", "carretilla", "total", "nota"],
      ...ventasFiltradas.map((v) => [
        v.created_at,
        trabMap.get(v.trabajador_id) ?? v.trabajador_id,
        carrMap.get(v.carretilla_id) ?? v.carretilla_id,
        String(v.total),
        v.nota ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Reportes</h2>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 grid md:grid-cols-6 gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Trabajador</label>
          <select value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200">
            <option value="">Todos</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Carretilla</label>
          <select value={carretillaId} onChange={(e) => setCarretillaId(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200">
            <option value="">Todas</option>
            {carretillas.map((c) => <option key={c.id} value={c.id}>{c.codigo}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Producto</label>
          <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="w-full px-2 py-2 rounded-lg border border-gray-200">
            <option value="">Todos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <button onClick={cargar} className="px-3 py-2 rounded-lg text-white" style={{ backgroundColor: "#0891b2" }}>
          Aplicar
        </button>
      </div>

      <div className="grid md:grid-cols-5 gap-3">
        {[
          { label: "Total vendido", value: totalVendido.toFixed(2) },
          { label: "N° Ventas", value: String(totalVentas) },
          { label: "Producto top", value: productoTop },
          { label: "Trabajador top", value: porTrabajador[0]?.nombre ?? "—" },
          { label: "Carretilla top", value: porCarretilla[0]?.codigo ?? "—" },
        ].map((m) => (
          <div key={m.label} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className="text-lg font-semibold mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Ventas por producto</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={ventasPorProducto}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#AEE6F9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Ventas por día</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ventasPorDia}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="fecha" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#db2777" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Por trabajador</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Nombre</th><th className="text-right">Total</th></tr></thead>
            <tbody>{porTrabajador.map((r) => (
              <tr key={r.id} className="border-t border-gray-100"><td className="py-1">{r.nombre}</td><td className="text-right">{r.total.toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Por carretilla</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500"><th>Código</th><th className="text-right">Total</th></tr></thead>
            <tbody>{porCarretilla.map((r) => (
              <tr key={r.id} className="border-t border-gray-100"><td className="py-1">{r.codigo}</td><td className="text-right">{r.total.toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <button onClick={exportCSV} className="px-4 py-2 rounded-lg bg-[#F8C8DC]">Exportar CSV</button>
    </div>
  );
}
