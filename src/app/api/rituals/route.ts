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
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { VISIT_LOCATIONS } from "@/lib/visits";

export async function GET() {
  const { error } = await requireMember();
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
  /** Required when verifyMode === visit_code */
  visitCode: z.string().min(3).max(64).optional(),
  /** Client must not send awards */
  xp: z.undefined().optional(),
  credits: z.undefined().optional(),
});

function assertRitualVerification(
  ritual: typeof rituals.$inferSelect,
  visitCode?: string,
) {
  if (ritual.verifyMode === "none") return { ok: true as const, payload: {} };

  if (ritual.verifyMode === "time_window") {
    const hour = new Date().getUTCHours();
    const before = ritual.beforeHour ?? 12;
    if (hour >= before) {
      throw new LedgerError(
        `Ritual only valid before ${before}:00 UTC`,
        "INVALID",
      );
    }
    return { ok: true as const, payload: { hour, beforeHour: before } };
  }

  if (ritual.verifyMode === "visit_code") {
    const code = visitCode?.trim().toUpperCase();
    if (!code || !VISIT_LOCATIONS[code]) {
      throw new LedgerError("Valid visit code required", "INVALID");
    }
    return {
      ok: true as const,
      payload: { locationCode: code, locationName: VISIT_LOCATIONS[code].name },
    };
  }

  throw new LedgerError("Unknown verification mode", "INVALID");
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const rl = rateLimit({
    key: `rituals:${session!.user.id}`,
    ...RATE.rituals,
  });
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const raw = await req.json().catch(() => null);
  if (raw && typeof raw === "object" && ("xp" in raw || "credits" in raw)) {
    return NextResponse.json(
      { error: "Client-supplied XP/credits rejected", code: "TAMPER" },
      { status: 400 },
    );
  }

  const parsed = completeSchema.safeParse(raw);
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
            and(
              eq(rituals.slug, parsed.data.ritualSlug),
              eq(rituals.active, true),
            ),
          )
          .limit(1);
        if (!ritual) throw new LedgerError("Ritual not found", "NOT_FOUND");

        const verification = assertRitualVerification(
          ritual,
          parsed.data.visitCode,
        );

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

        // visit_code rituals: awards come from /api/visits/verify, not ritual table
        if (ritual.verifyMode === "visit_code") {
          await db.insert(ritualCompletions).values({
            ritualId: ritual.id,
            memberId: session!.user.memberId!,
            idempotencyKey: key,
            verificationPayload: verification.payload,
          });
          return {
            ritualId: ritual.id,
            xpAwarded: 0,
            creditsAwarded: 0,
            note: "Use visit verify for passport stamp + awards",
            verification: verification.payload,
          };
        }

        await db.insert(ritualCompletions).values({
          ritualId: ritual.id,
          memberId: session!.user.memberId!,
          idempotencyKey: key,
          verificationPayload: verification.payload,
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
          verification: verification.payload,
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
