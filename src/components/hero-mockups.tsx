import { Icon } from "@/components/marketing";
import { cx } from "@/components/ui";

const bars = [38, 52, 44, 70, 58, 86, 100];

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("rounded-3xl border border-dark-line bg-dark-elevated p-5 text-white shadow-float", className)}>{children}</div>;
}

// Illustrative product UI: what a creator's page, a sale and their earnings look like.
export function HeroMockups() {
  return (
    <div className="relative mx-auto h-[360px] w-full max-w-[540px] sm:h-[560px]" aria-hidden>
      {/* Payment page */}
      <Card className="absolute left-1/2 top-4 w-[300px] -translate-x-1/2 p-0 sm:left-[46%] sm:w-[310px]">
        <div className="relative h-36 overflow-hidden rounded-t-3xl bg-[linear-gradient(135deg,#0052ff_0%,#3d7bff_55%,#7aa5ff_100%)]">
          <div className="absolute bottom-4 left-5 h-28 w-20 rotate-[-6deg] rounded-lg bg-white/95 p-2 shadow-float">
            <div className="h-1.5 w-10 rounded-full bg-primary" />
            <div className="mt-2 h-1 w-12 rounded-full bg-hairline" />
            <div className="mt-1 h-1 w-9 rounded-full bg-hairline" />
            <div className="mt-6 h-1 w-11 rounded-full bg-hairline" />
          </div>
          <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">PDF · 42 pages</span>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-[17px] font-semibold leading-snug">The 30-day content calendar</p>
            <p className="mt-1 text-[13px] text-on-dark-soft">Instant download · Lifetime access</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="num text-[22px]">₹499</span>
            <span className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold">Buy now</span>
          </div>
          <div className="flex gap-2 text-[11px] text-on-dark-soft">
            {["UPI", "Cards", "Netbanking"].map((m) => (
              <span key={m} className="rounded-full border border-dark-line px-2 py-0.5">{m}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* New sale */}
      <Card className="absolute -right-2 top-24 hidden w-[220px] rotate-[4deg] animate-float sm:block">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-up/15 text-[14px] font-semibold text-up">A</span>
          <div className="min-w-0">
            <p className="text-[12px] text-on-dark-soft">New sale · just now</p>
            <p className="num text-[18px] text-up">+₹499.00</p>
          </div>
        </div>
      </Card>

      {/* Earnings */}
      <Card className="absolute -left-4 bottom-0 hidden w-[230px] rotate-[-5deg] animate-float-slow sm:block">
        <div className="flex items-baseline justify-between">
          <p className="text-[12px] text-on-dark-soft">This week</p>
          <p className="num text-[12px] text-up">+18%</p>
        </div>
        <p className="num mt-1 text-[24px]">₹12,475</p>
        <div className="mt-4 flex h-14 items-end gap-1.5">
          {bars.map((h, i) => (
            <span key={i} className={cx("flex-1 rounded-t", i === bars.length - 1 ? "bg-primary" : "bg-white/15")} style={{ height: `${h}%` }} />
          ))}
        </div>
      </Card>

      {/* Download */}
      <Card className="absolute -right-2 bottom-10 hidden w-[220px] rotate-[3deg] animate-float sm:block">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/20">
            <Icon name="file" className="size-5 text-primary" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">content-calendar.pdf</p>
            <p className="text-[12px] text-on-dark-soft">Sent to inbox · 4.2 MB</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
