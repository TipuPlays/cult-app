import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { ritualCompletions, rituals } from "@/db/schema";
import { requireMember } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { awardXp, mutateCredits, LedgerError } from "@/lib/ledgers";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;

  const list = await db
    .select()
    .from(rituals)
    .where(eq(rituals.active, true))
    .orderBy(asc(rituals.sortOrder));

  return NextResponse.json({ rituals: list });
}

const completeSchema = z.object({
  ritualSlug: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const parsed = completeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/rituals/complete",
      key,
      run: async () => {
        const [ritual] = await db
          .select()
          .from(rituals)
          .where(
            and(eq(rituals.slug, parsed.data.ritualSlug), eq(rituals.active, true)),
          )
          .limit(1);
        if (!ritual) throw new LedgerError("Ritual not found", "NOT_FOUND");

        const since = new Date(
          Date.now() - ritual.cooldownHours * 60 * 60 * 1000,
        );
        const recent = await db
          .select()
          .from(ritualCompletions)
          .where(
            and(
              eq(ritualCompletions.memberId, session!.user.memberId!),
              eq(ritualCompletions.ritualId, ritual.id),
              gte(ritualCompletions.createdAt, since),
            ),
          )
          .limit(1);
        if (recent[0]) {
          throw new LedgerError("Ritual on cooldown", "INVALID");
        }

        await db.insert(ritualCompletions).values({
          ritualId: ritual.id,
          memberId: session!.user.memberId!,
          idempotencyKey: key,
        });

        let xp = null;
        let credits = null;
        if (ritual.xpReward > 0) {
          xp = await awardXp({
            memberId: session!.user.memberId!,
            delta: ritual.xpReward,
            reason: `Ritual: ${ritual.name}`,
            idempotencyKey: `ritual-xp:${key}`,
            actorId: session!.user.id,
            refType: "ritual",
            refId: ritual.id,
          });
        }
        if (ritual.creditReward > 0) {
          credits = await mutateCredits({
            memberId: session!.user.memberId!,
            delta: ritual.creditReward,
            reason: `Ritual: ${ritual.name}`,
            idempotencyKey: `ritual-credits:${key}`,
            actorId: session!.user.id,
            refType: "ritual",
            refId: ritual.id,
          });
        }

        return {
          ritualId: ritual.id,
          xpAwarded: ritual.xpReward,
          creditsAwarded: ritual.creditReward,
          xpBalance: xp?.member?.xpBalance,
          creditBalance: credits?.member?.creditBalance,
        };
      },
    });

    return NextResponse.json({ ...result.body, replayed: result.replayed });
  } catch (e) {
    if (e instanceof LedgerError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "INSUFFICIENT" ? 402 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
