import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Producto = { id: string; nombre: string; activo: boolean };

export function Productos() {
  const [list, setList] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Producto> | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase().from("productos").select("id, nombre, activo").order("nombre");
    setList((data ?? []) as Producto[]);
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!edit?.nombre) return;
    const sb = supabase();
    if (edit.id) {
      await sb.from("productos").update({ nombre: edit.nombre, activo: edit.activo ?? true }).eq("id", edit.id);
    } else {
      await sb.from("productos").insert({ nombre: edit.nombre, activo: edit.activo ?? true });
    }
    setEdit(null);
    cargar();
  };

  const eliminar = async (p: Producto) => {
    if (!confirm(`¿Eliminar ${p.nombre}?`)) return;
    await supabase().from("productos").delete().eq("id", p.id);
    cargar();
  };

  const toggle = async (p: Producto) => {
    await supabase().from("productos").update({ activo: !p.activo }).eq("id", p.id);
    cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Productos</h2>
        <button onClick={() => setEdit({ nombre: "", activo: true })}
          className="px-3 py-1.5 rounded-lg bg-[#AEE6F9] text-sm">+ Nuevo</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Cargando...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-2">Nombre</th><th className="px-4 py-2">Activo</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{p.nombre}</td>
                  <td className="px-4 py-2">{p.activo ? "✓" : "✗"}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => setEdit({ ...p })} className="text-[#0891b2]">Editar</button>
                    <button onClick={() => toggle(p)} className="text-yellow-600">{p.activo ? "Desactivar" : "Activar"}</button>
                    <button onClick={() => eliminar(p)} className="text-red-500">Eliminar</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={3} className="text-center text-gray-500 py-6">Sin productos</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{edit.id ? "Editar" : "Nuevo"} producto</h3>
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input value={edit.nombre ?? ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.activo ?? true} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
              Activo
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEdit(null)} className="px-3 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button onClick={guardar} className="px-3 py-2 rounded-lg text-white" style={{ backgroundColor: "#0891b2" }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
