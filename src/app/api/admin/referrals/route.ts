import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { members, referralClaims, referralCodes, users } from "@/db/schema";
import { requirePermission } from "@/lib/authz";
import { Permission } from "@/lib/rbac";

export async function GET() {
  const { error } = await requirePermission(Permission.REFERRALS_READ);
  if (error) return error;

  const codes = await db
    .select({
      code: referralCodes.code,
      active: referralCodes.active,
      displayName: members.displayName,
      email: users.email,
      createdAt: referralCodes.createdAt,
    })
    .from(referralCodes)
    .innerJoin(members, eq(referralCodes.memberId, members.id))
    .innerJoin(users, eq(members.userId, users.id))
    .orderBy(desc(referralCodes.createdAt))
    .limit(200);

  const claims = await db
    .select()
    .from(referralClaims)
    .orderBy(desc(referralClaims.createdAt))
    .limit(100);

  return NextResponse.json({ codes, claims });
}
