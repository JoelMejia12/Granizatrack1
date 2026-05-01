import { useEffect, useState } from "react";
import { supabase, callServer, Usuario } from "../lib/supabase";

type Asignacion = { id: string; trabajador_id: string; carretilla_id: string; activa: boolean };
type Carretilla = { id: string; codigo: string };

type EditState = {
  id?: string;
  nombre: string;
  email: string;
  rol: "admin" | "trabajador";
  activo: boolean;
  password: string;
  isNew: boolean;
};

const empty: EditState = { nombre: "", email: "", rol: "trabajador", activo: true, password: "", isNew: true };

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [carretillas, setCarretillas] = useState<Carretilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const cargar = async () => {
    setLoading(true);
    const sb = supabase();
    const [u, a, c] = await Promise.all([
      sb.from("usuarios").select("id, email, nombre, rol, activo").order("nombre"),
      sb.from("asignaciones").select("id, trabajador_id, carretilla_id, activa").eq("activa", true),
      sb.from("carretillas").select("id, codigo"),
    ]);
    setUsuarios((u.data ?? []) as Usuario[]);
    setAsignaciones((a.data ?? []) as Asignacion[]);
    setCarretillas((c.data ?? []) as Carretilla[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const cMap = new Map(carretillas.map((c) => [c.id, c.codigo]));
  const carretillaPorTrabajador = (id: string) => {
    const asig = asignaciones.find((x) => x.trabajador_id === id);
    return asig ? cMap.get(asig.carretilla_id) ?? "—" : null;
  };

  const guardar = async () => {
    if (!edit) return;
    setBusy(true);
    setError("");
    try {
      if (edit.isNew) {
        if (!edit.email || !edit.password || !edit.nombre) {
          throw new Error("Nombre, email y contraseña son obligatorios");
        }
        await callServer("create-user", {
          email: edit.email,
          password: edit.password,
          nombre: edit.nombre,
          rol: edit.rol,
        });
      } else {
        await callServer("update-user", {
          id: edit.id,
          nombre: edit.nombre,
          email: edit.email,
          rol: edit.rol,
          activo: edit.activo,
        });
      }
      setEdit(null);
      await cargar();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const setActivo = async (u: Usuario, activo: boolean) => {
    setError("");
    try {
      await callServer(activo ? "enable-user" : "disable-user", { id: u.id });
      await cargar();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const eliminar = async (u: Usuario) => {
    if (!confirm(`¿Eliminar al usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      await callServer("delete-user", { id: u.id });
      await cargar();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <button onClick={() => setEdit({ ...empty })}
          className="px-3 py-1.5 rounded-lg bg-[#AEE6F9] text-sm">
          + Nuevo Usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
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
                <th className="px-4 py-2">Carretilla asignada</th>
                <th className="px-4 py-2">Activo</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const carrCodigo = u.rol === "trabajador" ? carretillaPorTrabajador(u.id) : null;
                return (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">{u.nombre}</td>
                    <td className="px-4 py-2 text-gray-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.rol === "admin" ? "bg-[#F8C8DC]" : "bg-[#AEE6F9]"}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {u.rol === "admin" ? (
                        <span className="text-gray-400">N/A</span>
                      ) : carrCodigo ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{carrCodigo}</span>
                      ) : (
                        <span className="text-gray-400">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-3">
                      <button onClick={() => setEdit({
                        id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
                        activo: u.activo, password: "", isNew: false,
                      })} className="text-[#0891b2]">Editar</button>
                      {u.activo ? (
                        <button onClick={() => setActivo(u, false)} className="text-orange-500">Desactivar</button>
                      ) : (
                        <button onClick={() => setActivo(u, true)} className="text-green-600">Activar</button>
                      )}
                      <button onClick={() => eliminar(u)} className="text-red-500">Eliminar</button>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-500 py-6">Sin usuarios</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => !busy && setEdit(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold">{edit.isNew ? "Nuevo usuario" : "Editar usuario"}</h3>
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200" />
            </div>
            {edit.isNew && (
              <div>
                <label className="text-xs text-gray-500">Contraseña</label>
                <input type="password" value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Rol</label>
              <select value={edit.rol} onChange={(e) => setEdit({ ...edit, rol: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200">
                <option value="admin">admin</option>
                <option value="trabajador">trabajador</option>
              </select>
            </div>
            {!edit.isNew && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
                Activo
              </label>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button disabled={busy} onClick={() => setEdit(null)}
                className="px-3 py-2 rounded-lg bg-gray-100">Cancelar</button>
              <button disabled={busy} onClick={guardar}
                className="px-3 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: "#0891b2" }}>
                {busy ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
