"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// For forms posting to a server action from a Server Component: shows a spinner while it runs.
export function SubmitButton({ className, children, pendingText }: { className?: string; children: ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending || undefined} className={className}>
      {pending && <span className="spinner" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
