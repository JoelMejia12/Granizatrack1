import { useState } from "react";
import { Usuario } from "../lib/supabase";
import { Mapa } from "./Mapa";
import { Rutas } from "./Rutas";
import { Ventas } from "./Ventas";
import { Reportes } from "./Reportes";

const TABS = [
  { k: "mapa", label: "🗺️ Mapa" },
  { k: "rutas", label: "📍 Rutas" },
  { k: "ventas", label: "💰 Ventas" },
  { k: "reportes", label: "📊 Reportes" },
] as const;

export function Admin({ usuario, onSignOut }: { usuario: Usuario; onSignOut: () => void }) {
  const [tab, setTab] = useState<typeof TABS[number]["k"]>("mapa");

  return (
    <div className="min-h-screen bg-[#FDF7FA]">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="font-semibold" style={{ color: "#0891b2" }}>GranizaTrack</h1>
          <p className="text-xs text-gray-500">{usuario.nombre} · admin</p>
        </div>
        <button onClick={onSignOut} className="text-sm text-gray-500">Salir</button>
      </header>
      <nav className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${tab === t.k ? "bg-[#AEE6F9]" : "bg-gray-100"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="p-4 max-w-7xl mx-auto">
        {tab === "mapa" && <Mapa />}
        {tab === "rutas" && <Rutas />}
        {tab === "ventas" && <Ventas usuario={usuario} jornadaActiva={null} />}
        {tab === "reportes" && <Reportes />}
      </main>
    </div>
  );
}
