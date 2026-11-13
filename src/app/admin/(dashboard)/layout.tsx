import { Shell } from "@/components/admin/Shell";
import { requireUser } from "@/lib/auth";
import { SiteProvider } from "@/components/SiteProvider";
import { getPricing, getSiteContent, getUnreadSubmissions, getWaitingLeads } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await supabaseServer();
  const [waiting, unread, siteContent, pricing] = await Promise.all([getWaitingLeads(db), getUnreadSubmissions(db), getSiteContent(), getPricing()]);
  return (
    <SiteProvider value={{ ...siteContent, pricing }}>
    <Shell user={{ name: user.name, role: user.role, permissions: user.permissions }} sheetUrl={process.env.LEAD_SHEET_URL} waiting={waiting} unread={unread}>
      {children}
    </Shell>
    </SiteProvider>
  );
}
