"use client";

import { useState } from "react";
import { cx, inputClass } from "@/components/ui";
import { formatPaise } from "@/lib/money";

const rupees = (n: number) => formatPaise(Math.round(n * 100)).replace(/\.00$/, "");

// Creators enter what they pay today; we never assume a competitor's numbers.
export function SavingsCalculator({ creatorFee, creatorPlan, lifetime }: { creatorFee: number; creatorPlan: number; lifetime: number }) {
  const [price, setPrice] = useState("499");
  const [sales, setSales] = useState("100");
  const [theirFee, setTheirFee] = useState("");
  const [theirPlan, setTheirPlan] = useState("");
  const [theirGateway, setTheirGateway] = useState("");

  const revenue = (Number(price) || 0) * (Number(sales) || 0);
  const ready = theirFee !== "" || theirPlan !== "";
  const nowCost = revenue * ((Number(theirFee) || 0) + (Number(theirGateway) || 0)) / 100 + (Number(theirPlan) || 0);
  const ourCost = revenue * creatorFee / 100 + creatorPlan;
  const ourLifetimeCost = revenue * creatorFee / 100;
  const saving = nowCost - ourCost;

  const field = (label: string, value: string, set: (v: string) => void, suffix: string, placeholder = "") => (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-medium">{label}</span>
      <span className="relative block">
        <input value={value} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" placeholder={placeholder} className={cx(inputClass, "pr-14")} />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted">{suffix}</span>
      </span>
    </label>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-3xl border border-hairline bg-canvas p-6">
        <p className="text-[16px] font-semibold">Your sales</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("Product price", price, setPrice, "₹")}
          {field("Sales per month", sales, setSales, "sales")}
        </div>
        <p className="pt-2 text-[16px] font-semibold">What you pay today</p>
        <p className="-mt-2 text-[13px] text-muted">Check your current plan and payout statements.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("Plan per month", theirPlan, setTheirPlan, "₹", "e.g. 499")}
          {field("Fee per sale", theirFee, setTheirFee, "%", "e.g. 5")}
          {field("Gateway charge", theirGateway, setTheirGateway, "%", "if extra")}
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-3xl bg-dark p-6 text-white">
        <div className="space-y-4">
          <p className="text-[14px] text-on-dark-soft">Monthly sales: <span className="num text-white">{rupees(revenue)}</span></p>
          <dl className="space-y-3 text-[15px]">
            <div className="flex justify-between"><dt className="text-on-dark-soft">You pay today</dt><dd className="num">{ready ? rupees(nowCost) : "Fill in your plan and fee"}</dd></div>
            <div className="flex justify-between"><dt className="text-on-dark-soft">Reviewlabs Creator ({creatorFee}% + {rupees(creatorPlan)})</dt><dd className="num">{rupees(ourCost)}</dd></div>
            <div className="flex justify-between"><dt className="text-on-dark-soft">Reviewlabs Lifetime ({creatorFee}%, plan paid once)</dt><dd className="num">{rupees(ourLifetimeCost)}</dd></div>
          </dl>
        </div>
        <div className="mt-6 rounded-2xl bg-dark-elevated p-5">
          {ready ? (
            saving > 0 ? (
              <>
                <p className="text-[14px] text-on-dark-soft">You could keep about</p>
                <p className="num mt-1 text-[36px] text-up">{rupees(saving)}<span className="text-[16px] text-on-dark-soft"> / month</span></p>
                <p className="mt-1 text-[13px] text-on-dark-soft">That&apos;s {rupees(saving * 12)} a year on Creator monthly. Lifetime ({rupees(lifetime)} once) saves more after the first year.</p>
              </>
            ) : (
              <p className="text-[15px] text-on-dark-soft">At these numbers your current setup costs about the same or less. Lifetime may still work out cheaper over time.</p>
            )
          ) : (
            <p className="text-[15px] text-on-dark-soft">Enter what you pay today to see the difference.</p>
          )}
        </div>
      </div>
    </div>
  );
}
