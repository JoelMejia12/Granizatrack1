import { useState } from "react";
import { supabase } from "../lib/supabase";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      onLogin();
    } catch (err: any) {
      setError(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#AEE6F9]/30 to-[#F8C8DC]/30 p-4">
      <form onSubmit={handle} className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-4">
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-2" style={{ backgroundColor: "#AEE6F9" }}>
            <span className="text-3xl">🍧</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "#0891b2" }}>GranizaTrack</h1>
          <p className="text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#AEE6F9] focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-[#AEE6F9] focus:outline-none" />
        </div>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg text-white font-medium disabled:opacity-50"
          style={{ backgroundColor: "#0891b2" }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
