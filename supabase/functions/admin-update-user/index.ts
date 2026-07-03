// Edge Function: admin-update-user
// Updates an auth user's email/password and profile row (requires admin role)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRoles } = await userClient
      .from('user_roles')
      .select('roles(name, tabs)')
      .eq('user_id', caller.id);

    const canManageUsers = userRoles?.some((ur: any) => ur.roles?.name === 'admin' || (ur.roles?.tabs && ur.roles.tabs.includes('/users')));
    if (!canManageUsers) {
      return new Response(JSON.stringify({ error: 'User management access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, name, email, password, roleIds } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Update auth user (email/password)
    const authUpdates: any = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, authUpdates);
      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update profile row
    const profileUpdates: any = {};
    if (name) profileUpdates.name = name;
    if (email) profileUpdates.email = email;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);
      if (profileErr) {
        return new Response(JSON.stringify({ error: profileErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


    if (roleIds && Array.isArray(roleIds)) {
      // First, delete existing roles
      await adminClient.from('user_roles').delete().eq('user_id', userId);
      
      // Insert new roles
      if (roleIds.length > 0) {
        const roleInserts = roleIds.map((roleId: string) => ({ user_id: userId, role_id: roleId }));
        const { error: rolesErr } = await adminClient.from('user_roles').insert(roleInserts);
        if (rolesErr) {
          return new Response(JSON.stringify({ error: rolesErr.message }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
