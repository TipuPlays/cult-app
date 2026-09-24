import { customAlphabet } from "nanoid";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  fraudFlags,
  members,
  referralClaims,
  referralCodes,
} from "@/db/schema";
import { awardXpInTx, LedgerError, mutateCreditsInTx } from "@/lib/ledgers";
import { notifyUser } from "@/lib/notifications";

const codeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export const REFERRAL_REWARDS = {
  referrerXp: 50,
  referrerCredits: 15,
  refereeXp: 25,
  refereeCredits: 25,
} as const;

const MAX_CLAIMS_PER_REFERRER_DAY = 5;

export async function ensureReferralCode(memberId: string) {
  const existing = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.memberId, memberId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [created] = await db
    .insert(referralCodes)
    .values({
      memberId,
      code: `CULT-${codeAlphabet()}`,
    })
    .returning();
  return created;
}

export async function claimReferral(input: {
  refereeMemberId: string;
  refereeUserId: string;
  code: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  const code = input.code.trim().toUpperCase();

  return db.transaction(async (tx) => {
    const priorClaim = await tx
      .select()
      .from(referralClaims)
      .where(eq(referralClaims.refereeMemberId, input.refereeMemberId))
      .limit(1);
    if (priorClaim[0]) {
      if (priorClaim[0].idempotencyKey === input.idempotencyKey) {
        return { claim: priorClaim[0], replayed: true as const };
      }
      throw new LedgerError("Referral already claimed", "DUPLICATE");
    }

    const idemHit = await tx
      .select()
      .from(referralClaims)
      .where(
        and(
          eq(referralClaims.refereeMemberId, input.refereeMemberId),
          eq(referralClaims.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (idemHit[0]) {
      return { claim: idemHit[0], replayed: true as const };
    }

    const [refCode] = await tx
      .select()
      .from(referralCodes)
      .where(and(eq(referralCodes.code, code), eq(referralCodes.active, true)))
      .limit(1)
      .for("update");

    if (!refCode) throw new LedgerError("Invalid referral code", "NOT_FOUND");

    // Anti-abuse: self-referral
    if (refCode.memberId === input.refereeMemberId) {
      await tx.insert(fraudFlags).values({
        memberId: input.refereeMemberId,
        kind: "referral_self",
        severity: 90,
        payload: { code },
      });
      throw new LedgerError("Self-referral not allowed", "INVALID");
    }

    // Velocity: referrer claims today
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [velocity] = await tx
      .select({ c: count() })
      .from(referralClaims)
      .where(
        and(
          eq(referralClaims.referrerMemberId, refCode.memberId),
          gte(referralClaims.createdAt, dayStart),
        ),
      );
    if (Number(velocity?.c ?? 0) >= MAX_CLAIMS_PER_REFERRER_DAY) {
      await tx.insert(fraudFlags).values({
        memberId: refCode.memberId,
        kind: "referral_velocity",
        severity: 70,
        payload: {
          code,
          dayClaims: Number(velocity?.c ?? 0),
          limit: MAX_CLAIMS_PER_REFERRER_DAY,
        },
      });
      throw new LedgerError("Referral velocity limit reached", "INVALID");
    }

    const [referrer] = await tx
      .select()
      .from(members)
      .where(eq(members.id, refCode.memberId))
      .limit(1)
      .for("update");
    const [referee] = await tx
      .select()
      .from(members)
      .where(eq(members.id, input.refereeMemberId))
      .limit(1)
      .for("update");
    if (!referrer || !referee) {
      throw new LedgerError("Member not found", "NOT_FOUND");
    }

    const [claim] = await tx
      .insert(referralClaims)
      .values({
        codeId: refCode.id,
        referrerMemberId: referrer.id,
        refereeMemberId: referee.id,
        status: "rewarded",
        referrerXp: REFERRAL_REWARDS.referrerXp,
        referrerCredits: REFERRAL_REWARDS.referrerCredits,
        refereeXp: REFERRAL_REWARDS.refereeXp,
        refereeCredits: REFERRAL_REWARDS.refereeCredits,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    await awardXpInTx(tx, {
      memberId: referrer.id,
      delta: REFERRAL_REWARDS.referrerXp,
      reason: "Referral reward (referrer)",
      idempotencyKey: `ref-xp-r:${claim.id}`,
      actorId: input.refereeUserId,
      refType: "referral",
      refId: claim.id,
    });
    await mutateCreditsInTx(tx, {
      memberId: referrer.id,
      delta: REFERRAL_REWARDS.referrerCredits,
      reason: "Referral reward (referrer)",
      idempotencyKey: `ref-cr-r:${claim.id}`,
      actorId: input.refereeUserId,
      refType: "referral",
      refId: claim.id,
    });
    await awardXpInTx(tx, {
      memberId: referee.id,
      delta: REFERRAL_REWARDS.refereeXp,
      reason: "Referral welcome (referee)",
      idempotencyKey: `ref-xp-e:${claim.id}`,
      actorId: input.refereeUserId,
      refType: "referral",
      refId: claim.id,
    });
    await mutateCreditsInTx(tx, {
      memberId: referee.id,
      delta: REFERRAL_REWARDS.refereeCredits,
      reason: "Referral welcome (referee)",
      idempotencyKey: `ref-cr-e:${claim.id}`,
      actorId: input.refereeUserId,
      refType: "referral",
      refId: claim.id,
    });

    await tx.insert(auditEvents).values({
      actorId: input.refereeUserId,
      action: "referral.claimed",
      entityType: "referral_claim",
      entityId: claim.id,
      payload: {
        code,
        referrerMemberId: referrer.id,
        refereeMemberId: referee.id,
      },
    });

    return { claim, replayed: false as const };
  }).then(async (result) => {
    if (!result.replayed) {
      const [codeRow] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.id, result.claim.codeId))
        .limit(1);
      if (codeRow) {
        const [referrer] = await db
          .select()
          .from(members)
          .where(eq(members.id, codeRow.memberId))
          .limit(1);
        if (referrer) {
          await notifyUser(referrer.userId, "referral_reward", {
            claimId: result.claim.id,
          });
        }
      }
      await notifyUser(input.refereeUserId, "referral_welcome", {
        claimId: result.claim.id,
      });
    }
    return result;
  });
}
