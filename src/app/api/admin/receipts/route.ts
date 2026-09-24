import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { members, receipts, users } from "@/db/schema";
import { requireAdmin } from "@/lib/authz";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const rows = await db
    .select({
      receipt: receipts,
      displayName: members.displayName,
      email: users.email,
    })
    .from(receipts)
    .innerJoin(members, eq(receipts.memberId, members.id))
    .innerJoin(users, eq(members.userId, users.id))
    .where(
      inArray(receipts.status, ["manual_review", "pending", "processing"]),
    )
    .orderBy(desc(receipts.createdAt))
    .limit(100);

  return NextResponse.json({
    queue: rows.map((r) => ({
      ...r.receipt,
      memberDisplayName: r.displayName,
      memberEmail: r.email,
    })),
  });
}
