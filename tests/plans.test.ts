import { test } from "node:test";
import assert from "node:assert/strict";
import { currentTier, hasCreatorPlan, hasProPlan, platformFeePercent, priceLabel, trialDaysLeft, yearlySaving } from "../src/lib/plans.ts";

const now = Date.parse("2026-11-04T12:00:00Z");
const day = 86_400_000;
const base = { is_admin: false, plan: "free", plan_status: "none", plan_current_period_end: null as string | null, trial_ends_at: null as string | null };
const iso = (ms: number) => new Date(ms).toISOString();

test("trial gives every feature, then the store goes offline", () => {
  const trial = { ...base, trial_ends_at: iso(now + 3 * day) };
  assert.equal(currentTier(trial, now), "trial");
  assert.ok(hasCreatorPlan(trial, now) && hasProPlan(trial, now));
  assert.equal(trialDaysLeft(trial, now), 3);
  assert.equal(trialDaysLeft({ ...base, trial_ends_at: iso(now + 2 * 3600_000) }, now), 1);
  const over = { ...base, trial_ends_at: iso(now - 1000) };
  assert.equal(currentTier(over, now), "none");
  assert.ok(!hasCreatorPlan(over, now) && !hasProPlan(over, now));
  assert.equal(trialDaysLeft(over, now), null);
});

test("Creator has selling features but not AutoDM; Pro has both", () => {
  const creator = { ...base, plan: "creator", plan_status: "active", plan_current_period_end: iso(now + 10 * day) };
  assert.equal(currentTier(creator, now), "creator");
  assert.ok(hasCreatorPlan(creator, now) && !hasProPlan(creator, now));
  const pro = { ...creator, plan: "pro" };
  assert.equal(currentTier(pro, now), "pro");
  assert.ok(hasCreatorPlan(pro, now) && hasProPlan(pro, now));
});

test("a paid plan wins over a trial and has a 3-day grace period", () => {
  assert.equal(currentTier({ ...base, plan: "creator", plan_status: "active", trial_ends_at: iso(now + day) }, now), "creator");
  const lapsed = (days: number) => ({ ...base, plan: "pro", plan_status: "past_due", plan_current_period_end: iso(now - days * day) });
  assert.equal(currentTier(lapsed(2), now), "pro");
  assert.equal(currentTier(lapsed(4), now), "none");
  assert.equal(currentTier({ ...base, plan: "pro", plan_status: "cancelled", plan_current_period_end: iso(now + day) }, now), "none");
});

test("lifetime (no period end) stays Creator; admins count as Pro", () => {
  assert.equal(currentTier({ ...base, plan: "creator", plan_status: "active" }, now), "creator");
  assert.equal(currentTier({ ...base, is_admin: true }, now), "pro");
});

test("0% platform fee unless a custom deal sets one", () => {
  assert.equal(platformFeePercent({ commission_bps: null }), 0);
  assert.equal(platformFeePercent({}), 0);
  assert.equal(platformFeePercent({ commission_bps: 150 }), 1.5);
});

test("prices: yearly is 10 months", () => {
  assert.equal(priceLabel("creator", "month"), "₹799");
  assert.equal(priceLabel("creator", "year"), "₹7,990");
  assert.equal(priceLabel("pro", "month"), "₹1,999");
  assert.equal(priceLabel("pro", "year"), "₹19,990");
  assert.equal(yearlySaving("creator"), "₹1,598");
  assert.equal(yearlySaving("pro"), "₹3,998");
});
