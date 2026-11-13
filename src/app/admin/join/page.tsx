import { getSiteContent } from "@/lib/data";
import { JoinForm } from "./JoinForm";

export default async function Join({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const [{ token_hash, type }, { site }] = await Promise.all([searchParams, getSiteContent()]);
  return <JoinForm name={site.name} tokenHash={token_hash ?? ""} type={type ?? "invite"} />;
}
