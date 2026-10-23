import Link from "next/link";
import type { ReactNode } from "react";
import { legalLinks, site } from "@/lib/site";
import { NavTheme } from "@/components/nav-theme";
import { Logo } from "@/components/top-nav";

const footerColumns = [
  { title: "Product", links: [{ href: "/features", label: "Features" }, { href: "/how-it-works", label: "How it works" }, { href: "/pricing", label: "Pricing" }, { href: "/custom", label: "Custom plan" }, { href: "/compare/superprofile", label: "vs Superprofile" }, { href: "/login", label: "Creator login" }] },
  { title: "Company", links: [{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/signup", label: "Create account" }] },
  { title: "Legal", links: legalLinks.filter((l) => l.href !== "/contact") },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas px-5 pt-16 sm:px-8">
      <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-[14px] text-body">{site.description}</p>
          <a href={`mailto:${site.supportEmail}`} className="link text-[14px]">{site.supportEmail}</a>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <p className="text-[14px] font-semibold text-ink">{col.title}</p>
            <ul className="mt-4 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[14px] text-body">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-14 flex max-w-[1200px] flex-wrap justify-between gap-3 border-t border-hairline py-6 text-[13px] text-muted">
        <p>© 2026 {site.legalName}. {site.name} is a product of {site.legalName}.</p>
        <p>Payments are processed by Razorpay. We never see your card or UPI details.</p>
      </div>
    </footer>
  );
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavTheme />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

// Buyer pages: slim nav so nothing competes with checkout.
// While a product page's buy bar is pinned (below 832px, where its container is
// under 48rem), leave room so the content and footer can scroll clear of it.
export function BuyerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-soft max-[832px]:has-[[data-buy-bar]]:pb-[120px]">
      <header className="border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5 sm:px-8">
          <Logo />
          <span className="flex items-center gap-2 text-[13px] font-medium text-body">
            <svg viewBox="0 0 24 24" className="size-4 text-up" aria-hidden><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            Secure checkout
          </span>
        </div>
      </header>
      <main className="flex-1 px-5 py-8 sm:px-8 md:py-12">{children}</main>
      <footer className="border-t border-hairline bg-canvas px-5 py-6 text-[13px] text-muted sm:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap justify-between gap-3">
          <p>Sold through {site.name} by {site.legalName}. Payments by Razorpay.</p>
          <p className="flex flex-wrap gap-4">
            {legalLinks.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          </p>
        </div>
      </footer>
    </div>
  );
}
