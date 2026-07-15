import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!jwt) {
      return new Response(JSON.stringify({ error: "No autenticado (falta token)" }), { status: 401, headers: corsHeaders });
    }
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Config del servidor incompleta" }), { status: 500, headers: corsHeaders });
    }

    // persistSession/autoRefreshToken en false: evita el error "Auth session missing"
    // que tira la librería cuando corre en un servidor sin almacenamiento de sesión.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("rol")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.rol !== "admin") {
      return new Response(JSON.stringify({ error: "Solo administradores pueden hacer esto" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const accion = body.accion || "crear";

    if (accion === "reset-password") {
      const { userId, password } = body;
      if (!userId || !password) {
        return new Response(JSON.stringify({ error: "Falta userId o password" }), { status: 400, headers: corsHeaders });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), { status: 400, headers: corsHeaders });
      }
      const { error: updErr } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: corsHeaders });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, password, nombre, rol } = body;
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Falta email o contraseña" }), { status: 400, headers: corsHeaders });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), { status: 400, headers: corsHeaders });
    }

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });
    }

    await adminClient.from("profiles").update({
      nombre: nombre || email,
      rol: rol === "admin" ? "admin" : "tecnico",
    }).eq("id", created.user.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
