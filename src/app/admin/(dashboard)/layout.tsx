import { Shell } from "@/components/admin/Shell";
import { requireUser } from "@/lib/auth";
import { SiteProvider } from "@/components/SiteProvider";
import { getPricing, getSiteContent, getUnreadSubmissions, getWaitingLeads } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await supabaseServer();
  const [waiting, unread, siteContent, pricing] = await Promise.all([getWaitingLeads(db), getUnreadSubmissions(db), getSiteContent(), getPricing()]);
  // Errors nobody has marked fixed, for people allowed to see the log. A missing table or any failure just shows no count.
  const { count } = user.permissions.includes("errors")
    ? await db.from("error_log").select("id", { count: "exact", head: true }).is("resolved_at", null).eq("staged", false)
    : { count: 0 };
  return (
    <SiteProvider value={{ ...siteContent, pricing }}>
    <Shell user={{ name: user.name, role: user.role, permissions: user.permissions }} sheetUrl={process.env.LEAD_SHEET_URL} waiting={waiting} unread={unread} openErrors={count ?? 0}>
      {children}
    </Shell>
    </SiteProvider>
  );
}
