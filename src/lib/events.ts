import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  cultEvents,
  eventRsvps,
  levels,
  members,
} from "@/db/schema";
import { type DbTx, LedgerError } from "@/lib/ledgers";
import { notifyUser } from "@/lib/notifications";

type DbLike = typeof db | DbTx;

export async function getMemberLevelRank(memberId: string, tx: DbLike = db) {
  const [member] = await tx
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member?.currentLevelId) return 1;
  const [lvl] = await tx
    .select()
    .from(levels)
    .where(eq(levels.id, member.currentLevelId))
    .limit(1);
  return lvl?.rank ?? 1;
}

export async function rsvpEvent(input: {
  eventId: string;
  memberId: string;
  userId: string;
  idempotencyKey: string;
  status?: "going" | "cancelled";
}) {
  if (!input.idempotencyKey?.trim()) {
    throw new LedgerError("Idempotency-Key required", "INVALID");
  }

  const wanted = input.status ?? "going";

  return db.transaction(async (tx) => {
    const idem = await tx
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.memberId, input.memberId),
          eq(eventRsvps.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (idem[0]) return { rsvp: idem[0], replayed: true as const };

    const [event] = await tx
      .select()
      .from(cultEvents)
      .where(eq(cultEvents.id, input.eventId))
      .limit(1)
      .for("update");
    if (!event || !event.active) {
      throw new LedgerError("Event not found", "NOT_FOUND");
    }

    const rank = await getMemberLevelRank(input.memberId, tx);
    if (rank < event.minLevelRank) {
      throw new LedgerError(
        `Requires level ${event.minLevelRank}+`,
        "INVALID",
      );
    }

    const existing = await tx
      .select()
      .from(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, input.eventId),
          eq(eventRsvps.memberId, input.memberId),
        ),
      )
      .limit(1);

    if (wanted === "cancelled") {
      if (!existing[0]) {
        throw new LedgerError("No RSVP to cancel", "NOT_FOUND");
      }
      const [updated] = await tx
        .update(eventRsvps)
        .set({ status: "cancelled", idempotencyKey: input.idempotencyKey })
        .where(eq(eventRsvps.id, existing[0].id))
        .returning();
      await tx.insert(auditEvents).values({
        actorId: input.userId,
        action: "event.rsvp_cancelled",
        entityType: "event_rsvp",
        entityId: updated.id,
        payload: { eventId: input.eventId },
      });
      return { rsvp: updated, replayed: false as const };
    }

    if (existing[0] && existing[0].status === "going") {
      return { rsvp: existing[0], replayed: true as const };
    }

    let status: "going" | "waitlist" = "going";
    if (event.capacity != null) {
      const [going] = await tx
        .select({ c: count() })
        .from(eventRsvps)
        .where(
          and(
            eq(eventRsvps.eventId, input.eventId),
            eq(eventRsvps.status, "going"),
          ),
        );
      if (Number(going?.c ?? 0) >= event.capacity) {
        status = "waitlist";
      }
    }

    let rsvp;
    if (existing[0]) {
      [rsvp] = await tx
        .update(eventRsvps)
        .set({ status, idempotencyKey: input.idempotencyKey })
        .where(eq(eventRsvps.id, existing[0].id))
        .returning();
    } else {
      [rsvp] = await tx
        .insert(eventRsvps)
        .values({
          eventId: input.eventId,
          memberId: input.memberId,
          status,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();
    }

    await tx.insert(auditEvents).values({
      actorId: input.userId,
      action: "event.rsvp",
      entityType: "event_rsvp",
      entityId: rsvp.id,
      payload: { eventId: input.eventId, status },
    });

    return { rsvp, replayed: false as const };
  }).then(async (result) => {
    if (!result.replayed && result.rsvp.status !== "cancelled") {
      await notifyUser(input.userId, "event_rsvp", {
        eventId: input.eventId,
        status: result.rsvp.status,
      });
    }
    return result;
  });
}

export type EventWrite = {
  slug: string;
  title: string;
  description: string;
  location?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  minLevelRank: number;
  capacity?: number | null;
  active?: boolean;
};

export async function createEvent(input: EventWrite & { actorId: string }) {
  const [row] = await db
    .insert(cultEvents)
    .values({
      slug: input.slug,
      title: input.title,
      description: input.description,
      location: input.location ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      minLevelRank: input.minLevelRank,
      capacity: input.capacity ?? null,
      active: input.active ?? true,
    })
    .returning();
  await db.insert(auditEvents).values({
    actorId: input.actorId,
    action: "event.created",
    entityType: "cult_event",
    entityId: row.id,
    payload: { slug: row.slug },
  });
  return row;
}

export async function updateEvent(
  id: string,
  patch: Partial<EventWrite> & { actorId: string },
) {
  const { actorId, ...rest } = patch;
  const [row] = await db
    .update(cultEvents)
    .set({
      ...rest,
      updatedAt: sql`now()`,
    })
    .where(eq(cultEvents.id, id))
    .returning();
  if (!row) throw new LedgerError("Event not found", "NOT_FOUND");
  await db.insert(auditEvents).values({
    actorId,
    action: "event.updated",
    entityType: "cult_event",
    entityId: row.id,
    payload: rest as Record<string, unknown>,
  });
  return row;
}
