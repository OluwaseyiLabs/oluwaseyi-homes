import { LegalEditor } from "@/components/admin/LegalEditor";
import { requireUser } from "@/lib/auth";
import { getLegalPage } from "@/lib/data";
import { LEGAL_SLUGS } from "@/lib/legal";
import { LEGAL_DEFAULTS } from "@/lib/legal-defaults";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Legal() {
  await requireUser("content");
  const pages = await Promise.all(LEGAL_SLUGS.map((s) => getLegalPage(s)));
  const { data } = await (await supabaseServer()).from("legal_history").select("slug, version, saved_at, saved_by").order("saved_at", { ascending: false }).limit(60);
  return (
    <LegalEditor
      pages={pages.map((p) => ({ ...p, starterBody: LEGAL_DEFAULTS[p.slug].body, starterTitle: LEGAL_DEFAULTS[p.slug].title }))}
      history={(data ?? []).map((h) => ({ slug: h.slug as string, version: h.version as number, savedAt: h.saved_at as string, savedBy: h.saved_by as string }))}
    />
  );
}
