import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { requireMember } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { submitReceipt } from "@/lib/receipts";
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;

  const rows = await db
    .select()
    .from(receipts)
    .where(eq(receipts.memberId, session!.user.memberId!))
    .orderBy(desc(receipts.createdAt))
    .limit(50);

  return NextResponse.json({
    receipts: rows.map((r) => ({
      id: r.id,
      status: r.status,
      amountCents: r.amountCents,
      merchant: r.merchant,
      fraudScore: r.fraudScore,
      xpAwarded: r.xpAwarded,
      creditsAwarded: r.creditsAwarded,
      createdAt: r.createdAt,
      reviewNote: r.reviewNote,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const rl = rateLimit({
    key: `receipts:${session!.user.id}`,
    ...RATE.receipts,
  });
  if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const contentType = req.headers.get("content-type") || "";

  try {
    let imageBytes: Uint8Array;
    let mimeType = "image/jpeg";
    let externalOrderId: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      mimeType = file.type || "image/jpeg";
      imageBytes = new Uint8Array(await file.arrayBuffer());
      const ext = form.get("externalOrderId");
      if (typeof ext === "string") externalOrderId = ext;
    } else {
      const body = z
        .object({
          imageBase64: z.string().min(8),
          mimeType: z.string().default("image/jpeg"),
          externalOrderId: z.string().optional(),
        })
        .safeParse(await req.json().catch(() => null));
      if (!body.success) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      const raw = body.data.imageBase64.replace(/^data:[^;]+;base64,/, "");
      imageBytes = new Uint8Array(Buffer.from(raw, "base64"));
      mimeType = body.data.mimeType;
      externalOrderId = body.data.externalOrderId ?? null;
    }

    // Reject client-supplied reward fields if present (tamper guard)
    // (multipart won't have them; JSON path ignores xp/credits entirely)

    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/receipts",
      key,
      run: async () => {
        const { receipt, replayed } = await submitReceipt({
          memberId: session!.user.memberId!,
          userId: session!.user.id,
          idempotencyKey: key,
          imageBytes,
          mimeType,
          externalOrderId,
        });
        return {
          id: receipt.id,
          status: receipt.status,
          amountCents: receipt.amountCents,
          merchant: receipt.merchant,
          fraudScore: receipt.fraudScore,
          replayed,
        };
      },
    });

    return NextResponse.json(result.body, {
      status: result.replayed || result.body.replayed ? 200 : 201,
    });
  } catch (e) {
    if (e instanceof LedgerError) {
      const status =
        e.code === "NOT_FOUND" ? 404 : e.code === "DUPLICATE" ? 409 : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    throw e;
  }
}
