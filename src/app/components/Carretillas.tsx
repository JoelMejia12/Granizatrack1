import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Carretilla = { id: string; codigo: string; estado: "disponible" | "en_uso" | "mantenimiento" };

export function Carretillas() {
  const [list, setList] = useState<Carretilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Carretilla> | null>(null);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase().from("carretillas").select("id, codigo, estado").order("codigo");
    setList((data ?? []) as Carretilla[]);
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!edit?.codigo) return;
    const sb = supabase();
    if (edit.id) {
      await sb.from("carretillas").update({ codigo: edit.codigo, estado: edit.estado ?? "disponible" }).eq("id", edit.id);
    } else {
      await sb.from("carretillas").insert({ codigo: edit.codigo, estado: edit.estado ?? "disponible" });
    }
    setEdit(null);
    cargar();
  };

  const eliminar = async (c: Carretilla) => {
    if (!confirm(`¿Eliminar carretilla ${c.codigo}?`)) return;
    await supabase().from("carretillas").delete().eq("id", c.id);
    cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Carretillas</h2>
        <button onClick={() => setEdit({ codigo: "", estado: "disponible" })}
          className="px-3 py-1.5 rounded-lg bg-[#AEE6F9] text-sm">+ Nueva</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-6 text-gray-500">Cargando...</div> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr><th className="px-4 py-2">Código</th><th className="px-4 py-2">Estado</th><th className="px-4 py-2"></th></tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{c.codigo}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${c.estado === "disponible" ? "bg-green-100 text-green-700" : c.estado === "en_uso" ? "bg-[#AEE6F9]" : "bg-yellow-100 text-yellow-700"}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => setEdit({ ...c })} className="text-[#0891b2]">Editar</button>
                    <button onClick={() => eliminar(c)} className="text-red-500">Eliminar</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={3} className="text-center text-gray-500 py-6">Sin carretillas</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{edit.id ? "Editar" : "Nueva"} carretilla</h3>
            <div>
              <label className="text-xs text-gray-500">Código</label>
              <input value={edit.codigo ?? ""} onChange={(e) => setEdit({ ...edit, codigo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Estado</label>
              <select value={edit.estado ?? "disponible"} onChange={(e) => setEdit({ ...edit, estado: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                <option value="disponible">disponible</option>
                <option value="en_uso">en_uso</option>
                <option value="mantenimiento">mantenimiento</option>
              </select>
            </div>
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
