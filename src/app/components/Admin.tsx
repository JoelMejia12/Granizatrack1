import { useState } from "react";
import { Usuario } from "../lib/supabase";
import { Dashboard } from "./Dashboard";
import { Mapa } from "./Mapa";
import { Rutas } from "./Rutas";
import { Usuarios } from "./Usuarios";
import { Carretillas } from "./Carretillas";
import { Asignaciones } from "./Asignaciones";
import { Productos } from "./Productos";
import { VentasAdmin } from "./VentasAdmin";
import { Reportes } from "./Reportes";

const TABS = [
  { k: "dashboard", label: "🏠 Dashboard" },
  { k: "mapa", label: "🗺️ Mapa" },
  { k: "rutas", label: "📍 Rutas" },
  { k: "usuarios", label: "👥 Usuarios" },
  { k: "carretillas", label: "🚚 Carretillas" },
  { k: "asignaciones", label: "🔗 Asignaciones" },
  { k: "productos", label: "📦 Productos" },
  { k: "ventas", label: "💰 Ventas" },
  { k: "reportes", label: "📊 Reportes" },
] as const;

type TabKey = typeof TABS[number]["k"];

export function Admin({ usuario, onSignOut }: { usuario: Usuario; onSignOut: () => void }) {
  const [tab, setTab] = useState<TabKey>("dashboard");

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
        {tab === "dashboard" && <Dashboard />}
        {tab === "mapa" && <Mapa />}
        {tab === "rutas" && <Rutas />}
        {tab === "usuarios" && <Usuarios />}
        {tab === "carretillas" && <Carretillas />}
        {tab === "asignaciones" && <Asignaciones />}
        {tab === "productos" && <Productos />}
        {tab === "ventas" && <VentasAdmin />}
        {tab === "reportes" && <Reportes />}
      </main>
    </div>
  );
}
