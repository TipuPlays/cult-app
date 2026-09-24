import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { creditLedger, xpLedger } from "@/db/schema";
import { requireMember } from "@/lib/authz";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;

  const memberId = session!.user.memberId!;

  const [xp, credits] = await Promise.all([
    db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.memberId, memberId))
      .orderBy(desc(xpLedger.createdAt))
      .limit(40),
    db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.memberId, memberId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(40),
  ]);

  const events = [
    ...xp.map((e) => ({
      id: e.id,
      kind: "xp" as const,
      delta: e.delta,
      reason: e.reason,
      refType: e.refType,
      createdAt: e.createdAt,
    })),
    ...credits.map((e) => ({
      id: e.id,
      kind: "credits" as const,
      delta: e.delta,
      reason: e.reason,
      refType: e.refType,
      createdAt: e.createdAt,
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ events: events.slice(0, 50) });
}
