// One-shot helper to create the 10 Encarregado users + assign role.
// Idempotent: if user already exists, just ensures the role is set.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: { email: string; status: string; user_id?: string; error?: string }[] = [];

  for (let i = 1; i <= 10; i++) {
    const email = `encarregado${i}@sanegest.com`;
    const password = `Enc@2026#${i}`;
    const displayName = `Encarregado ${i}`;

    let userId: string | null = null;

    // Try to create
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });

    if (createErr && !createErr.message.toLowerCase().includes("already")) {
      results.push({ email, status: "error_create", error: createErr.message });
      continue;
    }

    if (created?.user) {
      userId = created.user.id;
    } else {
      // Existing — find by listing
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email === email);
      if (!existing) {
        results.push({ email, status: "not_found_after_create" });
        continue;
      }
      userId = existing.id;
    }

    // Ensure role
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "encarregado" }, { onConflict: "user_id" });

    if (roleErr) {
      results.push({ email, status: "role_error", user_id: userId!, error: roleErr.message });
      continue;
    }

    // Ensure profile (handle_new_user trigger should have done it, but make sure)
    await supabase
      .from("profiles")
      .upsert(
        { user_id: userId!, email, display_name: displayName },
        { onConflict: "user_id" },
      );

    results.push({ email, status: "ok", user_id: userId! });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
