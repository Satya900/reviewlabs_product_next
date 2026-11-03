// Creates the four subscription plans in Razorpay and prints their ids:
// Creator ₹799/month and ₹7,990/year, Pro ₹1,999/month and ₹19,990/year (GST included).
// Run once per mode (test keys, then live keys):  node scripts/create-razorpay-plan.mjs
// Then set the four RAZORPAY_PLAN_*_ID values (locally in .env, and in Vercel).
import fs from "node:fs";

for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !secret) throw new Error("Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first");

async function createPlan(period, amount, name, description) {
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64") },
    body: JSON.stringify({ period, interval: 1, item: { name, amount, currency: "INR", description }, notes: { product: "reviewlabs" } }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body.id;
}

const creator = "Unlimited products, 0% platform fee, storefront, coupons, analytics";
const pro = "Everything in Creator plus Instagram AutoDM";
const ids = {
  RAZORPAY_PLAN_CREATOR_MONTHLY_ID: await createPlan("monthly", 79900, "Reviewlabs Creator (monthly)", creator),
  RAZORPAY_PLAN_CREATOR_YEARLY_ID: await createPlan("yearly", 799000, "Reviewlabs Creator (yearly)", creator),
  RAZORPAY_PLAN_PRO_MONTHLY_ID: await createPlan("monthly", 199900, "Reviewlabs Pro (monthly)", pro),
  RAZORPAY_PLAN_PRO_YEARLY_ID: await createPlan("yearly", 1999000, "Reviewlabs Pro (yearly)", pro),
};
console.log(`${keyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} plans created`);
for (const [k, v] of Object.entries(ids)) console.log(`${k}=${v}`);
