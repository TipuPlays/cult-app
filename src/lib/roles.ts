import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { LedgerError } from "@/lib/ledgers";
import {
  assignableRoles,
  isStaffRole,
  type AppRole,
  type StaffRoleValue,
} from "@/lib/rbac";

export async function assignRole(input: {
  targetUserId: string;
  role: AppRole;
  actorId: string;
  actorRole: string;
}) {
  if (input.actorRole !== "super_admin") {
    throw new LedgerError("Only SUPER_ADMIN can assign roles", "INVALID");
  }
  if (input.role !== "member" && !isStaffRole(input.role)) {
    throw new LedgerError("Invalid role", "INVALID");
  }
  if (input.role !== "member" && !assignableRoles().includes(input.role)) {
    throw new LedgerError("Role not assignable", "INVALID");
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.targetUserId))
    .limit(1);
  if (!target) throw new LedgerError("User not found", "NOT_FOUND");

  // Prevent last super_admin demotion
  if (target.role === "super_admin" && input.role !== "super_admin") {
    const supers = await db
      .select()
      .from(users)
      .where(eq(users.role, "super_admin"));
    if (supers.length <= 1) {
      throw new LedgerError("Cannot demote the last SUPER_ADMIN", "INVALID");
    }
  }

  const [updated] = await db
    .update(users)
    .set({ role: input.role as StaffRoleValue | "member", updatedAt: new Date() })
    .where(eq(users.id, input.targetUserId))
    .returning();

  await db.insert(auditEvents).values({
    actorId: input.actorId,
    action: "role.assigned",
    entityType: "user",
    entityId: updated.id,
    payload: { from: target.role, to: input.role },
  });

  return updated;
}
