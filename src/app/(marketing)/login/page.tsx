import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/auth-forms";
import { Notice } from "@/components/ui";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await getProfile()) redirect(safeNext);
  return (
    <AuthCard
      title="Welcome back"
      sub="Log in to your Reviewlabs dashboard."
      footer={<>New to Reviewlabs? <Link href="/signup" className="link">Create a free account</Link></>}
    >
      {error && <div className="mb-6"><Notice tone="bad">That link is invalid or has expired. Log in, or ask for a new link.</Notice></div>}
      <LoginForm next={safeNext} />
    </AuthCard>
  );
}
