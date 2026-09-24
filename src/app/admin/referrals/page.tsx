import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { members, referralClaims, referralCodes, users } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";

export const metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  await requireStaffPage(Permission.REFERRALS_READ);

  const codes = await db
    .select({
      code: referralCodes.code,
      active: referralCodes.active,
      displayName: members.displayName,
      email: users.email,
    })
    .from(referralCodes)
    .innerJoin(members, eq(referralCodes.memberId, members.id))
    .innerJoin(users, eq(members.userId, users.id))
    .orderBy(desc(referralCodes.createdAt))
    .limit(100);

  const claims = await db
    .select()
    .from(referralClaims)
    .orderBy(desc(referralClaims.createdAt))
    .limit(50);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Referrals</h1>
      <section className="mt-10">
        <h2 className="font-display text-2xl text-bone">Codes</h2>
        <ul className="mt-4 space-y-2">
          {codes.map((c) => (
            <li
              key={c.code}
              className="flex justify-between rounded-xl border border-[var(--cult-line)] px-4 py-3 text-sm"
            >
              <span className="tracking-widest text-bone">{c.code}</span>
              <span className="text-mist">
                {c.displayName} · {c.email}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Claims</h2>
        <ul className="mt-4 space-y-2">
          {claims.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-[var(--cult-line)] px-4 py-3 text-sm text-mist"
            >
              {c.status} · ref+{c.referrerXp}/{c.referrerCredits} · new+
              {c.refereeXp}/{c.refereeCredits}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
