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
      title="Create your account"
      sub="Next, choose Creator or Pro. Your dashboard unlocks as soon as you subscribe."
      footer={<>Already have an account? <Link href="/login" className="link">Log in</Link></>}
    >
      <SignupForm />
    </AuthCard>
  );
}
