import { createBrowserClient } from "@supabase/ssr";

/** Supabase in the signed-in team member's browser. Used for uploading photos straight to storage. */
export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
