import { TeamManager } from "@/components/admin/TeamManager";
import { requireUser } from "@/lib/auth";
import { getTeam } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Team() {
  const user = await requireUser("team");
  const { members, roles } = await getTeam(await supabaseServer());
  return <TeamManager members={members} roles={roles} meId={user.id} />;
}
