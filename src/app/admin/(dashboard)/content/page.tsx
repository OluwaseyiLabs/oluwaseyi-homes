import { ContentForm } from "@/components/admin/ContentForm";
import { requireUser } from "@/lib/auth";
import { getPricing, getSiteContent } from "@/lib/data";
import { defaultValues } from "@/lib/site-content";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Content() {
  const user = await requireUser("content");
  const [{ site, content }, pricing] = await Promise.all([getSiteContent(), getPricing()]);
  const db = await supabaseServer();
  // The values to show in the form: what is live now.
  const stored = Object.fromEntries(((await db.from("site_content").select("key, value")).data ?? []).map((r) => [r.key as string, r.value as string]));
  const values = { ...defaultValues(), ...stored };
  values.footerLine = content.footerLine;
  return (
    <ContentForm
      values={values}
      heroImage={site.heroImage}
      isDefaultHero={!stored.heroImage}
      pricing={pricing}
      canEditFees={user.permissions.includes("team")}
    />
  );
}
