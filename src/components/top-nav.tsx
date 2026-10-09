import Link from "next/link";
import { site } from "@/lib/site";
import { buttonClass, cx } from "@/components/ui";
import { LogoMark } from "@/components/logo-mark";

export function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label={`${site.name} home`}>
      <LogoMark className="size-8" />
      <span className={cx("text-[19px] font-semibold tracking-tight", dark ? "text-white" : "text-ink")}>{site.name}</span>
    </Link>
  );
}

const navItems = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function TopNav({ dark }: { dark?: boolean }) {
  return (
    <header className={cx("sticky top-0 z-40 border-b", dark ? "border-dark-line bg-dark/90 text-white backdrop-blur" : "border-hairline bg-canvas/90 backdrop-blur")}>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-5 sm:px-8">
        <Logo dark={dark} />
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={cx("text-[14px] font-medium", dark ? "text-white/85" : "text-ink")}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className={cx("hidden px-3 text-[14px] font-semibold sm:block", dark ? "text-white" : "text-ink")}>
            Log in
          </Link>
          <Link href="/contact" className={cx(buttonClass.primary, "h-10 px-4 text-[14px]")}>Get an invite</Link>
          <details className="relative md:hidden">
            <summary className={cx("flex size-10 cursor-pointer list-none items-center justify-center rounded-full [&::-webkit-details-marker]:hidden", dark ? "bg-dark-elevated" : "bg-surface-strong")} aria-label="Menu">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </summary>
            <div className="absolute right-0 top-12 w-60 rounded-3xl border border-hairline bg-canvas p-3 text-ink shadow-soft">
              {[...navItems, { href: "/login", label: "Log in" }].map((item) => (
                <Link key={item.href} href={item.href} className="block rounded-2xl px-4 py-3 text-[15px] font-medium">
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
