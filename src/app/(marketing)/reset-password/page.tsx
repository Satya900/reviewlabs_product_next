import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/auth-forms";
import { Notice } from "@/components/ui";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage() {
  // The reset email link signs the user in for this step.
  const profile = await getProfile();
  return (
    <AuthCard title="Set a new password" sub={profile ? `For ${profile.email}` : undefined}>
      {profile ? (
        <ResetPasswordForm />
      ) : (
        <Notice tone="bad">
          This reset link has expired or was already used. <Link href="/forgot-password" className="link">Ask for a new one</Link>.
        </Notice>
      )}
    </AuthCard>
  );
}
