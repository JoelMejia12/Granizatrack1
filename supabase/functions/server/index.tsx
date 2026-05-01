import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function asUser(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type AuthOk = { ok: true; userId: string; token: string; sbAsUser: SupabaseClient };
type AuthErr = { ok: false; res: Response };

async function requireAdmin(c: any): Promise<AuthOk | AuthErr> {
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return { ok: false, res: c.json({ error: "Authorization header missing" }, 401) };
  }
  const { data: userData, error: userErr } = await admin().auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, res: c.json({ error: `Invalid token: ${userErr?.message ?? "no user"}` }, 401) };
  }
  const callerId = userData.user.id;
  const sbAsUser = asUser(token);
  const { data: row, error: rowErr } = await sbAsUser
    .from("usuarios")
    .select("id, rol, activo")
    .eq("id", callerId)
    .maybeSingle();
  if (rowErr) {
    return { ok: false, res: c.json({ error: `Error reading usuarios: ${rowErr.message}` }, 500) };
  }
  if (!row || row.rol !== "admin" || !row.activo) {
    return { ok: false, res: c.json({ error: "Forbidden: admin role required" }, 403) };
  }
  return { ok: true, userId: callerId, token, sbAsUser };
}

app.get("/make-server-dfeb846f/health", (c) => c.json({ status: "ok" }));

app.post("/make-server-dfeb846f/create-user", async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.res;
  try {
    const { email, password, nombre, rol } = (await c.req.json()) ?? {};
    if (!email || !password || !nombre || !rol) {
      return c.json({ error: "Missing fields: email, password, nombre, rol are required" }, 400);
    }
    if (rol !== "admin" && rol !== "trabajador") {
      return c.json({ error: "Invalid rol: must be 'admin' or 'trabajador'" }, 400);
    }
    const sbAdmin = admin();
    const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
      email, password, user_metadata: { nombre },
      // Auto-confirm since no email server is configured
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return c.json({ error: `Error creating auth user: ${createErr?.message ?? "unknown"}` }, 500);
    }
    const newId = created.user.id;
    const { error: insertErr } = await auth.sbAsUser.from("usuarios").insert({
      id: newId, email, nombre, rol, activo: true,
    });
    if (insertErr) {
      await sbAdmin.auth.admin.deleteUser(newId).catch(() => {});
      return c.json({ error: `Error inserting into usuarios: ${insertErr.message}` }, 500);
    }
    return c.json({ ok: true, id: newId });
  } catch (e: any) {
    console.log("create-user error", e);
    return c.json({ error: `create-user exception: ${e?.message ?? e}` }, 500);
  }
});

app.post("/make-server-dfeb846f/update-user", async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.res;
  try {
    const { id, nombre, email, rol, activo } = await c.req.json();
    if (!id) return c.json({ error: "Missing id" }, 400);
    const authUpdate: any = {};
    if (email) authUpdate.email = email;
    if (nombre) authUpdate.user_metadata = { nombre };
    if (Object.keys(authUpdate).length) {
      const { error: aErr } = await admin().auth.admin.updateUserById(id, authUpdate);
      if (aErr) return c.json({ error: `Error updating auth user: ${aErr.message}` }, 500);
    }
    const patch: any = {};
    if (typeof nombre === "string") patch.nombre = nombre;
    if (typeof email === "string") patch.email = email;
    if (rol === "admin" || rol === "trabajador") patch.rol = rol;
    if (typeof activo === "boolean") patch.activo = activo;
    if (Object.keys(patch).length) {
      const { error: uErr } = await auth.sbAsUser.from("usuarios").update(patch).eq("id", id);
      if (uErr) return c.json({ error: `Error updating usuarios: ${uErr.message}` }, 500);
    }
    return c.json({ ok: true });
  } catch (e: any) {
    console.log("update-user error", e);
    return c.json({ error: `update-user exception: ${e?.message ?? e}` }, 500);
  }
});

async function setActivo(c: any, activo: boolean) {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await c.req.json();
    if (!id) return c.json({ error: "Missing id" }, 400);
    const { error: aErr } = await admin().auth.admin.updateUserById(id, {
      ban_duration: activo ? "none" : "876000h",
    });
    if (aErr) return c.json({ error: `Error toggling auth ban: ${aErr.message}` }, 500);
    const { error: uErr } = await auth.sbAsUser.from("usuarios").update({ activo }).eq("id", id);
    if (uErr) return c.json({ error: `Error updating usuarios.activo: ${uErr.message}` }, 500);
    return c.json({ ok: true });
  } catch (e: any) {
    console.log("setActivo error", e);
    return c.json({ error: `setActivo exception: ${e?.message ?? e}` }, 500);
  }
}

app.post("/make-server-dfeb846f/enable-user", (c) => setActivo(c, true));
app.post("/make-server-dfeb846f/disable-user", (c) => setActivo(c, false));

app.post("/make-server-dfeb846f/delete-user", async (c) => {
  const auth = await requireAdmin(c);
  if (!auth.ok) return auth.res;
  try {
    const { id } = await c.req.json();
    if (!id) return c.json({ error: "Missing id" }, 400);
    if (id === auth.userId) {
      return c.json({ error: "No puedes eliminar tu propio usuario" }, 400);
    }
    const { error: dErr } = await auth.sbAsUser.from("usuarios").delete().eq("id", id);
    if (dErr) return c.json({ error: `Error deleting from usuarios: ${dErr.message}` }, 500);
    const { error: aErr } = await admin().auth.admin.deleteUser(id);
    if (aErr) return c.json({ error: `Error deleting auth user: ${aErr.message}` }, 500);
    return c.json({ ok: true });
  } catch (e: any) {
    console.log("delete-user error", e);
    return c.json({ error: `delete-user exception: ${e?.message ?? e}` }, 500);
  }
});

Deno.serve(app.fetch);
