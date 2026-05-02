import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import ExcelJS from "exceljs";

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
    return Object.entries(m)
      .map(([fecha, total]) => {
        const [, mm, dd] = fecha.split("-");
        return { fecha: `${dd}/${mm}`, total: Number(total.toFixed(2)) };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [ventasFiltradas]);

  const sinDatos = ventasFiltradas.length === 0;

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GranizaTrack";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Reporte Ventas");

    // ── Columnas ──────────────────────────────────────────────
    sheet.columns = [
      { header: "Fecha",           key: "fecha",          width: 14 },
      { header: "Trabajador",      key: "trabajador",     width: 22 },
      { header: "Carretilla",      key: "carretilla",     width: 14 },
      { header: "Producto",        key: "producto",       width: 24 },
      { header: "Cantidad",        key: "cantidad",       width: 11 },
      { header: "Precio Unitario", key: "precio_unitario",width: 16 },
      { header: "Total",           key: "total",          width: 14 },
      { header: "Nota",            key: "nota",           width: 28 },
    ];

    // ── Estilo encabezados ────────────────────────────────────
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top:    { style: "thin", color: { argb: "FFAAAAAA" } },
        left:   { style: "thin", color: { argb: "FFAAAAAA" } },
        bottom: { style: "thin", color: { argb: "FFAAAAAA" } },
        right:  { style: "thin", color: { argb: "FFAAAAAA" } },
      };
    });
    headerRow.height = 20;

    // ── Datos ─────────────────────────────────────────────────
    const ordenadas = [...ventasFiltradas].sort((a, b) => b.created_at.localeCompare(a.created_at));
    let cantidadTotal = 0;

    for (const v of ordenadas) {
      const fecha = new Date(v.created_at);
      const dd = String(fecha.getDate()).padStart(2, "0");
      const mm = String(fecha.getMonth() + 1).padStart(2, "0");
      const yyyy = fecha.getFullYear();
      const fechaStr = `${dd}/${mm}/${yyyy}`;

      const ventaDetalles = detalles.filter((d) => d.venta_id === v.id);

      if (ventaDetalles.length === 0) {
        // venta sin detalle de producto
        const row = sheet.addRow({
          fecha:          fechaStr,
          trabajador:     trabMap.get(v.trabajador_id) ?? v.trabajador_id,
          carretilla:     carrMap.get(v.carretilla_id) ?? v.carretilla_id,
          producto:       "—",
          cantidad:       "",
          precio_unitario:"",
          total:          Number(v.total),
          nota:           v.nota ?? "-",
        });
        styleDataRow(row);
      } else {
        for (const d of ventaDetalles) {
          cantidadTotal += Number(d.cantidad);
          const row = sheet.addRow({
            fecha:          fechaStr,
            trabajador:     trabMap.get(v.trabajador_id) ?? v.trabajador_id,
            carretilla:     carrMap.get(v.carretilla_id) ?? v.carretilla_id,
            producto:       productoMap.get(d.producto_id) ?? d.producto_id,
            cantidad:       Number(d.cantidad),
            precio_unitario:Number(d.precio_unitario),
            total:          Number(d.subtotal),
            nota:           v.nota ?? "-",
          });
          styleDataRow(row);
        }
      }
    }

    // ── Fila de resumen ───────────────────────────────────────
    const lastDataRow = sheet.lastRow?.number ?? 1;
    const summaryRow = sheet.addRow({
      fecha:          "TOTALES",
      trabajador:     "",
      carretilla:     "",
      producto:       "",
      cantidad:       cantidadTotal,
      precio_unitario:"",
      total:          totalVendido,
      nota:           "",
    });
    summaryRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, size: 11, color: { argb: "FF1E3A8A" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
      cell.border = {
        top:    { style: "medium", color: { argb: "FF1E3A8A" } },
        left:   { style: "thin",   color: { argb: "FFAAAAAA" } },
        bottom: { style: "thin",   color: { argb: "FFAAAAAA" } },
        right:  { style: "thin",   color: { argb: "FFAAAAAA" } },
      };
      if (colNumber === 6 || colNumber === 7) {
        cell.numFmt = '"Q"#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (colNumber === 5) {
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "left" };
      }
    });
    summaryRow.height = 20;

    // ── Descargar ─────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte_ventas.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  function styleDataRow(row: ExcelJS.Row) {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top:    { style: "thin", color: { argb: "FFDDDDDD" } },
        left:   { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right:  { style: "thin", color: { argb: "FFDDDDDD" } },
      };
      cell.font = { size: 10 };
      if (colNumber === 6 || colNumber === 7) {
        cell.numFmt = '"Q"#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (colNumber === 5) {
        cell.alignment = { horizontal: "right" };
      } else {
        cell.alignment = { horizontal: "left", wrapText: false };
      }
    });
    row.height = 16;
  }

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
          {ventasPorProducto.length === 0 ? (
            <div className="text-sm text-gray-500 py-12 text-center">Sin datos</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const max = Math.max(...ventasPorProducto.map((p) => p.total), 1);
                return ventasPorProducto.map((p) => (
                  <div key={p.name} className="text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="truncate">{p.name}</span>
                      <span className="text-gray-500">{p.total.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(p.total / max) * 100}%`, backgroundColor: "#AEE6F9" }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="font-medium mb-2">Ventas por día</h3>
          {ventasPorDia.length === 0 ? (
            <div className="text-sm text-gray-500 py-12 text-center">No hay ventas en el rango seleccionado</div>
          ) : (
            <div className="flex items-end justify-center gap-3 h-56 px-2 border-b border-l border-gray-200">
              {(() => {
                const max = Math.max(...ventasPorDia.map((v) => v.total), 1);
                return ventasPorDia.map((v) => (
                  <div key={v.fecha} className="flex flex-col items-center justify-end h-full" style={{ width: 40 }} title={`${v.fecha}: ${v.total.toFixed(2)}`}>
                    <div className="text-[10px] text-gray-500 mb-1">{v.total.toFixed(0)}</div>
                    <div className="w-full rounded-t" style={{ height: `${(v.total / max) * 90}%`, backgroundColor: "#AEE6F9", minHeight: v.total > 0 ? 2 : 0 }} />
                    <div className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">{v.fecha}</div>
                  </div>
                ));
              })()}
            </div>
          )}
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

      {sinDatos && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-2xl text-sm text-center">
          No hay ventas en el rango seleccionado
        </div>
      )}

      <button onClick={exportExcel} disabled={sinDatos} className="px-4 py-2 rounded-lg bg-[#F8C8DC] disabled:opacity-50 disabled:cursor-not-allowed">Exportar reporte</button>
    </div>
  );
}