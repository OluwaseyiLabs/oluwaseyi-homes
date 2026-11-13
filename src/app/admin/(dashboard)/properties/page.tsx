import { PropertyManager } from "@/components/admin/PropertyManager";
import { requireUser } from "@/lib/auth";
import { getAllListings, getDetailFields, getFacilities } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Properties() {
  const user = await requireUser("view");
  const [listings, detailFields, facilities] = await Promise.all([getAllListings(await supabaseServer()), getDetailFields(), getFacilities()]);
  return (
    <PropertyManager
      listings={listings}
      detailFields={detailFields}
      facilities={facilities}
      can={{ edit: user.permissions.includes("drafts"), publish: user.permissions.includes("publish"), approve: user.permissions.includes("approve") }}
    />
  );
}
