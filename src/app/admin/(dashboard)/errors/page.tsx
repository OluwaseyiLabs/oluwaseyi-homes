import { ErrorLog, type ErrorRow } from "@/components/admin/ErrorLog";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Errors() {
  await requireUser("errors");
  const db = await supabaseServer();
  const { data, error } = await db
    .from("error_log")
    .select("id, ref, place, message, detail, staged, created_at, resolved_at, resolved_by")
    .order("created_at", { ascending: false })
    .limit(300);
  return <ErrorLog rows={(data ?? []) as ErrorRow[]} missing={!!error} />;
}
