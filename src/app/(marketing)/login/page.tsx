import Link from "next/link";
import { Notice } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata = { title: "Creator login" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <section className="relative overflow-hidden bg-surface-soft px-5 py-20 sm:px-8">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 size-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="relative mx-auto max-w-md">
        <div className="rounded-3xl border border-hairline bg-canvas p-8 shadow-soft sm:p-10">
          <h1 className="display text-[36px]">Welcome back</h1>
          <p className="mt-2 text-[16px] text-body">Enter your email and we will send you a sign-in link. No password needed.</p>
          {error && <div className="mt-6"><Notice tone="bad">That link is invalid or has expired. Ask for a new one below.</Notice></div>}
          <div className="mt-8">
            <LoginForm next={safeNext} />
          </div>
        </div>
        <p className="mt-6 text-center text-[14px] text-body">
          No account yet? Creator accounts are invite-only. <Link href="/contact" className="link">Ask for an invite</Link>
        </p>
      </div>
    </section>
  );
}
