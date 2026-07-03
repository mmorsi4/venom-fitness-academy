// Edge Function: admin-create-user
// Creates a new auth user + profile row (requires admin role)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a client with the user's JWT to check their role
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

    // Check caller is admin
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

    // Parse request body
    const { name, email, password, roleIds } = await req.json();
    if (!name || !email || !password || !roleIds || !Array.isArray(roleIds)) {
      return new Response(JSON.stringify({ error: 'name, email, password, and roleIds (array) are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user with service_role key (can create auth users)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (roleIds.length > 0) {
      // Delete the default roles inserted by the trigger
      await adminClient.from('user_roles').delete().eq('user_id', newUser.user.id);
      
      // Insert the requested roles
      const roleInserts = roleIds.map((roleId: string) => ({ user_id: newUser.user.id, role_id: roleId }));
      const { error: rolesErr } = await adminClient.from('user_roles').insert(roleInserts);
      if (rolesErr) {
        return new Response(JSON.stringify({ error: rolesErr.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ user: newUser.user }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
