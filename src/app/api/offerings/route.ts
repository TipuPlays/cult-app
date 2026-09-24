import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { offerings } from "@/db/schema";
import { requireMember } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { redeemOffering } from "@/lib/redemptions";

export async function GET() {
  const { error } = await requireMember();
  if (error) return error;

  const list = await db
    .select()
    .from(offerings)
    .where(eq(offerings.status, "active"));

  return NextResponse.json({
    offerings: list.map((o) => ({
      id: o.id,
      slug: o.slug,
      name: o.name,
      description: o.description,
      creditCost: o.creditCost,
      minLevelRank: o.minLevelRank,
      stock: o.stock,
    })),
  });
}

const redeemSchema = z.object({
  offeringId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const json = await req.json().catch(() => null);
  if (
    json &&
    typeof json === "object" &&
    ("creditCost" in json || "credits" in json || "xp" in json)
  ) {
    return NextResponse.json(
      { error: "Client-supplied balances/costs rejected", code: "TAMPER" },
      { status: 400 },
    );
  }

  const parsed = redeemSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/offerings/redeem",
      key,
      run: async () => {
        const out = await redeemOffering({
          memberId: session!.user.memberId!,
          userId: session!.user.id,
          offeringId: parsed.data.offeringId,
          idempotencyKey: key,
        });
        return {
          redemptionId: out.redemption.id,
          voucherCode: out.redemption.voucherCode,
          voucherStatus: out.redemption.voucherStatus,
          creditSpent: out.redemption.creditSpent,
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
          : e.code === "INSUFFICIENT"
            ? 402
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
