/**
 * Bringing a payment to rest.
 *
 * Two things can tell us a payment happened: the provider's webhook, and the
 * buyer arriving back from checkout. Either may land first, either may be lost,
 * and neither is allowed to be the only one that works — so both call this.
 *
 * It lives in its own module because both the public webhook route and the
 * vendor's return route need it, and having those two import each other is the
 * kind of cycle that works until the day it doesn't.
 *
 * Idempotent by construction: a payment already marked PAID returns before any
 * provider call, so a webhook delivered five times settles one campaign and
 * costs four cheap database reads.
 */
import { prisma } from "../prisma.js";
import { STATUS, canMove } from "./lifecycle.js";
import { PAYMENT_STATUS, verify } from "./payments.js";
import { audit } from "./campaigns.js";
import { sendPaymentReceived, notifyEditorPending } from "./campaignmail.js";

export async function settlePayment({ provider, reference, via = "return" }) {
  const payment = await prisma.promotionPayment.findUnique({
    where: { provider_reference: { provider, reference } },
    include: {
      campaign: {
        include: {
          tool: { select: { name: true, slug: true } },
          plan: { select: { name: true } },
        },
      },
    },
  });
  if (!payment) return { ok: false, reason: "unknown reference" };
  if (payment.status === PAYMENT_STATUS.PAID) return { ok: true, already: true };

  // The provider is asked directly. A redirect back from checkout proves only
  // that a browser visited a URL, and anyone can visit a URL.
  const result = await verify({
    provider,
    reference,
    expectMinor: payment.amountMinor,
    expectCurrency: payment.currency,
  });

  if (!result.paid) {
    await prisma.promotionPayment.update({
      where: { id: payment.id },
      data: {
        providerStatus: result.providerStatus?.slice(0, 60) || null,
        // A mismatch is a failure worth keeping; a merely pending charge stays
        // pending so the buyer can complete it.
        status: result.mismatch ? PAYMENT_STATUS.FAILED : payment.status,
        verifiedAt: new Date(),
      },
    });
    if (result.mismatch) {
      await audit("payment.mismatch", {
        campaignId: payment.campaignId,
        actor: "system",
        detail: `${provider} ${reference}: ${result.mismatch}`,
      });
    }
    return { ok: false, reason: result.mismatch || result.providerStatus };
  }

  const campaign = payment.campaign;
  const goesToReview = canMove(campaign.status, STATUS.PAYMENT_RECEIVED);

  const [, updated] = await prisma.$transaction([
    prisma.promotionPayment.update({
      where: { id: payment.id },
      data: {
        status: PAYMENT_STATUS.PAID,
        providerStatus: result.providerStatus?.slice(0, 60) || null,
        paidAt: result.paidAt || new Date(),
        verifiedAt: new Date(),
      },
    }),
    prisma.promotionCampaign.update({
      where: { id: campaign.id },
      // Paying buys a place in the review queue, never a place on the site.
      data: goesToReview ? { status: STATUS.PENDING_REVIEW } : {},
      include: { tool: { select: { name: true } }, plan: { select: { name: true } } },
    }),
  ]);

  await audit("payment.settled", {
    campaignId: campaign.id,
    actor: "system",
    detail: `${provider} ${reference} via ${via}`,
  });

  const full = {
    ...updated,
    ownerEmail: campaign.ownerEmail,
    submissionId: campaign.submissionId,
    slug: campaign.slug,
  };
  await sendPaymentReceived(full, { ...payment, reference });
  await notifyEditorPending(full);

  return { ok: true, settled: true };
}
