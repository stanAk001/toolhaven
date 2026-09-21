/**
 * Custom campaign pricing.
 *
 * The rule these tests exist to defend: a package must always cost less than
 * assembling the same placements for the same days by hand. If that ever
 * inverts, the packages are pointless and anyone who bought one was overcharged
 * — so it is asserted rather than assumed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  quoteFor, discountFor, MIN_DAYS, MAX_DAYS, REFUSALS, sellableIndividually,
} from "../src/lib/promotion/custom.js";

const prisma = new PrismaClient();
const BOOST = ["HOMEPAGE_FEATURED", "CATEGORY_FEATURED", "PROMOTIONAL_DISCOVERY"];

test("a run length outside the sellable range is refused", async () => {
  for (const days of [0, 1, MIN_DAYS - 1, MAX_DAYS + 1, 365, "ten", null, 14.5]) {
    const q = await quoteFor(BOOST, days);
    assert.equal(q.ok, false, `${days} days should be refused`);
    assert.equal(q.reason, REFUSALS.DAYS);
  }
});

test("an empty or unknown placement list is refused", async () => {
  assert.equal((await quoteFor([], 14)).reason, REFUSALS.NONE);
  assert.equal((await quoteFor(null, 14)).reason, REFUSALS.NONE);
  assert.equal((await quoteFor(["NOT_A_PLACEMENT"], 14)).reason, REFUSALS.UNKNOWN);
});

test("the by-hand placements cannot be bought off the shelf", async () => {
  // They are fulfilled by an editor, so they are quoted, never day-rated.
  for (const k of ["SOCIAL_PROMOTION", "NEWSLETTER_PROMOTION"]) {
    const q = await quoteFor([k], 14);
    assert.equal(q.ok, false, `${k} must not be self-serve`);
    assert.equal(q.reason, REFUSALS.NOT_SOLD);
  }
  const mixed = await quoteFor([...BOOST, "NEWSLETTER_PROMOTION"], 14);
  assert.equal(mixed.ok, false, "and cannot be smuggled in alongside real ones");
});

test("a duplicated placement is charged once", async () => {
  const once = await quoteFor(["HOMEPAGE_FEATURED"], 14);
  const twice = await quoteFor(["HOMEPAGE_FEATURED", "HOMEPAGE_FEATURED"], 14);
  assert.equal(twice.usdCents, once.usdCents);
  assert.equal(twice.lines.length, 1);
});

test("the discount tiers apply at their stated thresholds", async () => {
  assert.equal(discountFor(7), 0);
  assert.equal(discountFor(13), 0);
  assert.equal(discountFor(14), 10);
  assert.equal(discountFor(29), 10);
  assert.equal(discountFor(30), 30);
  assert.equal(discountFor(90), 30);
});

test("the arithmetic is the rates times the days, less the tier", async () => {
  const q = await quoteFor(BOOST, 14);
  assert.equal(q.ok, true);
  const gross = q.lines.reduce((a, l) => a + l.dailyUsdCents * 14, 0);
  assert.equal(q.grossUsdCents, gross);
  assert.equal(q.usdCents, Math.round(gross * 0.9));
  assert.equal(q.discountPct, 10);
  // and nothing anywhere converts one currency into the other
  assert.notEqual(q.ngnKobo, q.usdCents);
});

test("a longer campaign never costs less in total than a shorter one", async () => {
  let prevUsd = 0, prevNgn = 0;
  for (const days of [7, 14, 21, 30, 60, 90]) {
    const q = await quoteFor(BOOST, days);
    assert.equal(q.ok, true, `${days} days should price`);
    assert.ok(q.usdCents >= prevUsd, `${days}d ($${q.usdCents / 100}) must not undercut the shorter run`);
    assert.ok(q.ngnKobo >= prevNgn, `${days}d must not undercut in naira either`);
    prevUsd = q.usdCents; prevNgn = q.ngnKobo;
  }
});

test("more placements always costs more than fewer", async () => {
  const one = await quoteFor(["HOMEPAGE_FEATURED"], 30);
  const two = await quoteFor(["HOMEPAGE_FEATURED", "CATEGORY_FEATURED"], 30);
  const three = await quoteFor(BOOST, 30);
  assert.ok(two.usdCents > one.usdCents && three.usdCents > two.usdCents);
  assert.ok(two.ngnKobo > one.ngnKobo && three.ngnKobo > two.ngnKobo);
});

test("every package undercuts building the same thing by hand", async () => {
  const plans = await prisma.promotionPlan.findMany({
    where: { active: true, quoteOnly: false, durationDays: { gt: 0 } },
  });
  assert.ok(plans.length > 0, "there should be packages on sale to compare against");

  const sellable = new Set((await sellableIndividually()).map((p) => p.key));
  for (const plan of plans) {
    const keys = plan.placements.filter((k) => sellable.has(k));
    if (!keys.length) continue;
    const q = await quoteFor(keys, plan.durationDays);
    assert.equal(q.ok, true, `${plan.slug} should be priceable by hand`);

    assert.ok(plan.priceUsdCents < q.usdCents,
      `${plan.slug}: package $${plan.priceUsdCents / 100} must beat custom $${q.usdCents / 100}`);
    assert.ok(plan.priceNgnKobo < q.ngnKobo,
      `${plan.slug}: package ₦${plan.priceNgnKobo / 100} must beat custom ₦${q.ngnKobo / 100}`);
  }
});

test.after(() => prisma.$disconnect());
