import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStorefront } from "@/lib/storefront-data";
import { StorefrontView } from "@/components/storefront-view";
import { StorefrontPixel } from "@/components/storefront-pixel";

// Served at /@handle (see the rewrite in next.config.ts).
export async function generateMetadata({ params }: PageProps<"/s/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const data = await getStorefront(handle);
  if (!data) return { title: "Not found" };
  const title = data.name ? `${data.name} (@${data.handle})` : `@${data.handle}`;
  return {
    title,
    description: data.bio || `Products by ${data.name || `@${data.handle}`}`,
    alternates: { canonical: `/@${data.handle}` },
    openGraph: { title, description: data.bio || undefined, images: data.avatarUrl ? [data.avatarUrl] : undefined, type: "profile" },
  };
}

export default async function StorefrontPage({ params }: PageProps<"/s/[handle]">) {
  const { handle } = await params;
  const data = await getStorefront(handle);
  if (!data) notFound();
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#eef3ff_0%,#f7f7f7_45%)]">
      <StorefrontPixel pixelId={data.pixelId} />
      <StorefrontView data={data} />
    </main>
  );
}
