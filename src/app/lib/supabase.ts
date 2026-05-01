import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dvkeyrwlbjipqzreyglx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GSv4UCuf5LAM28iawNiJBQ__m0Pw3nF";

const _client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export function supabase(): SupabaseClient {
  return _client;
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/make-server-dfeb846f`;

export async function callServer(path: string, body: any): Promise<any> {
  const { data: { session } } = await _client.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON_KEY;
  const res = await fetch(`${FUNCTION_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const msg = json?.error ?? `HTTP ${res.status}`;
    console.error(`callServer ${path} failed:`, msg, json);
    throw new Error(msg);
  }
  return json;
}

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  rol: "admin" | "trabajador";
  activo: boolean;
};
