import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dvkeyrwlbjipqzreyglx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GSv4UCuf5LAM28iawNiJBQ__m0Pw3nF";

const _client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export function supabase(): SupabaseClient {
  return _client;
}

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "trabajador";
  activo: boolean;
};
