import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  members,
  passportStamps,
  visits,
} from "@/db/schema";
import { awardXpInTx, LedgerError, mutateCreditsInTx } from "@/lib/ledgers";

/** Mock location registry — replace with POS/geo adapter later */
export const VISIT_LOCATIONS: Record<
  string,
  { name: string; stampSlug: string; stampLabel: string; xp: number; credits: number }
> = {
  CULTHQ: {
    name: "CULT Flagship",
    stampSlug: "flagship",
    stampLabel: "Flagship",
    xp: 60,
    credits: 10,
  },
  MATCHA01: {
    name: "Ceremonial Bar",
    stampSlug: "ceremonial-bar",
    stampLabel: "Ceremonial Bar",
    xp: 40,
    credits: 5,
  },
  ORIGINLAB: {
    name: "Origin Lab",
    stampSlug: "origin-lab",
    stampLabel: "Origin Lab",
    xp: 50,
    credits: 8,
  },
};

export type VerifyVisitInput = {
  memberId: string;
  userId: string;
  locationCode: string;
  idempotencyKey: string;
};

export async function verifyVisit(input: VerifyVisitInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  const code = input.locationCode.trim().toUpperCase();
  const loc = VISIT_LOCATIONS[code];
  if (!loc) {
    throw new LedgerError("Unknown or invalid visit code", "INVALID");
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(visits)
      .where(
        and(
          eq(visits.memberId, input.memberId),
          eq(visits.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return { visit: existing[0], stamp: null, replayed: true as const };
    }

    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1)
      .for("update");
    if (!member) throw new LedgerError("Member not found", "NOT_FOUND");

    const [visit] = await tx
      .insert(visits)
      .values({
        memberId: input.memberId,
        locationCode: code,
        locationName: loc.name,
        stampSlug: loc.stampSlug,
        xpAwarded: loc.xp,
        creditsAwarded: loc.credits,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    if (loc.xp > 0) {
      await awardXpInTx(tx, {
        memberId: input.memberId,
        delta: loc.xp,
        reason: `Visit: ${loc.name}`,
        idempotencyKey: `visit-xp:${input.idempotencyKey}`,
        actorId: input.userId,
        refType: "visit",
        refId: visit.id,
      });
    }
    if (loc.credits > 0) {
      await mutateCreditsInTx(tx, {
        memberId: input.memberId,
        delta: loc.credits,
        reason: `Visit: ${loc.name}`,
        idempotencyKey: `visit-credits:${input.idempotencyKey}`,
        actorId: input.userId,
        refType: "visit",
        refId: visit.id,
      });
    }

    // One stamp per location slug per member (unique) — skip if already stamped
    const priorStamp = await tx
      .select()
      .from(passportStamps)
      .where(
        and(
          eq(passportStamps.memberId, input.memberId),
          eq(passportStamps.stampSlug, loc.stampSlug),
        ),
      )
      .limit(1);

    let stamp = priorStamp[0] ?? null;
    if (!stamp) {
      const [created] = await tx
        .insert(passportStamps)
        .values({
          memberId: input.memberId,
          visitId: visit.id,
          stampSlug: loc.stampSlug,
          label: loc.stampLabel,
        })
        .returning();
      stamp = created;
    }

    await tx.insert(auditEvents).values({
      actorId: input.userId,
      action: "visit.verified",
      entityType: "visit",
      entityId: visit.id,
      payload: {
        locationCode: code,
        stampSlug: loc.stampSlug,
        xp: loc.xp,
        credits: loc.credits,
        newStamp: !priorStamp[0],
      },
    });

    return { visit, stamp, replayed: false as const };
  }).then(async (result) => {
    if (!result.replayed) {
      const { evaluateBadges } = await import("@/lib/badges");
      const { notifyUser } = await import("@/lib/notifications");
      await evaluateBadges(input.memberId, "visit");
      await notifyUser(input.userId, "visit_reward", {
        visitId: result.visit.id,
        location: result.visit.locationName,
      });
    }
    return result;
  });
}
