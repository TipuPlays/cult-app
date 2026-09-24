import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { members, users } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";
import { GrantForm } from "./grant-form";

export const metadata = { title: "Grants" };
export const dynamic = "force-dynamic";

export default async function AdminGrantsPage() {
  await requireStaffPage(Permission.GRANTS_WRITE);

  const rows = await db
    .select({
      id: members.id,
      displayName: members.displayName,
      email: users.email,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id));

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Grant / adjust</h1>
      <p className="mt-2 text-mist">
        XP and credits — ledger + audit only.
      </p>
      <GrantForm members={rows} />
    </main>
  );
}
