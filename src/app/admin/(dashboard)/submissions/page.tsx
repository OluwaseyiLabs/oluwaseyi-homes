import { SubmissionInbox } from "@/components/admin/SubmissionInbox";
import { requireUser } from "@/lib/auth";
import { getDetailFields, getSubmissions } from "@/lib/data";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Submissions({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const user = await requireUser("submissions");
  const [submissions, detailFields] = await Promise.all([getSubmissions(await supabaseServer()), getDetailFields()]);
  return (
    <SubmissionInbox
      initialId={(await searchParams).id}
      submissions={submissions}
      detailFields={detailFields}
      canApprove={user.permissions.includes("approve")}
    />
  );
}
