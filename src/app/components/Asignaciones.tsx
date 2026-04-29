import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Asignacion = { id: string; trabajador_id: string; carretilla_id: string; activa: boolean };
type Trabajador = { id: string; nombre: string; activo: boolean; rol: string };
type Carretilla = { id: string; codigo: string; estado: string };

export function Asignaciones() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [carretillas, setCarretillas] = useState<Carretilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevo, setNuevo] = useState<{ trabajador_id: string; carretilla_id: string } | null>(null);
  const [error, setError] = useState("");

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();
    const [a, t, c] = await Promise.all([
      sb.from("asignaciones").select("id, trabajador_id, carretilla_id, activa").order("activa", { ascending: false }),
      sb.from("usuarios").select("id, nombre, activo, rol"),
      sb.from("carretillas").select("id, codigo, estado"),
    ]);
    setAsignaciones((a.data ?? []) as Asignacion[]);
    setTrabajadores((t.data ?? []) as Trabajador[]);
    setCarretillas((c.data ?? []) as Carretilla[]);
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const tMap = new Map(trabajadores.map((t) => [t.id, t.nombre]));
  const cMap = new Map(carretillas.map((c) => [c.id, c.codigo]));

  const trabajadoresElegibles = trabajadores.filter((t) => t.activo && t.rol === "trabajador");
  const carretillasElegibles = carretillas.filter((c) => c.estado === "disponible");

  const crear = async () => {
    if (!nuevo?.trabajador_id || !nuevo?.carretilla_id) return;
    setError("");
    const yaActiva = asignaciones.find((a) => a.activa && a.carretilla_id === nuevo.carretilla_id);
    if (yaActiva) {
      setError("Esta carretilla ya tiene una asignación activa");
      return;
    }
    const { error: e1 } = await supabase().from("asignaciones").insert({
      trabajador_id: nuevo.trabajador_id,
      carretilla_id: nuevo.carretilla_id,
      activa: true,
    });
    if (e1) { setError(e1.message); return; }
    setNuevo(null);
    cargar();
  };

  const desactivar = async (a: Asignacion) => {
    await supabase().from("asignaciones").update({ activa: false }).eq("id", a.id);
    cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Asignaciones</h2>
        <button onClick={() => setNuevo({ trabajador_id: "", carretilla_id: "" })}
          className="px-3 py-1.5 rounded-lg bg-[#AEE6F9] text-sm">+ Nueva</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Cargando...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Trabajador</th>
                <th className="px-4 py-2">Carretilla</th>
                <th className="px-4 py-2">Activa</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {asignaciones.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{tMap.get(a.trabajador_id) ?? a.trabajador_id}</td>
                  <td className="px-4 py-2">{cMap.get(a.carretilla_id) ?? a.carretilla_id}</td>
                  <td className="px-4 py-2">{a.activa ? "✓" : "✗"}</td>
                  <td className="px-4 py-2 text-right">
                    {a.activa && <button onClick={() => desactivar(a)} className="text-red-500">Desactivar</button>}
                  </td>
                </tr>
              ))}
              {asignaciones.length === 0 && <tr><td colSpan={4} className="text-center text-gray-500 py-6">Sin asignaciones</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {nuevo && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setNuevo(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Nueva asignación</h3>
            <div>
              <label className="text-xs text-gray-500">Trabajador (activos)</label>
              <select value={nuevo.trabajador_id} onChange={(e) => setNuevo({ ...nuevo, trabajador_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                <option value="">Selecciona...</option>
                {trabajadoresElegibles.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Carretilla (disponibles)</label>
              <select value={nuevo.carretilla_id} onChange={(e) => setNuevo({ ...nuevo, carretilla_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                <option value="">Selecciona...</option>
                {carretillasElegibles.map((c) => <option key={c.id} value={c.id}>{c.codigo}</option>)}
              </select>
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setNuevo(null)} className="px-3 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button onClick={crear} className="px-3 py-2 rounded-lg text-white" style={{ backgroundColor: "#0891b2" }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
