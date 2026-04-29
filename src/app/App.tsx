import { useEffect, useState } from "react";
import { Login } from "./components/Login";
import { Admin } from "./components/Admin";
import { Trabajador } from "./components/Trabajador";
import { supabase, Usuario } from "./lib/supabase";

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string>("");

  const cargarUsuario = async () => {
    setLoading(true);
    setError("");
    try {
      const sb = supabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        setUsuario(null);
        setLoading(false);
        return;
      }
      const { data, error } = await sb
        .from("usuarios")
        .select("id, email, nombre, rol, activo")
        .eq("id", session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data || !data.activo) {
        await sb.auth.signOut();
        setUsuario(null);
        setError(!data ? "Tu cuenta no está registrada en la tabla usuarios." : "Tu cuenta está desactivada.");
      } else {
        setUsuario(data as Usuario);
      }
    } catch (e: any) {
      setError(e.message ?? "Error cargando usuario");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuario();
    const sb = supabase();
    const { data: sub } = sb.auth.onAuthStateChange(() => cargarUsuario());
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase().auth.signOut();
    setUsuario(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF7FA]">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!usuario) {
    return (
      <>
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm shadow">
            {error}
          </div>
        )}
        <Login onLogin={cargarUsuario} />
      </>
    );
  }

  return usuario.rol === "admin" ? (
    <Admin usuario={usuario} onSignOut={signOut} />
  ) : (
    <Trabajador usuario={usuario} onSignOut={signOut} />
  );
}
