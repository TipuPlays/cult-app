import { NextRequest, NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cultEvents, eventRsvps } from "@/db/schema";
import { requireMember, requirePermission } from "@/lib/authz";
import { createEvent, rsvpEvent, updateEvent } from "@/lib/events";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { RATE, rateLimit, rateLimitedResponse } from "@/lib/rate-limit";
import { Permission } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const admin = req.nextUrl.searchParams.get("admin") === "1";
  if (admin) {
    const { error } = await requirePermission(Permission.EVENTS_WRITE);
    if (error) {
      // analysts can also list via analytics; allow members_read+ as fallback list
      const { error: e2 } = await requirePermission(Permission.MEMBERS_READ);
      if (e2) return e2;
    }
    const rows = await db.select().from(cultEvents).orderBy(desc(cultEvents.startsAt));
    return NextResponse.json({ events: rows });
  }

  const { session, error } = await requireMember();
  if (error) return error;

  const rows = await db
    .select()
    .from(cultEvents)
    .where(eq(cultEvents.active, true))
    .orderBy(asc(cultEvents.startsAt));

  const mine = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.memberId, session!.user.memberId!));

  const rsvpMap = Object.fromEntries(mine.map((r) => [r.eventId, r.status]));

  return NextResponse.json({
    events: rows.map((e) => ({
      ...e,
      myRsvp: rsvpMap[e.id] ?? null,
    })),
  });
}

const createSchema = z.object({
  slug: z.string().min(2).max(80),
  title: z.string().min(2).max(160),
  description: z.string().min(2),
  location: z.string().max(160).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  minLevelRank: z.number().int().min(1).max(12).default(1),
  capacity: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const action = json?.action as string | undefined;

  // Member RSVP
  if (action === "rsvp") {
    const { session, error } = await requireMember();
    if (error) return error;
    const rl = rateLimit({
      key: `rsvp:${session!.user.id}`,
      ...RATE.rituals,
    });
    if (!rl.ok) return rateLimitedResponse(rl.retryAfterSec);

    const key = requireIdempotencyKey(req);
    if (!key) return missingIdempotencyResponse();

    const schema = z.object({
      action: z.literal("rsvp"),
      eventId: z.string().uuid(),
      status: z.enum(["going", "cancelled"]).optional(),
    });
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid RSVP" }, { status: 400 });
    }

    try {
      const result = await withIdempotency({
        userId: session!.user.id,
        route: "POST /api/events/rsvp",
        key,
        run: async () => {
          const out = await rsvpEvent({
            eventId: parsed.data.eventId,
            memberId: session!.user.memberId!,
            userId: session!.user.id,
            idempotencyKey: key,
            status: parsed.data.status,
          });
          return {
            rsvpId: out.rsvp.id,
            status: out.rsvp.status,
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

  // Admin create
  const { session, error } = await requirePermission(Permission.EVENTS_WRITE);
  if (error) return error;
  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/events",
      key,
      run: async () => {
        const row = await createEvent({
          ...parsed.data,
          startsAt: new Date(parsed.data.startsAt),
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
          actorId: session!.user.id,
        });
        return { id: row.id, slug: row.slug };
      },
    });
    return NextResponse.json(result.body, { status: 201 });
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requirePermission(Permission.EVENTS_WRITE);
  if (error) return error;
  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const schema = createSchema.partial().extend({ id: z.string().uuid() });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
  }

  const { id, startsAt, endsAt, ...rest } = parsed.data;
  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: `PATCH /api/events/${id}`,
      key,
      run: async () => {
        const row = await updateEvent(id, {
          ...rest,
          startsAt: startsAt ? new Date(startsAt) : undefined,
          endsAt: endsAt ? new Date(endsAt) : undefined,
          actorId: session!.user.id,
        });
        return { id: row.id, slug: row.slug, active: row.active };
      },
    });
    return NextResponse.json(result.body);
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
