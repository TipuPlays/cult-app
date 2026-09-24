import { and, desc, eq, sql } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import {
  auditEvents,
  creditLedger,
  levels,
  members,
  xpLedger,
} from "@/db/schema";

export class LedgerError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_FOUND"
      | "INSUFFICIENT"
      | "DUPLICATE"
      | "INVALID" = "INVALID",
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export type DbTx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type LedgerWriteInput = {
  memberId: string;
  delta: number;
  reason: string;
  idempotencyKey: string;
  actorId?: string | null;
  refType?: string | null;
  refId?: string | null;
};

async function resolveLevelForXp(xp: number, tx: DbTx | typeof db = db) {
  const all = await tx.select().from(levels).orderBy(desc(levels.xpThreshold));
  const match = all.find((l) => xp >= l.xpThreshold) ?? all[all.length - 1];
  return match ?? null;
}

export async function awardXpInTx(tx: DbTx, input: LedgerWriteInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new LedgerError("XP delta must be a non-zero integer", "INVALID");
  }

  const existing = await tx
    .select()
    .from(xpLedger)
    .where(
      and(
        eq(xpLedger.memberId, input.memberId),
        eq(xpLedger.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1);
    return { entry: existing[0], member, replayed: true as const };
  }

  const [member] = await tx
    .select()
    .from(members)
    .where(eq(members.id, input.memberId))
    .limit(1)
    .for("update");

  if (!member) throw new LedgerError("Member not found", "NOT_FOUND");

  const [entry] = await tx
    .insert(xpLedger)
    .values({
      memberId: input.memberId,
      delta: input.delta,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    })
    .returning();

  const newXp = member.xpBalance + input.delta;
  if (newXp < 0) throw new LedgerError("XP cannot go negative", "INVALID");

  const level = await resolveLevelForXp(newXp, tx);

  const [updated] = await tx
    .update(members)
    .set({
      xpBalance: newXp,
      currentLevelId: level?.id ?? member.currentLevelId,
      updatedAt: sql`now()`,
    })
    .where(eq(members.id, input.memberId))
    .returning();

  await tx.insert(auditEvents).values({
    actorId: input.actorId ?? null,
    action: "xp.award",
    entityType: "xp_ledger",
    entityId: entry.id,
    payload: {
      memberId: input.memberId,
      delta: input.delta,
      reason: input.reason,
      balance: newXp,
    },
  });

  return { entry, member: updated, replayed: false as const };
}

export async function mutateCreditsInTx(tx: DbTx, input: LedgerWriteInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }
  if (!Number.isInteger(input.delta) || input.delta === 0) {
    throw new LedgerError("Credit delta must be a non-zero integer", "INVALID");
  }

  const existing = await tx
    .select()
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.memberId, input.memberId),
        eq(creditLedger.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  if (existing[0]) {
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.id, input.memberId))
      .limit(1);
    return { entry: existing[0], member, replayed: true as const };
  }

  const [member] = await tx
    .select()
    .from(members)
    .where(eq(members.id, input.memberId))
    .limit(1)
    .for("update");

  if (!member) throw new LedgerError("Member not found", "NOT_FOUND");

  const newBalance = member.creditBalance + input.delta;
  if (newBalance < 0) {
    throw new LedgerError("Insufficient CULT Credits", "INSUFFICIENT");
  }

  const [entry] = await tx
    .insert(creditLedger)
    .values({
      memberId: input.memberId,
      delta: input.delta,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
    })
    .returning();

  const [updated] = await tx
    .update(members)
    .set({
      creditBalance: newBalance,
      updatedAt: sql`now()`,
    })
    .where(eq(members.id, input.memberId))
    .returning();

  await tx.insert(auditEvents).values({
    actorId: input.actorId ?? null,
    action: input.delta > 0 ? "credits.award" : "credits.spend",
    entityType: "credit_ledger",
    entityId: entry.id,
    payload: {
      memberId: input.memberId,
      delta: input.delta,
      reason: input.reason,
      balance: newBalance,
    },
  });

  return { entry, member: updated, replayed: false as const };
}

export async function awardXp(input: LedgerWriteInput) {
  return db.transaction((tx) => awardXpInTx(tx, input));
}

export async function mutateCredits(input: LedgerWriteInput) {
  return db.transaction((tx) => mutateCreditsInTx(tx, input));
}

export async function recalcBalances(memberId: string) {
  return db.transaction(async (tx) => {
    const [xp] = await tx
      .select({ total: sql<number>`coalesce(sum(${xpLedger.delta}), 0)` })
      .from(xpLedger)
      .where(eq(xpLedger.memberId, memberId));
    const [credits] = await tx
      .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)` })
      .from(creditLedger)
      .where(eq(creditLedger.memberId, memberId));

    const xpTotal = Number(xp?.total ?? 0);
    const creditTotal = Number(credits?.total ?? 0);
    const level = await resolveLevelForXp(xpTotal, tx);

    const [updated] = await tx
      .update(members)
      .set({
        xpBalance: xpTotal,
        creditBalance: creditTotal,
        currentLevelId: level?.id ?? null,
        updatedAt: sql`now()`,
      })
      .where(eq(members.id, memberId))
      .returning();

    return updated;
  });
}

/** Reward formula — server only; never accept client XP/credits. */
export function rewardsForReceiptAmount(amountCents: number) {
  const dollars = Math.max(0, Math.floor(amountCents / 100));
  const xp = Math.max(5, dollars); // min 5 XP
  const credits = Math.floor(dollars / 5); // 1 credit per $5
  return { xp, credits };
}
