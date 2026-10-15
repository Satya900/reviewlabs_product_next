import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicLeadMagnet } from "@/lib/lead-magnet-data";
import { resolvePixelRow } from "@/lib/meta";
import { creatorHasPlan } from "@/lib/plans-server";
import { COVER_PRESETS } from "@/lib/lead-magnets";
import { LeadMagnetCard } from "@/components/lead-magnet-card";

export async function generateMetadata({ params }: PageProps<"/l/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicLeadMagnet(slug);
  if (!data) return { title: "Not found" };
  return {
    title: data.magnet.title,
    description: data.magnet.description || `Free from ${data.form.creatorName || "a creator"}`,
    alternates: { canonical: `/l/${data.magnet.slug}` },
    openGraph: { title: data.magnet.title, description: data.magnet.description || undefined, images: data.magnet.cover_image_url ? [data.magnet.cover_image_url] : undefined },
  };
}

export default async function LeadMagnetPage({ params }: PageProps<"/l/[slug]">) {
  const { slug } = await params;
  const data = await getPublicLeadMagnet(slug);
  if (!data) notFound();
  const [pixel, hasPlan] = await Promise.all([resolvePixelRow({ creatorId: data.magnet.creator_id }), creatorHasPlan(data.magnet.creator_id)]);
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:py-16" style={{ background: COVER_PRESETS[data.magnet.cover_preset] }}>
      {data.magnet.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.magnet.cover_image_url} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
      )}
      <div className="relative flex w-full flex-col items-center">
        <LeadMagnetCard data={data.form} files={data.files} pixelId={pixel?.pixel_id ?? null} />
        {!hasPlan && <Link href="/" className="mt-6 rounded-full bg-black/25 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">Made with Reviewlabs</Link>}
      </div>
    </main>
  );
}
