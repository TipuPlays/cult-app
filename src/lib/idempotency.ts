import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";

export function requireIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get("idempotency-key")?.trim() || null;
}

export function missingIdempotencyResponse() {
  return NextResponse.json(
    { error: "Idempotency-Key header required" },
    { status: 400 },
  );
}

export async function withIdempotency<T>(opts: {
  userId: string;
  route: string;
  key: string;
  run: () => Promise<T>;
}): Promise<{ body: T; replayed: boolean }> {
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.userId, opts.userId),
        eq(idempotencyKeys.route, opts.route),
        eq(idempotencyKeys.key, opts.key),
      ),
    )
    .limit(1);

  if (existing[0]?.responseBody !== undefined && existing[0]?.responseBody !== null) {
    return { body: existing[0].responseBody as T, replayed: true };
  }

  const body = await opts.run();
  const responseHash = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");

  try {
    await db.insert(idempotencyKeys).values({
      userId: opts.userId,
      route: opts.route,
      key: opts.key,
      responseHash,
      responseBody: body as unknown as Record<string, unknown>,
    });
  } catch {
    const raced = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.userId, opts.userId),
          eq(idempotencyKeys.route, opts.route),
          eq(idempotencyKeys.key, opts.key),
        ),
      )
      .limit(1);
    if (raced[0]?.responseBody != null) {
      return { body: raced[0].responseBody as T, replayed: true };
    }
  }

  return { body, replayed: false };
}
