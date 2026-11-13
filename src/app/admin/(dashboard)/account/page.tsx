import { AccountForm } from "@/components/admin/AccountForm";
import { PageHeader } from "@/components/admin/ui";
import { requireUser } from "@/lib/auth";

export default async function Account() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" text="How your name appears to the team and in the history of each lead." />
      <AccountForm name={user.name} email={user.email} role={user.role} />
    </>
  );
}
