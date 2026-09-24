import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { levels, members, users } from "@/db/schema";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    redirect("/app");
  }

  const rows = await db
    .select({
      member: members,
      email: users.email,
      role: users.role,
      levelName: levels.name,
      levelRank: levels.rank,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .leftJoin(levels, eq(members.currentLevelId, levels.id));

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Members</h1>
      <ul className="mt-10 space-y-3">
        {rows.map((r) => (
          <li
            key={r.member.id}
            className="rounded-2xl border border-[var(--cult-line)] px-4 py-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-bone">{r.member.displayName}</p>
              <span className="text-xs text-mist">{r.role}</span>
            </div>
            <p className="mt-1 text-sm text-mist">{r.email}</p>
            <p className="mt-2 text-xs text-copper">
              {r.levelName ?? "—"} · {r.member.xpBalance} XP ·{" "}
              {r.member.creditBalance} credits · {r.member.status}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
