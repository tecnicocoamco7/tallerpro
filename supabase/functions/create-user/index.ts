import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Cliente con la sesión de quien llama, para saber quién es.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: corsHeaders });
    }

    // Cliente con privilegios de administrador. Esta clave vive solo en el servidor, nunca en el navegador.
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verificar que quien llama ya es admin.
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("rol")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.rol !== "admin") {
      return new Response(JSON.stringify({ error: "Solo administradores pueden crear usuarios" }), { status: 403, headers: corsHeaders });
    }

    const { email, password, nombre, rol } = await req.json();
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

    // El trigger ya crea la fila en profiles con rol "tecnico"; la actualizamos con nombre y rol elegidos.
    await adminClient.from("profiles").update({
      nombre: nombre || email,
      rol: rol === "admin" ? "admin" : "tecnico",
    }).eq("id", created.user.id);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
