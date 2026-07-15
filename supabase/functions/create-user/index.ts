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

    console.log("DIAG supabaseUrl presente:", !!supabaseUrl);
    console.log("DIAG serviceKey presente:", !!serviceKey);
    console.log("DIAG authHeader recibido:", authHeader ? authHeader.slice(0, 20) + "..." : "(vacio)");
    console.log("DIAG jwt largo:", jwt.length);

    if (!jwt) {
      return new Response(JSON.stringify({ error: "No autenticado (falta token)" }), { status: 401, headers: corsHeaders });
    }
    if (!supabaseUrl || !serviceKey) {
      console.log("DIAG: falta supabaseUrl o serviceKey en las variables de entorno");
      return new Response(JSON.stringify({ error: "Config del servidor incompleta (falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)" }), { status: 500, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
    console.log("DIAG getUser error:", userErr ? JSON.stringify(userErr) : "ninguno");
    console.log("DIAG getUser user id:", userData?.user?.id || "(sin usuario)");

    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado", detalle: userErr?.message }), { status: 401, headers: corsHeaders });
    }

    const { data: callerProfile, error: profErr } = await adminClient
      .from("profiles")
      .select("rol")
      .eq("id", userData.user.id)
      .maybeSingle();
    console.log("DIAG profile error:", profErr ? JSON.stringify(profErr) : "ninguno");
    console.log("DIAG profile rol:", callerProfile?.rol || "(sin perfil)");

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
    console.log("DIAG excepcion:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
