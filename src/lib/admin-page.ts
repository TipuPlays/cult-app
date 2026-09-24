import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  hasPermission,
  isStaffRole,
  type PermissionValue,
} from "@/lib/rbac";

export async function requireStaffPage(permission?: PermissionValue) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isStaffRole(session.user.role)) redirect("/app");
  if (permission && !hasPermission(session.user.role, permission)) {
    redirect("/admin");
  }
  return session;
}
