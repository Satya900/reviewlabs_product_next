import Link from "next/link";

// Shown instead of a product page, storefront or lead magnet when the
// creator has no plan or trial. Their content is kept, just not shown.
export function StorePaused({ name }: { name?: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-soft px-4">
      <div className="w-full max-w-md rounded-3xl border border-hairline bg-canvas p-8 text-center">
        <p className="text-[20px] font-semibold">This store is taking a break</p>
        <p className="mt-3 text-[15px] text-body">
          {name ? `${name} isn't` : "The creator isn't"} taking orders here right now. Please check back later or contact them directly.
        </p>
        <p className="mt-3 text-[14px] text-muted">Bought something earlier? Your download link in the receipt email still works.</p>
        <Link href="/" className="mt-6 inline-block text-[13px] font-medium text-muted">Powered by Reviewlabs</Link>
      </div>
    </main>
  );
}
