import { TrafficView } from "@/components/admin/TrafficView";
import { requireUser } from "@/lib/auth";
import { getAllListings, getTraffic } from "@/lib/data";
import { RANGES } from "@/lib/track";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Traffic() {
  await requireUser("view");
  const db = await supabaseServer();
  const [data, listings] = await Promise.all([getTraffic(db, [...RANGES]), getAllListings(db)]);
  // "/properties/3-bedroom-flat-yaba-p-0004" is shown by the property's title.
  const names = Object.fromEntries(listings.map((l) => [l.id.toLowerCase(), `${l.title}, ${l.location}`]));
  return <TrafficView data={data} names={names} />;
}
