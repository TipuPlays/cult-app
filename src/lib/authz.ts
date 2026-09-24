import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== "admin" && session!.user.role !== "staff") {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

export async function requireMember() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!session!.user.memberId) {
    return {
      session: null,
      error: NextResponse.json({ error: "Member profile required" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
