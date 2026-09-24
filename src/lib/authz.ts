import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  hasPermission,
  isStaffRole,
  Permission,
  type PermissionValue,
} from "@/lib/rbac";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
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
      error: NextResponse.json(
        { error: "Member profile required" },
        { status: 403 },
      ),
    };
  }
  return { session, error: null };
}

/** Any staff role may enter /admin */
export async function requireStaff() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!isStaffRole(session!.user.role)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

/** @deprecated prefer requirePermission(Permission.RECEIPTS_REVIEW) */
export async function requireAdmin() {
  return requirePermission(Permission.RECEIPTS_REVIEW);
}

export async function requirePermission(permission: PermissionValue) {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (!hasPermission(session!.user.role, permission)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Forbidden", code: "RBAC", permission },
        { status: 403 },
      ),
    };
  }
  return { session, error: null };
}
