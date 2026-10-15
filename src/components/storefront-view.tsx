import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { cx } from "@/components/ui";
import { formatPaise } from "@/lib/money";
import { SOCIALS, socialHref, type SocialKey } from "@/lib/storefront";

// A product page, or a lead magnet (isFree, links to /l/slug).
export type StorefrontProduct = { id: string; href: string; title: string; amountPaise: number; isFree: boolean; cover: string | null };
export type StorefrontData = {
  name: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  socials: Record<string, string>;
  products: StorefrontProduct[];
  featuredId: string | null;
  showBranding: boolean;
};

function SocialIcon({ k }: { k: SocialKey }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<SocialKey, React.ReactNode> = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" {...p} /><circle cx="12" cy="12" r="4" {...p} /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></>,
    youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" {...p} /><path d="m10 9 5 3-5 3z" fill="currentColor" /></>,
    x: <path d="M4 4l16 16M20 4 4 20" {...p} />,
    linkedin: <><rect x="3" y="3" width="18" height="18" rx="3" {...p} /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" {...p} /></>,
    facebook: <path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z" {...p} />,
    telegram: <path d="m3 11 18-7-3 16-6-5-3 3v-5l9-8-11 7z" {...p} />,
    whatsapp: <><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5z" {...p} /><path d="M9 9.5c.5 2 2 3.5 4 4l1.2-1.2 2 1-.5 1.5c-3 .5-7-3.5-6.5-6.5l1.5-.5 1 2z" fill="currentColor" /></>,
    website: <><circle cx="12" cy="12" r="9" {...p} /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" {...p} /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="3" {...p} /><path d="m4 7 8 6 8-6" {...p} /></>,
  };
  return <svg viewBox="0 0 24 24" className="size-5" aria-hidden>{icons[k]}</svg>;
}

// Creator photo, or their initial on a brand gradient when there's none.
export function ProfilePhoto({ url, name, size, className }: { url: string | null; name: string; size: number; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={cx("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className={cx("flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0052ff,#7aa5ff)] font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name.trim()[0] ?? "R").toUpperCase()}
    </span>
  );
}

function Price({ p }: { p: StorefrontProduct }) {
  return p.isFree ? (
    <span className="rounded-full bg-[#e6f7ef] px-2.5 py-1 text-[12px] font-semibold text-up">Free</span>
  ) : (
    <span className="num text-[15px] font-semibold">{formatPaise(p.amountPaise).replace(".00", "")}</span>
  );
}

function Cover({ p, className }: { p: StorefrontProduct; className?: string }) {
  return p.cover ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.cover} alt="" className={cx("object-cover", className)} />
  ) : (
    <span className={cx("block bg-[linear-gradient(135deg,#0052ff_0%,#3d7bff_55%,#7aa5ff_100%)]", className)} />
  );
}

// The public link-in-bio page; also rendered in the dashboard preview.
export function StorefrontView({ data, preview }: { data: StorefrontData; preview?: boolean }) {
  const socials = SOCIALS.map((s) => ({ ...s, href: socialHref(s.key, data.socials[s.key] ?? "") })).filter((s) => s.href);
  const featured = data.products.find((p) => p.id === data.featuredId) ?? null;
  const rest = data.products.filter((p) => p.id !== featured?.id);
  const linkProps = preview ? { onClick: (e: React.MouseEvent) => e.preventDefault() } : {};

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 pb-12 pt-10">
      <header className="text-center">
        <ProfilePhoto url={data.avatarUrl} name={data.name || data.handle} size={96} className="mx-auto ring-4 ring-canvas shadow-soft" />
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">{data.name || `@${data.handle}`}</h1>
        <p className="text-[14px] text-muted">@{data.handle || "yourname"}</p>
        {data.bio && <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-body">{data.bio}</p>}
        {socials.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {socials.map((s) => (
              <a
                key={s.key}
                href={s.href!}
                target="_blank"
                rel="noopener noreferrer nofollow me"
                aria-label={s.label}
                className="flex size-11 items-center justify-center rounded-full bg-canvas text-ink shadow-soft ring-1 ring-hairline transition hover:text-primary"
                {...linkProps}
              >
                <SocialIcon k={s.key} />
              </a>
            ))}
          </div>
        )}
      </header>

      {featured && (
        <Link href={featured.href} className="mt-8 block overflow-hidden rounded-3xl bg-canvas shadow-soft ring-1 ring-hairline transition hover:ring-primary" {...linkProps}>
          <Cover p={featured} className="aspect-[16/9] w-full" />
          <div className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-primary">Featured</span>
              <p className="mt-0.5 text-[18px] font-semibold leading-snug">{featured.title}</p>
            </div>
            <Price p={featured} />
          </div>
        </Link>
      )}

      <ul className="mt-4 space-y-3">
        {rest.map((p) => (
          <li key={p.id}>
            <Link href={p.href} className="flex items-center gap-4 rounded-2xl bg-canvas p-3 shadow-soft ring-1 ring-hairline transition hover:ring-primary" {...linkProps}>
              <Cover p={p} className="size-16 shrink-0 rounded-xl" />
              <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug">{p.title}</span>
              <span className="shrink-0 pr-2"><Price p={p} /></span>
            </Link>
          </li>
        ))}
      </ul>

      {!data.products.length && <p className="mt-10 text-center text-[15px] text-muted">No products here yet.</p>}

      {data.showBranding && (
        <Link href="/" className="mx-auto mt-12 flex w-fit items-center gap-2 rounded-full bg-canvas px-4 py-2 text-[13px] font-medium text-body shadow-soft ring-1 ring-hairline" {...linkProps}>
          <LogoMark className="size-5" />
          Made with Reviewlabs
        </Link>
      )}
    </div>
  );
}
