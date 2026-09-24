import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { fraudFlags } from "@/db/schema";
import { requirePermission } from "@/lib/authz";
import { resolveFraudFlag } from "@/lib/analytics";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { Permission } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { error } = await requirePermission(Permission.FRAUD_REVIEW);
  if (error) return error;

  const rows = await db
    .select()
    .from(fraudFlags)
    .orderBy(desc(fraudFlags.createdAt))
    .limit(100);

  return NextResponse.json({ flags: rows });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission(Permission.FRAUD_REVIEW);
  if (error) return error;

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const schema = z.object({
    flagId: z.string().uuid(),
    status: z.enum(["dismissed", "confirmed", "reviewing"]),
    note: z.string().max(500).optional(),
  });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const result = await withIdempotency({
    userId: session!.user.id,
    route: "POST /api/admin/fraud",
    key,
    run: async () => {
      const row = await resolveFraudFlag({
        flagId: parsed.data.flagId,
        actorId: session!.user.id,
        status: parsed.data.status,
        note: parsed.data.note,
      });
      return { id: row?.id, status: row?.status };
    },
  });

  return NextResponse.json(result.body);
}
