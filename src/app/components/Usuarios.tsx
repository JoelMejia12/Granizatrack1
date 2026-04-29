import { useEffect, useState } from "react";
import { supabase, Usuario } from "../lib/supabase";

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Usuario | null>(null);
  const [info, setInfo] = useState<string>("");

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase()
      .from("usuarios")
      .select("id, email, nombre, rol, activo")
      .order("nombre");
    if (!error) setUsuarios((data ?? []) as Usuario[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const guardar = async () => {
    if (!edit) return;
    const { error } = await supabase()
      .from("usuarios")
      .update({ nombre: edit.nombre, rol: edit.rol, activo: edit.activo })
      .eq("id", edit.id);
    if (!error) {
      setEdit(null);
      cargar();
    }
  };

  const desactivar = async (u: Usuario) => {
    await supabase().from("usuarios").update({ activo: false }).eq("id", u.id);
    cargar();
  };

  const activar = async (u: Usuario) => {
    await supabase().from("usuarios").update({ activo: true }).eq("id", u.id);
    cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <button onClick={() => setInfo(info ? "" : "i")}
          className="px-3 py-1.5 rounded-lg bg-[#AEE6F9] text-sm">
          + Nuevo Usuario
        </button>
      </div>
      {info && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-2xl text-sm">
          Primero crea el usuario en Supabase Auth y luego agrégalo aquí (insertando una fila en la tabla <code>usuarios</code> con el mismo <code>id</code> del usuario de Auth).
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 text-gray-500">Cargando...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Activo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{u.nombre}</td>
                  <td className="px-4 py-2 text-gray-500">{u.email}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.rol === "admin" ? "bg-[#F8C8DC]" : "bg-[#AEE6F9]"}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-2">{u.activo ? "✓" : "✗"}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={() => setEdit({ ...u })} className="text-[#0891b2]">Editar</button>
                    {u.activo ? (
                      <button onClick={() => desactivar(u)} className="text-red-500">Desactivar</button>
                    ) : (
                      <button onClick={() => activar(u)} className="text-green-600">Activar</button>
                    )}
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-500 py-6">Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setEdit(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">Editar usuario</h3>
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Rol</label>
              <select value={edit.rol} onChange={(e) => setEdit({ ...edit, rol: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                <option value="admin">admin</option>
                <option value="trabajador">trabajador</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
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
