// Creates the monthly Creator plan in Razorpay and prints its id.
// Run once per mode (test keys, then live keys):  node scripts/create-razorpay-plan.mjs
// Then set RAZORPAY_CREATOR_PLAN_ID to the printed id (locally in .env, and in Vercel).
import fs from "node:fs";

for (const line of fs.existsSync(".env") ? fs.readFileSync(".env", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
if (!keyId || !secret) throw new Error("Set NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first");

const res = await fetch("https://api.razorpay.com/v1/plans", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Basic " + Buffer.from(`${keyId}:${secret}`).toString("base64") },
  body: JSON.stringify({
    period: "monthly",
    interval: 1,
    item: { name: "Reviewlabs Creator", amount: 9900, currency: "INR", description: "Unlimited pages, coupons, analytics, Meta tracking and CSV export" },
    notes: { product: "reviewlabs" },
  }),
});
const body = await res.json();
if (!res.ok) throw new Error(JSON.stringify(body));
console.log(`${keyId.startsWith("rzp_live_") ? "LIVE" : "TEST"} plan created: ${body.id}`);
console.log(`RAZORPAY_CREATOR_PLAN_ID=${body.id}`);
