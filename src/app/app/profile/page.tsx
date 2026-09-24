import Link from "next/link";
import { listMemberBadges } from "@/lib/badges";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { members } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";

export const metadata = { title: "You" };
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

  const links = [
    { href: "/app/passport", label: "Passport" },
    { href: "/app/activity", label: "Activity" },
    { href: "/app/events", label: "Events" },
    { href: "/app/referrals", label: "Invite" },
    { href: "/app/settings", label: "Settings" },
  ];

  return (
    <main className="px-6 pt-7">
      <p className="cult-eyebrow">Identity</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">You</h1>

      <dl className="mt-14">
        <Row label="Society name" value={member?.displayName ?? "—"} />
        <Row label="Email" value={session.user.email ?? "—"} />
        <Row label="Role" value={session.user.role} />
        <Row label="Join code" value={member?.joinCode ?? "—"} mono />
      </dl>

      <section className="mt-16">
        <h2 className="font-display text-3xl font-medium text-white">Marks</h2>
        <ul className="mt-8 grid grid-cols-2 gap-px bg-[var(--cult-line)]">
          {badges.length === 0 && (
            <li className="col-span-2 bg-near-black px-4 py-10 text-sm font-light text-warm-grey">
              Earn stamps, rituals, and ranks to unlock marks.
            </li>
          )}
          {badges.map((b) => (
            <li
              key={b.id}
              className="cult-stamp is-earned bg-near-black px-4 py-7 text-center"
            >
              <p className="font-display text-xl text-white">{b.name}</p>
              <p className="mt-2 text-[0.55rem] leading-relaxed text-warm-grey">
                {b.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <nav className="mt-14">
        <ul>
          {links.map((l) => (
            <li key={l.href} className="border-t border-[var(--cult-line)]">
              <Link
                href={l.href}
                className="flex items-center justify-between py-5 text-white transition hover:text-stone"
              >
                <span className="font-display text-xl">{l.label}</span>
                <span className="cult-meta">→</span>
              </Link>
            </li>
          ))}
          {isStaffRole(session.user.role) && (
            <li className="border-t border-[var(--cult-line)]">
              <Link
                href="/admin"
                className="flex items-center justify-between py-5 text-white transition hover:text-stone"
              >
                <span className="font-display text-xl">Admin</span>
                <span className="cult-meta">→</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <form
        className="mt-12 border-t border-[var(--cult-line)] pt-8"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="text-[0.62rem] uppercase tracking-[0.22em] text-ember hover:text-white"
        >
          Exit CULT
        </button>
      </form>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[var(--cult-line)] py-4">
      <dt className="cult-eyebrow shrink-0">{label}</dt>
      <dd
        className={`text-right text-white ${mono ? "tracking-[0.28em]" : "font-light"}`}
      >
        {value}
      </dd>
    </div>
  );
}
