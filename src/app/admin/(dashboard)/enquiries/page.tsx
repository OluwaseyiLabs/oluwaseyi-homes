import { redirect } from "next/navigation";

/** Enquiries now live in Leads and transactions. */
export default function Enquiries() {
  redirect("/admin/leads");
}
