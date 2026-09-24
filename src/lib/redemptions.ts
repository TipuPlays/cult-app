import { customAlphabet } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  levels,
  members,
  offerings,
  redemptions,
} from "@/db/schema";
import { LedgerError, mutateCreditsInTx } from "@/lib/ledgers";

const voucherAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 12);

export type RedeemInput = {
  memberId: string;
  userId: string;
  offeringId: string;
  idempotencyKey: string;
};

export async function redeemOffering(input: RedeemInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(redemptions)
        .where(
          and(
            eq(redemptions.memberId, input.memberId),
            eq(redemptions.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (existing[0]) {
        return { redemption: existing[0], replayed: true as const };
      }

      const [offering] = await tx
        .select()
        .from(offerings)
        .where(eq(offerings.id, input.offeringId))
        .limit(1)
        .for("update");

      if (!offering || offering.status !== "active") {
        throw new LedgerError("Offering not available", "NOT_FOUND");
      }

      const [member] = await tx
        .select()
        .from(members)
        .where(eq(members.id, input.memberId))
        .limit(1)
        .for("update");

      if (!member) throw new LedgerError("Member not found", "NOT_FOUND");
      if (member.status !== "active") {
        throw new LedgerError("Member not active", "INVALID");
      }

      let levelRank = 1;
      if (member.currentLevelId) {
        const [lvl] = await tx
          .select()
          .from(levels)
          .where(eq(levels.id, member.currentLevelId))
          .limit(1);
        levelRank = lvl?.rank ?? 1;
      }

      if (levelRank < offering.minLevelRank) {
        throw new LedgerError(
          `Requires level ${offering.minLevelRank}+`,
          "INVALID",
        );
      }

      if (member.creditBalance < offering.creditCost) {
        throw new LedgerError("Insufficient CULT Credits", "INSUFFICIENT");
      }

      if (offering.stock != null) {
        if (offering.stock <= 0) {
          throw new LedgerError("Offering out of stock", "INVALID");
        }
        await tx
          .update(offerings)
          .set({ stock: offering.stock - 1 })
          .where(eq(offerings.id, offering.id));
      }

      const voucherCode = `CULT-${voucherAlphabet()}`;

      await mutateCreditsInTx(tx, {
        memberId: input.memberId,
        delta: -offering.creditCost,
        reason: `Redeem: ${offering.name}`,
        idempotencyKey: `redeem-credits:${input.idempotencyKey}`,
        actorId: input.userId,
        refType: "offering",
        refId: offering.id,
      });

      const [redemption] = await tx
        .insert(redemptions)
        .values({
          offeringId: offering.id,
          memberId: input.memberId,
          creditSpent: offering.creditCost,
          voucherCode,
          voucherStatus: "issued",
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorId: input.userId,
        action: "offering.redeemed",
        entityType: "redemption",
        entityId: redemption.id,
        payload: {
          offeringId: offering.id,
          creditSpent: offering.creditCost,
          voucherCode,
        },
      });

      return { redemption, replayed: false as const };
    });
  } catch (e) {
    // Concurrent same idempotency key → unique violation → return existing
    const existing = await db
      .select()
      .from(redemptions)
      .where(
        and(
          eq(redemptions.memberId, input.memberId),
          eq(redemptions.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return { redemption: existing[0], replayed: true as const };
    }
    throw e;
  }
}
