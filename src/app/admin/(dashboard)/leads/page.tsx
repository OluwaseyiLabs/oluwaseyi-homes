import { LeadManager } from "@/components/admin/LeadManager";
import { requireUser } from "@/lib/auth";
import { getAllListings, getLeads } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Leads({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser("view");
  const db = await supabaseServer();
  const [leads, listings] = await Promise.all([getLeads(db), getAllListings(db)]);
  return (
    <LeadManager
      initialId={(await searchParams).id}
      leads={leads}
      properties={listings.filter((l) => l.published && l.dbId).map((l) => ({ dbId: l.dbId!, code: l.id, category: l.category, label: `${l.title}, ${l.location} (${l.price})` }))}
      can={{ change: user.permissions.includes("transactions"), release: user.permissions.includes("release"), approve: user.permissions.includes("approve") }}
    />
  );
}
