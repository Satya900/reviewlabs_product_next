// Creates the Creator plans in Razorpay (monthly ₹299, yearly ₹2,999) and prints their ids.
// Run once per mode (test keys, then live keys):  node scripts/create-razorpay-plan.mjs
// Then set RAZORPAY_PLAN_MONTHLY_ID and RAZORPAY_PLAN_YEARLY_ID (locally in .env, and in Vercel).
import fs from "node:fs";

for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !secret) throw new Error("Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first");

async function createPlan(period, amount, name) {
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64") },
    body: JSON.stringify({
      period,
      interval: 1,
      item: { name, amount, currency: "INR", description: "Unlimited pages, coupons, analytics, Meta tracking, add-ons, 4% fees" },
      notes: { product: "reviewlabs" },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.id;
}

const monthly = await createPlan("monthly", 29900, "Reviewlabs Creator (monthly)");
const yearly = await createPlan("yearly", 299900, "Reviewlabs Creator (yearly)");
console.log(`${keyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} plans created`);
console.log(`RAZORPAY_PLAN_MONTHLY_ID=${monthly}`);
console.log(`RAZORPAY_PLAN_YEARLY_ID=${yearly}`);
