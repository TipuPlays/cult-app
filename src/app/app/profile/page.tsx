import Link from "next/link";
import { listMemberBadges } from "@/lib/badges";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.user.memberId))
    .limit(1);

  const badges = await listMemberBadges(session.user.memberId);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Profile</h1>
      <dl className="mt-8 space-y-4 text-sm">
        <div>
          <dt className="text-mist">Society name</dt>
          <dd className="text-bone">{member?.displayName}</dd>
        </div>
        <div>
          <dt className="text-mist">Email</dt>
          <dd className="text-bone">{session.user.email}</dd>
        </div>
        <div>
          <dt className="text-mist">Role</dt>
          <dd className="text-bone">{session.user.role}</dd>
        </div>
        <div>
          <dt className="text-mist">Join code</dt>
          <dd className="tracking-widest text-bone">{member?.joinCode}</dd>
        </div>
      </dl>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-bone">Badges</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {badges.length === 0 && (
            <li className="col-span-2 text-sm text-mist">
              Earn stamps, rituals, and levels to unlock badges.
            </li>
          )}
          {badges.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-matcha/30 bg-matcha/10 px-3 py-4 text-center"
            >
              <p className="font-display text-bone">{b.name}</p>
              <p className="mt-1 text-[10px] text-mist">{b.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-col gap-3 text-sm">
        <Link href="/app/passport" className="text-matcha">
          Passport →
        </Link>
        <Link href="/app/referrals" className="text-matcha">
          Referrals →
        </Link>
        <Link href="/app/events" className="text-matcha">
          Events →
        </Link>
        <Link href="/app/activity" className="text-matcha">
          Activity →
        </Link>
        <Link href="/app/settings" className="text-matcha">
          Settings →
        </Link>
        {isStaffRole(session.user.role) && (
          <Link href="/admin" className="text-matcha">
            Admin console →
          </Link>
        )}
      </div>
      <form
        className="mt-10"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="text-sm text-ember">
          Sign out
        </button>
      </form>
    </main>
  );
}
