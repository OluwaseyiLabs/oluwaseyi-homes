import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase with the secret key, which skips row-level security. Server only.
 * Use it after the caller's permission has been checked, for the few jobs the
 * signed-in user's own access cannot do.
 */
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
