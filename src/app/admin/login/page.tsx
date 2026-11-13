import { getSiteContent } from "@/lib/data";
import { LoginForm } from "./LoginForm";

export default async function Login({ searchParams }: { searchParams: Promise<{ off?: string; changed?: string }> }) {
  const [{ off, changed }, { site }] = await Promise.all([searchParams, getSiteContent()]);
  return <LoginForm name={site.name} off={off === "1"} changed={changed === "1"} />;
}
