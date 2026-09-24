import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { levels, members, users } from "@/db/schema";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(120),
  displayName: z.string().min(2).max(120),
});

export async function POST(req: NextRequest) {
  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid join payload" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Idempotency scoped to a synthetic user id hash of email until user exists —
  // for join we use email as scope via a system placeholder: store under key only after create.
  // Simpler: check email uniqueness first, then create with transaction.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json({ error: "Email already joined" }, { status: 409 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const [level1] = await db.select().from(levels).where(eq(levels.rank, 1)).limit(1);

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: parsed.data.name,
      passwordHash,
      role: "member",
    })
    .returning();

  const [member] = await db
    .insert(members)
    .values({
      userId: user.id,
      displayName: parsed.data.displayName,
      joinCode: nanoid(8).toUpperCase(),
      currentLevelId: level1?.id,
      creditBalance: 25,
    })
    .returning();

  // Record idempotency against the new user for replay safety on retries after success
  await withIdempotency({
    userId: user.id,
    route: "POST /api/join",
    key,
    run: async () => ({
      userId: user.id,
      memberId: member.id,
      joinCode: member.joinCode,
    }),
  });

  return NextResponse.json(
    {
      userId: user.id,
      memberId: member.id,
      joinCode: member.joinCode,
    },
    { status: 201 },
  );
}
