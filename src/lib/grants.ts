import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members } from "@/db/schema";
import { awardXp, LedgerError, mutateCredits } from "@/lib/ledgers";

export const grantSchema = z.object({
  memberId: z.string().uuid(),
  ledger: z.enum(["xp", "credits"]),
  delta: z.number().int().refine((n) => n !== 0, "delta must be non-zero"),
  reason: z.string().min(3).max(255),
});

export type GrantInput = z.infer<typeof grantSchema> & {
  actorId: string;
  idempotencyKey: string;
};

/**
 * Admin/manager grant or adjust — always via ledger + audit. Never silent balance edits.
 */
export async function adminGrant(input: GrantInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, input.memberId))
    .limit(1);
  if (!member) throw new LedgerError("Member not found", "NOT_FOUND");

  const reason = `Admin adjust: ${input.reason}`;

  if (input.ledger === "xp") {
    const result = await awardXp({
      memberId: input.memberId,
      delta: input.delta,
      reason,
      idempotencyKey: `admin-xp:${input.idempotencyKey}`,
      actorId: input.actorId,
      refType: "admin_grant",
      refId: input.idempotencyKey,
    });
    return {
      ledger: "xp" as const,
      entry: result.entry,
      member: result.member,
      replayed: result.replayed,
    };
  }

  const result = await mutateCredits({
    memberId: input.memberId,
    delta: input.delta,
    reason,
    idempotencyKey: `admin-credits:${input.idempotencyKey}`,
    actorId: input.actorId,
    refType: "admin_grant",
    refId: input.idempotencyKey,
  });
  return {
    ledger: "credits" as const,
    entry: result.entry,
    member: result.member,
    replayed: result.replayed,
  };
}
