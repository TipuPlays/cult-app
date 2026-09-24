import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { reviewReceipt } from "@/lib/receipts";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);

  // Explicit tamper block: client XP/credits never accepted
  if (
    json &&
    typeof json === "object" &&
    ("xp" in json || "credits" in json || "xpAwarded" in json)
  ) {
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
      route: `POST /api/admin/receipts/${id}/review`,
      key,
      run: async () => {
        const out = await reviewReceipt({
          receiptId: id,
          decision: parsed.data.decision,
          actorId: session!.user.id,
          note: parsed.data.note,
          idempotencyKey: key,
        });
        return {
          id: out.receipt.id,
          status: out.receipt.status,
          awards: out.awards,
          replayed: out.replayed,
        };
      },
    });

    return NextResponse.json(result.body);
  } catch (e) {
    if (e instanceof LedgerError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
