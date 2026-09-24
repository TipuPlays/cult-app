import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { requirePermission } from "@/lib/authz";
import {
  missingIdempotencyResponse,
  requireIdempotencyKey,
  withIdempotency,
} from "@/lib/idempotency";
import { LedgerError } from "@/lib/ledgers";
import { Permission, STAFF_ROLES } from "@/lib/rbac";
import { assignRole } from "@/lib/roles";

export async function GET() {
  const { error } = await requirePermission(Permission.ROLES_WRITE);
  if (error) return error;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      memberId: members.id,
      displayName: members.displayName,
    })
    .from(users)
    .leftJoin(members, eq(members.userId, users.id));

  return NextResponse.json({ users: rows, assignable: STAFF_ROLES });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission(Permission.ROLES_WRITE);
  if (error) return error;

  const key = requireIdempotencyKey(req);
  if (!key) return missingIdempotencyResponse();

  const schema = z.object({
    userId: z.string().uuid(),
    role: z.enum([
      "member",
      "analyst",
      "staff",
      "manager",
      "admin",
      "super_admin",
    ]),
  });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await withIdempotency({
      userId: session!.user.id,
      route: "POST /api/admin/roles",
      key,
      run: async () => {
        const updated = await assignRole({
          targetUserId: parsed.data.userId,
          role: parsed.data.role,
          actorId: session!.user.id,
          actorRole: session!.user.role,
        });
        return { userId: updated.id, role: updated.role };
      },
    });
    return NextResponse.json(result.body);
  } catch (e) {
    if (e instanceof LedgerError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    throw e;
  }
}
