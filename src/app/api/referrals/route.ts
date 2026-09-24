import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { referralClaims, referralCodes } from "@/db/schema";
import { requireMember } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { claimReferral, ensureReferralCode } from "@/lib/referrals";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;

  const code = await ensureReferralCode(session!.user.memberId!);
  const claims = await db
    .select()
    .from(referralClaims)
    .where(eq(referralClaims.referrerMemberId, session!.user.memberId!))
    .orderBy(desc(referralClaims.createdAt))
    .limit(50);

  return NextResponse.json({
    code: code.code,
    claims: claims.map((c) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      referrerXp: c.referrerXp,
      referrerCredits: c.referrerCredits,
    })),
  });
}

const claimSchema = z.object({
  code: z.string().min(4).max(24),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const rl = rateLimit({
    key: `referral:${session!.user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const parsed = claimSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/referrals/claim",
      key,
      run: async () => {
        const out = await claimReferral({
          refereeMemberId: session!.user.memberId!,
          refereeUserId: session!.user.id,
          code: parsed.data.code,
          idempotencyKey: key,
        });
        return {
          claimId: out.claim.id,
          status: out.claim.status,
          refereeXp: out.claim.refereeXp,
          refereeCredits: out.claim.refereeCredits,
          replayed: out.replayed,
        };
      },
    });
    return NextResponse.json(result.body, {
      status: result.body.replayed ? 200 : 201,
    });
  } catch (e) {
    if (e instanceof LedgerError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "DUPLICATE"
            ? 409
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
