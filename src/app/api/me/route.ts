import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { levels, members } from "@/db/schema";
import { requireMember } from "@/lib/authz";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session!.user.memberId!))
    .limit(1);

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  let level = null;
  if (member.currentLevelId) {
    const [row] = await db
      .select()
      .from(levels)
      .where(eq(levels.id, member.currentLevelId))
      .limit(1);
    level = row ?? null;
  }

  return NextResponse.json({
    member: {
      id: member.id,
      displayName: member.displayName,
      joinCode: member.joinCode,
      status: member.status,
      xp: member.xpBalance,
      credits: member.creditBalance,
    },
    level,
  });
}
