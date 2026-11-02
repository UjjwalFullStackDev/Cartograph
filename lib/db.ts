import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { env } from "./env";

/**
 * Creates a server-side Supabase client carrying the signed-in Clerk JWT.
 * The token travels with every request so Postgres RLS policies can inspect
 * organization and identity claims.
 *
 * Sessions belong strictly to Clerk: Supabase session persistence and token
 * refreshing are disabled to prevent duplicate session handling.
 */
export async function createDbClient(): Promise<SupabaseClient> {
  const { getToken } = await auth();
  const token = await getToken();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    },
  });
}

