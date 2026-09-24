import { createHash } from "crypto";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, receipts } from "@/db/schema";
import {
  ocrAdapter,
  scoreReceiptFraud,
  type OcrResult,
} from "@/lib/adapters";
import { blobStorage } from "@/lib/blob-storage";
import {
  awardXpInTx,
  LedgerError,
  mutateCreditsInTx,
  rewardsForReceiptAmount,
} from "@/lib/ledgers";

export function hashReceiptBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function dayKey(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeMerchant(m: string | null): string | null {
  if (!m) return null;
  return m.trim().toLowerCase().replace(/\s+/g, " ");
}

export type SubmitReceiptInput = {
  memberId: string;
  userId: string;
  idempotencyKey: string;
  imageBytes: Uint8Array;
  mimeType: string;
  /** Optional client hint only — never trusted for rewards */
  externalOrderId?: string | null;
};

export async function submitReceipt(input: SubmitReceiptInput) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }
  if (!input.imageBytes?.length) {
    throw new LedgerError("Receipt image required", "INVALID");
  }

  const contentHash = hashReceiptBytes(input.imageBytes);

  // Idempotent replay by member + key
  const prior = await db
    .select()
    .from(receipts)
    .where(
      and(
        eq(receipts.memberId, input.memberId),
        eq(receipts.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  if (prior[0]) {
    return { receipt: prior[0], replayed: true as const };
  }

  // Duplicate content hash for this member → hard reject path after insert
  const dupes = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(
      and(
        eq(receipts.memberId, input.memberId),
        eq(receipts.contentHash, contentHash),
        ne(receipts.status, "rejected"),
      ),
    )
    .limit(1);

  // Store via blob adapter (local/mock — swap for S3/R2)
  const stored = await blobStorage.put(input.imageBytes, input.mimeType, {
    prefix: "receipts",
  });

  const [created] = await db
    .insert(receipts)
    .values({
      memberId: input.memberId,
      idempotencyKey: input.idempotencyKey,
      contentHash,
      imageUrl: stored.url,
      blobKey: stored.key,
      status: "pending",
      fingerprint: {
        contentHash,
        amountCents: null,
        merchantNorm: null,
        dayKey: null,
      },
    })
    .returning();

  await db.insert(auditEvents).values({
    actorId: input.userId,
    action: "receipt.submitted",
    entityType: "receipt",
    entityId: created.id,
    payload: { contentHash },
  });

  // PENDING → PROCESSING
  await db
    .update(receipts)
    .set({ status: "processing" })
    .where(eq(receipts.id, created.id));

  let ocr: OcrResult;
  try {
    ocr = await ocrAdapter.parseReceipt(input.imageBytes, input.mimeType);
  } catch {
    ocr = {
      amountCents: null,
      merchant: null,
      purchasedAt: null,
      rawText: "",
      confidence: 0,
    };
  }

  const purchasedAt = ocr.purchasedAt ? new Date(ocr.purchasedAt) : null;
  const merchantNorm = normalizeMerchant(ocr.merchant);
  const dKey = dayKey(purchasedAt);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const sameDayAmount = await db
    .select({ id: receipts.id })
    .from(receipts)
    .where(
      and(
        eq(receipts.memberId, input.memberId),
        eq(receipts.amountCents, ocr.amountCents ?? -1),
        gte(receipts.createdAt, startOfDay),
        ne(receipts.id, created.id),
        ne(receipts.status, "rejected"),
      ),
    )
    .limit(1);

  const fraudScore = scoreReceiptFraud({
    amountCents: ocr.amountCents,
    contentHash,
    duplicateHashToday: Boolean(dupes[0]),
    confidence: ocr.confidence,
    sameDaySameAmount: Boolean(sameDayAmount[0]),
  });

  // Hard duplicate → REJECTED; else MANUAL_REVIEW (admin awards only)
  const nextStatus =
    dupes[0] || fraudScore >= 80 ? "rejected" : "manual_review";

  const [processed] = await db
    .update(receipts)
    .set({
      status: nextStatus,
      amountCents: ocr.amountCents,
      merchant: ocr.merchant,
      purchasedAt,
      fraudScore,
      ocrPayload: {
        ...ocr,
        externalOrderId: input.externalOrderId ?? null,
      },
      fingerprint: {
        contentHash,
        amountCents: ocr.amountCents,
        merchantNorm,
        dayKey: dKey,
      },
      reviewNote:
        nextStatus === "rejected"
          ? dupes[0]
            ? "Duplicate receipt fingerprint"
            : "Auto-rejected: high fraud score"
          : null,
      reviewedAt: nextStatus === "rejected" ? sql`now()` : null,
    })
    .where(eq(receipts.id, created.id))
    .returning();

  await db.insert(auditEvents).values({
    actorId: input.userId,
    action: `receipt.${nextStatus}`,
    entityType: "receipt",
    entityId: created.id,
    payload: { fraudScore, status: nextStatus },
  });

  if (dupes[0] || fraudScore >= 60) {
    const { raiseFraudFlag } = await import("@/lib/analytics");
    await raiseFraudFlag({
      memberId: input.memberId,
      kind: dupes[0] ? "receipt_duplicate" : "receipt_high_score",
      severity: Math.max(fraudScore, dupes[0] ? 85 : fraudScore),
      payload: {
        receiptId: created.id,
        contentHash,
        fraudScore,
      },
    });
  }

  return { receipt: processed, replayed: false as const };
}

export async function reviewReceipt(input: {
  receiptId: string;
  decision: "approved" | "rejected";
  actorId: string;
  note?: string | null;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  return db.transaction(async (tx) => {
    const [receipt] = await tx
      .select()
      .from(receipts)
      .where(eq(receipts.id, input.receiptId))
      .limit(1)
      .for("update");

    if (!receipt) throw new LedgerError("Receipt not found", "NOT_FOUND");

    if (receipt.status === "approved" || receipt.status === "rejected") {
      // Idempotent: already terminal
      return { receipt, replayed: true as const, awards: null };
    }

    if (
      receipt.status !== "manual_review" &&
      receipt.status !== "pending" &&
      receipt.status !== "processing"
    ) {
      throw new LedgerError(`Cannot review status ${receipt.status}`, "INVALID");
    }

    if (input.decision === "rejected") {
      const [updated] = await tx
        .update(receipts)
        .set({
          status: "rejected",
          reviewNote: input.note ?? "Rejected by admin",
          reviewedBy: input.actorId,
          reviewedAt: sql`now()`,
        })
        .where(eq(receipts.id, receipt.id))
        .returning();

      await tx.insert(auditEvents).values({
        actorId: input.actorId,
        action: "receipt.rejected",
        entityType: "receipt",
        entityId: receipt.id,
        payload: { note: input.note ?? null },
      });

      return { receipt: updated, replayed: false as const, awards: null };
    }

    const amount = receipt.amountCents ?? 0;
    const { xp, credits } = rewardsForReceiptAmount(amount);

    let xpResult = null;
    let creditResult = null;

    if (xp > 0) {
      xpResult = await awardXpInTx(tx, {
        memberId: receipt.memberId,
        delta: xp,
        reason: `Receipt approved (${amount}¢)`,
        idempotencyKey: `receipt-xp:${receipt.id}`,
        actorId: input.actorId,
        refType: "receipt",
        refId: receipt.id,
      });
    }
    if (credits > 0) {
      creditResult = await mutateCreditsInTx(tx, {
        memberId: receipt.memberId,
        delta: credits,
        reason: `Receipt approved (${amount}¢)`,
        idempotencyKey: `receipt-credits:${receipt.id}`,
        actorId: input.actorId,
        refType: "receipt",
        refId: receipt.id,
      });
    }

    const [updated] = await tx
      .update(receipts)
      .set({
        status: "approved",
        xpAwarded: xp,
        creditsAwarded: credits,
        reviewNote: input.note ?? "Approved",
        reviewedBy: input.actorId,
        reviewedAt: sql`now()`,
      })
      .where(eq(receipts.id, receipt.id))
      .returning();

    await tx.insert(auditEvents).values({
      actorId: input.actorId,
      action: "receipt.approved",
      entityType: "receipt",
      entityId: receipt.id,
      payload: { xp, credits, amountCents: amount },
    });

    return {
      receipt: updated,
      replayed: false as const,
      awards: {
        xp,
        credits,
        xpBalance: xpResult?.member?.xpBalance,
        creditBalance: creditResult?.member?.creditBalance,
      },
    };
  });
}
