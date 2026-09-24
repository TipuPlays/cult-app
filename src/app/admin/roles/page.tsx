import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";
import { RoleAssignForm } from "./role-form";

export const metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requireStaffPage(Permission.ROLES_WRITE);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      displayName: members.displayName,
    })
    .from(users)
    .leftJoin(members, eq(members.userId, users.id));

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Roles</h1>
      <p className="mt-2 text-mist">SUPER_ADMIN only · audited.</p>
      <RoleAssignForm users={rows} />
    </main>
  );
}
