import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { Permission } from "@/lib/rbac";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { adminGrant, grantSchema } from "@/lib/grants";
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission(Permission.GRANTS_WRITE);
  if (error) return error;

  const rl = rateLimit({
    key: `grants:${session!.user.id}`,
    ...RATE.grants,
  });
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const json = await req.json().catch(() => null);
  const parsed = grantSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid grant payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/admin/grants",
      key,
      run: async () => {
        const out = await adminGrant({
          ...parsed.data,
          actorId: session!.user.id,
          idempotencyKey: key,
        });
        return {
          ledger: out.ledger,
          delta: parsed.data.delta,
          reason: parsed.data.reason,
          balance:
            out.ledger === "xp"
              ? out.member?.xpBalance
              : out.member?.creditBalance,
          replayed: out.replayed,
        };
      },
    });

    return NextResponse.json(result.body);
  } catch (e) {
    if (e instanceof LedgerError) {
      const status =
        e.code === "NOT_FOUND"
          ? 404
          : e.code === "INSUFFICIENT"
            ? 402
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
