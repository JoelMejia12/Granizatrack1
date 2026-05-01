import { useEffect, useRef, useState } from "react";
import { Login } from "./components/Login";
import { Admin } from "./components/Admin";
import { Trabajador } from "./components/Trabajador";
import { supabase, Usuario } from "./lib/supabase";

type Status = "loading" | "login" | "ready" | "error";

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [error, setError] = useState<string>("");
  const timeoutRef = useRef<number | null>(null);

  const cargarUsuario = async () => {
    setStatus("loading");
    setError("");
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setStatus((s) => {
        if (s === "loading") {
          setError("Error de conexión con Supabase (timeout)");
          return "error";
        }
        return s;
      });
    }, 5000);

    try {
      const sb = supabase();
      const { data: { session }, error: sessErr } = await sb.auth.getSession();
      if (sessErr) throw sessErr;

      if (!session) {
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        setUsuario(null);
        setStatus("login");
        return;
      }

      const { data, error: uErr } = await sb
        .from("usuarios")
        .select("id, email, nombre, rol, activo")
        .eq("id", session.user.id)
        .maybeSingle();
      if (uErr) throw uErr;

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

      if (!data || !data.activo) {
        await sb.auth.signOut();
        setUsuario(null);
        setError(!data
          ? "Tu cuenta no está registrada en la tabla usuarios."
          : "Tu usuario está inactivo. Contacta al administrador.");
        setStatus("login");
      } else {
        setUsuario(data as Usuario);
        setStatus("ready");
      }
    } catch (e: any) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setError(`Error de conexión con Supabase: ${e?.message ?? e}`);
      setStatus("error");
    }
  };

  useEffect(() => {
    cargarUsuario();
    const sb = supabase();
    const { data: sub } = sb.auth.onAuthStateChange((_event) => {
      cargarUsuario();
    });
    return () => {
      sub.subscription.unsubscribe();
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const signOut = async () => {
    try { await supabase().auth.signOut(); } catch {}
    setUsuario(null);
    setError("");
    setStatus("login");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF7FA]">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF7FA] p-4">
        <div className="bg-white rounded-2xl border border-red-200 p-6 max-w-md w-full text-center space-y-4">
          <div className="text-2xl">⚠️</div>
          <h2 className="font-semibold">Error de conexión con Supabase</h2>
          {error && <p className="text-sm text-red-600 break-words">{error}</p>}
          <div className="flex gap-2 justify-center">
            <button onClick={cargarUsuario}
              className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: "#0891b2" }}>
              Reintentar
            </button>
            <button onClick={signOut}
              className="px-4 py-2 rounded-lg bg-[#F8C8DC]">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "login" || !usuario) {
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
