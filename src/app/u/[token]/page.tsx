import { notFound } from "next/navigation";
import { recipientByToken } from "@/lib/broadcasts";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

// The unsubscribe link in a broadcast. It asks first, so link scanners in
// mail apps can't unsubscribe people by opening the page.
export default async function Unsubscribe({ params }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const r = await recipientByToken(token);
  if (!r) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-soft px-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-hairline bg-canvas p-8 text-center">
        <p className="text-[22px] font-semibold">{r.unsubscribed ? "You're unsubscribed" : `Stop emails from ${r.creatorName}?`}</p>
        <p className="text-[15px] text-body">
          {r.unsubscribed
            ? `${r.email} won't get any more emails from ${r.creatorName}. Receipts for things you buy still arrive.`
            : `${r.email} will stop getting updates from ${r.creatorName}. Receipts for things you buy still arrive.`}
        </p>
        {!r.unsubscribed && <UnsubscribeButton token={token} />}
      </div>
    </main>
  );
}
