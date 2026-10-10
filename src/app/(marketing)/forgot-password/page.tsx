import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Forgot your password?" sub="Enter your email and we'll send you a link to set a new one." footer={<Link href="/login" className="link">Back to log in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
