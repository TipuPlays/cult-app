import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { verifyVisit, VISIT_LOCATIONS } from "@/lib/visits";

export async function GET() {
  const { error } = await requireMember();
  if (error) return error;
  // Public catalog of codes is intentionally NOT exposed — only names for UX hints
  return NextResponse.json({
    locations: Object.values(VISIT_LOCATIONS).map((l) => ({
      name: l.name,
      stampLabel: l.stampLabel,
    })),
  });
}

const schema = z.object({
  locationCode: z.string().min(3).max(64),
  xp: z.undefined().optional(),
  credits: z.undefined().optional(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const rl = rateLimit({
    key: `visits:${session!.user.id}`,
    ...RATE.visits,
  });
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const json = await req.json().catch(() => null);
  if (json && typeof json === "object" && ("xp" in json || "credits" in json)) {
    return NextResponse.json(
      { error: "Client-supplied XP/credits rejected", code: "TAMPER" },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/visits/verify",
      key,
      run: async () => {
        const out = await verifyVisit({
          memberId: session!.user.memberId!,
          userId: session!.user.id,
          locationCode: parsed.data.locationCode,
          idempotencyKey: key,
        });
        return {
          visitId: out.visit.id,
          locationName: out.visit.locationName,
          stampSlug: out.visit.stampSlug,
          stampLabel: out.stamp?.label ?? null,
          xpAwarded: out.visit.xpAwarded,
          creditsAwarded: out.visit.creditsAwarded,
          replayed: out.replayed,
        };
      },
    });

    return NextResponse.json(result.body, {
      status: result.body.replayed ? 200 : 201,
    });
  } catch (e) {
    if (e instanceof LedgerError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
