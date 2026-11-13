import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Where someone is sent when their account has been switched off: it ends their session, then shows the sign-in page with the reason. */
export async function GET(req: Request) {
  await (await supabaseServer()).auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/admin/login?off=1", req.url));
}
