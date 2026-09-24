import { count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  creditLedger,
  cultEvents,
  fraudFlags,
  levels,
  members,
  receipts,
  referralClaims,
  visits,
  xpLedger,
} from "@/db/schema";

export async function raiseFraudFlag(input: {
  memberId?: string | null;
  kind: string;
  severity: number;
  payload?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(fraudFlags)
    .values({
      memberId: input.memberId ?? null,
      kind: input.kind,
      severity: input.severity,
      payload: input.payload ?? {},
    })
    .returning();
  await db.insert(auditEvents).values({
    action: "fraud.flagged",
    entityType: "fraud_flag",
    entityId: row.id,
    payload: { kind: input.kind, severity: input.severity },
  });
  return row;
}

export async function resolveFraudFlag(input: {
  flagId: string;
  actorId: string;
  status: "dismissed" | "confirmed" | "reviewing";
  note?: string;
}) {
  const [row] = await db
    .update(fraudFlags)
    .set({
      status: input.status,
      note: input.note ?? null,
      resolvedBy: input.actorId,
      resolvedAt: sql`now()`,
    })
    .where(eq(fraudFlags.id, input.flagId))
    .returning();
  if (row) {
    await db.insert(auditEvents).values({
      actorId: input.actorId,
      action: `fraud.${input.status}`,
      entityType: "fraud_flag",
      entityId: row.id,
      payload: { note: input.note ?? null },
    });
  }
  return row;
}

export async function getAdminAnalytics() {
  const [
    memberCount,
    visitCount,
    xpIssued,
    creditsIssued,
    creditsSpent,
    receiptStats,
    levelDist,
    referralCount,
    openFraud,
    eventCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(members),
    db.select({ c: count() }).from(visits),
    db
      .select({ total: sql<number>`coalesce(sum(${xpLedger.delta}), 0)` })
      .from(xpLedger)
      .where(gte(xpLedger.delta, 0)),
    db
      .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)` })
      .from(creditLedger)
      .where(gte(creditLedger.delta, 0)),
    db
      .select({
        total: sql<number>`coalesce(sum(abs(${creditLedger.delta})), 0)`,
      })
      .from(creditLedger)
      .where(sql`${creditLedger.delta} < 0`),
    db
      .select({
        status: receipts.status,
        c: count(),
      })
      .from(receipts)
      .groupBy(receipts.status),
    db
      .select({
        levelName: levels.name,
        rank: levels.rank,
        c: count(),
      })
      .from(members)
      .leftJoin(levels, eq(members.currentLevelId, levels.id))
      .groupBy(levels.name, levels.rank)
      .orderBy(levels.rank),
    db.select({ c: count() }).from(referralClaims),
    db
      .select({ c: count() })
      .from(fraudFlags)
      .where(eq(fraudFlags.status, "open")),
    db.select({ c: count() }).from(cultEvents).where(eq(cultEvents.active, true)),
  ]);

  const receiptsByStatus = Object.fromEntries(
    receiptStats.map((r) => [r.status, Number(r.c)]),
  );
  const approved = receiptsByStatus.approved ?? 0;
  const rejected = receiptsByStatus.rejected ?? 0;
  const decided = approved + rejected;

  return {
    members: Number(memberCount[0]?.c ?? 0),
    visits: Number(visitCount[0]?.c ?? 0),
    xpIssued: Number(xpIssued[0]?.total ?? 0),
    creditsIssued: Number(creditsIssued[0]?.total ?? 0),
    creditsRedeemed: Number(creditsSpent[0]?.total ?? 0),
    receiptsByStatus,
    receiptApprovalRate: decided ? approved / decided : null,
    levelDistribution: levelDist.map((l) => ({
      name: l.levelName ?? "unknown",
      rank: l.rank,
      count: Number(l.c),
    })),
    referrals: Number(referralCount[0]?.c ?? 0),
    openFraudFlags: Number(openFraud[0]?.c ?? 0),
    activeEvents: Number(eventCount[0]?.c ?? 0),
  };
}
