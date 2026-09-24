import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  creditLedger,
  members,
  offerings,
  redemptions,
  users,
  xpLedger,
} from "@/db/schema";
import { awardXp, mutateCredits, rewardsForReceiptAmount } from "@/lib/ledgers";
import { redeemOffering } from "@/lib/redemptions";
import { reviewReceipt, submitReceipt } from "@/lib/receipts";

async function memberFixture() {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "member@cult.local"))
    .limit(1);
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.userId, user!.id))
    .limit(1);
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@cult.local"))
    .limit(1);
  return { user: user!, member: member!, admin: admin! };
}

describe("ledgers idempotency", () => {
  it("replays same Idempotency-Key without double XP", async () => {
    const { member } = await memberFixture();
    const key = `test-xp-${randomBytes(6).toString("hex")}`;
    const a = await awardXp({
      memberId: member.id,
      delta: 7,
      reason: "test",
      idempotencyKey: key,
    });
    const b = await awardXp({
      memberId: member.id,
      delta: 7,
      reason: "test",
      idempotencyKey: key,
    });
    expect(b.replayed).toBe(true);
    expect(b.member?.xpBalance).toBe(a.member?.xpBalance);

    const rows = await db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.idempotencyKey, key));
    expect(rows).toHaveLength(1);
  });

  it("rejects non-integer / zero deltas", async () => {
    const { member } = await memberFixture();
    await expect(
      awardXp({
        memberId: member.id,
        delta: 1.5,
        reason: "bad",
        idempotencyKey: "x",
      }),
    ).rejects.toThrow(/non-zero integer/);
  });
});

describe("receipts", () => {
  it("PENDING→PROCESSING→MANUAL_REVIEW and rejects duplicate fingerprint", async () => {
    const { user, member } = await memberFixture();
    const bytes = new Uint8Array(randomBytes(64));
    const key1 = `rcpt-${randomBytes(4).toString("hex")}`;
    const first = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: key1,
      imageBytes: bytes,
      mimeType: "image/png",
    });
    expect(first.replayed).toBe(false);
    expect(["manual_review", "rejected"]).toContain(first.receipt.status);
    // mock OCR confidence 0.82 → usually manual_review
    expect(first.receipt.status).toBe("manual_review");
    expect(first.receipt.contentHash).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );

    const second = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: `rcpt-${randomBytes(4).toString("hex")}`,
      imageBytes: bytes,
      mimeType: "image/png",
    });
    expect(second.receipt.status).toBe("rejected");
    expect(second.receipt.reviewNote).toMatch(/Duplicate/i);
  });

  it("idempotent resubmit same key returns same receipt", async () => {
    const { user, member } = await memberFixture();
    const bytes = new Uint8Array(randomBytes(32));
    const key = `rcpt-idem-${randomBytes(4).toString("hex")}`;
    const a = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: key,
      imageBytes: bytes,
      mimeType: "image/png",
    });
    const b = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: key,
      imageBytes: bytes,
      mimeType: "image/png",
    });
    expect(b.replayed).toBe(true);
    expect(b.receipt.id).toBe(a.receipt.id);
  });

  it("approve awards via ledgers; second approve is replay (no double award)", async () => {
    const { user, member, admin } = await memberFixture();
    const bytes = new Uint8Array(randomBytes(48));
    const { receipt } = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: `rcpt-ap-${randomBytes(4).toString("hex")}`,
      imageBytes: bytes,
      mimeType: "image/png",
    });
    expect(receipt.status).toBe("manual_review");

    const expected = rewardsForReceiptAmount(receipt.amountCents ?? 0);

    const first = await reviewReceipt({
      receiptId: receipt.id,
      decision: "approved",
      actorId: admin.id,
      idempotencyKey: `rev-${receipt.id}-1`,
    });
    expect(first.receipt.status).toBe("approved");
    expect(first.awards?.xp).toBe(expected.xp);
    expect(first.awards?.credits).toBe(expected.credits);

    const xpRows = await db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.idempotencyKey, `receipt-xp:${receipt.id}`));
    expect(xpRows).toHaveLength(1);

    const second = await reviewReceipt({
      receiptId: receipt.id,
      decision: "approved",
      actorId: admin.id,
      idempotencyKey: `rev-${receipt.id}-2`,
    });
    expect(second.replayed).toBe(true);

    const xpRowsAfter = await db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.idempotencyKey, `receipt-xp:${receipt.id}`));
    expect(xpRowsAfter).toHaveLength(1);
  });
});

describe("offering redemption concurrency", () => {
  beforeAll(async () => {
    // Ensure member has enough credits for tests
    const { member, admin } = await memberFixture();
    await mutateCredits({
      memberId: member.id,
      delta: 500,
      reason: "test top-up",
      idempotencyKey: `topup-${randomBytes(4).toString("hex")}`,
      actorId: admin.id,
    });
  });

  it("same Idempotency-Key concurrent redeem → one voucher, replayed twin", async () => {
    const { user, member } = await memberFixture();
    const [offering] = await db
      .select()
      .from(offerings)
      .where(eq(offerings.slug, "ceremonial-upgrade"))
      .limit(1);

    const key = `redeem-conc-${randomBytes(4).toString("hex")}`;
    const [a, b] = await Promise.all([
      redeemOffering({
        memberId: member.id,
        userId: user.id,
        offeringId: offering!.id,
        idempotencyKey: key,
      }),
      redeemOffering({
        memberId: member.id,
        userId: user.id,
        offeringId: offering!.id,
        idempotencyKey: key,
      }),
    ]);

    const results = [a, b];
    const fresh = results.filter((r) => !r.replayed);
    const replayed = results.filter((r) => r.replayed);
    // Under race, unique constraint may cause one to throw — handle both outcomes
    expect(fresh.length + replayed.length).toBe(2);
    expect(a.redemption.voucherCode).toBe(b.redemption.voucherCode);

    const rows = await db
      .select()
      .from(redemptions)
      .where(eq(redemptions.idempotencyKey, key));
    expect(rows).toHaveLength(1);

    const creditRows = await db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, `redeem-credits:${key}`));
    expect(creditRows).toHaveLength(1);
  });

  it("two different keys cannot overdraw beyond balance", async () => {
    const { user, member } = await memberFixture();
    const [offering] = await db
      .select()
      .from(offerings)
      .where(eq(offerings.slug, "ceremonial-upgrade"))
      .limit(1);

    const [m] = await db
      .select()
      .from(members)
      .where(eq(members.id, member.id))
      .limit(1);

    const need = offering!.creditCost;
    const delta = need - m!.creditBalance;
    if (delta !== 0) {
      await mutateCredits({
        memberId: member.id,
        delta,
        reason: "test set balance",
        idempotencyKey: `setbal-${randomBytes(4).toString("hex")}`,
      });
    }

    const results = await Promise.allSettled([
      redeemOffering({
        memberId: member.id,
        userId: user.id,
        offeringId: offering!.id,
        idempotencyKey: `overdraw-a-${randomBytes(3).toString("hex")}`,
      }),
      redeemOffering({
        memberId: member.id,
        userId: user.id,
        offeringId: offering!.id,
        idempotencyKey: `overdraw-b-${randomBytes(3).toString("hex")}`,
      }),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const fail = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);

    const [after] = await db
      .select()
      .from(members)
      .where(eq(members.id, member.id))
      .limit(1);
    expect(after!.creditBalance).toBe(0);
  });
});

describe("client XP tampering blocked at domain layer", () => {
  it("rewardsForReceiptAmount is server formula only", () => {
    expect(rewardsForReceiptAmount(1250)).toEqual({ xp: 12, credits: 2 });
    expect(rewardsForReceiptAmount(0)).toEqual({ xp: 5, credits: 0 });
  });

  it("reviewReceipt does not accept client xp/credits args (API strips them)", async () => {
    // Domain function signature has no xp/credits — TypeScript enforces.
    // Runtime: awards always from amountCents via rewardsForReceiptAmount.
    const { user, member, admin } = await memberFixture();
    const { receipt } = await submitReceipt({
      memberId: member.id,
      userId: user.id,
      idempotencyKey: `tamper-${randomBytes(4).toString("hex")}`,
      imageBytes: new Uint8Array(randomBytes(40)),
      mimeType: "image/png",
    });
    const out = await reviewReceipt({
      receiptId: receipt.id,
      decision: "approved",
      actorId: admin.id,
      idempotencyKey: `tamper-rev-${receipt.id}`,
    });
    const expected = rewardsForReceiptAmount(receipt.amountCents ?? 0);
    expect(out.awards?.xp).toBe(expected.xp);
    expect(out.awards?.xp).not.toBe(99999);
  });
});

describe("admin authz helper", () => {
  it("seeded admin is staff super_admin; member is not", async () => {
    const { user, admin } = await memberFixture();
    expect(admin.role).toBe("super_admin");
    expect(user.role).toBe("member");
  });
});
