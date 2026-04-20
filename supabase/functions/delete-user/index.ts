// Edge Function: delete-user
// Allows an authenticated admin to permanently delete a user from auth.users.
// Cascades automatically remove related profiles/user_roles when foreign keys are set;
// otherwise we clean them explicitly to avoid orphans.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller identity using anon key + JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    // Verify caller is admin via has_role()
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin, error: roleErr } = await admin.rpc('has_role', {
      _user_id: callerId,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { user_id, emails } = body as { user_id?: string; emails?: string[] };

    const targetIds: string[] = [];

    if (user_id) {
      targetIds.push(user_id);
    }

    if (emails && Array.isArray(emails) && emails.length > 0) {
      // Resolve user IDs from emails via auth admin list
      // listUsers paginates; loop until done
      let page = 1;
      const perPage = 1000;
      const found = new Set<string>();
      const wanted = new Set(emails.map((e) => e.toLowerCase()));
      while (found.size < wanted.size) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
        if (error) break;
        for (const u of data.users) {
          if (u.email && wanted.has(u.email.toLowerCase())) {
            targetIds.push(u.id);
            found.add(u.email.toLowerCase());
          }
        }
        if (data.users.length < perPage) break;
        page++;
      }
    }

    if (targetIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No targets resolved' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent admin self-deletion
    const filtered = targetIds.filter((id) => id !== callerId);

    const results: { user_id: string; ok: boolean; error?: string }[] = [];
    for (const id of filtered) {
      // Cleanup app data (no FK cascade defined)
      await admin.from('user_roles').delete().eq('user_id', id);
      await admin.from('profiles').delete().eq('user_id', id);
      // Note: registros_producao / ligacoes / topografia_asbuilt keep historical user_id refs.
      // Per user request "exclude everything", remove them too.
      await admin.from('registros_producao').delete().eq('user_id', id);
      await admin.from('ligacoes').delete().eq('encarregado_id', id);
      await admin.from('topografia_asbuilt').delete().eq('registrado_por', id);

      const { error } = await admin.auth.admin.deleteUser(id);
      results.push({ user_id: id, ok: !error, error: error?.message });
    }

    return new Response(JSON.stringify({ results, skipped_self: targetIds.length - filtered.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
