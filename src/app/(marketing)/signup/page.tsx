import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "@/components/auth-forms";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getProfile()) redirect("/dashboard");
  return (
    <AuthCard
      title="Start selling for free"
      sub="Create your account, verify your email, and put your first product online in minutes."
      footer={<>Already have an account? <Link href="/login" className="link">Log in</Link></>}
    >
      <SignupForm />
    </AuthCard>
  );
}
