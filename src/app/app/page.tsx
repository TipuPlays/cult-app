import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { levels, members, rituals } from "@/db/schema";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/app", label: "Home" },
  { href: "/app/rituals", label: "Rituals" },
  { href: "/app/passport", label: "Passport" },
  { href: "/app/offerings", label: "Offerings" },
  { href: "/app/scan", label: "Scan" },
  { href: "/app/profile", label: "Profile" },
] as const;

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.user.memberId))
    .limit(1);

  if (!member) redirect("/login");

  let level = null;
  if (member.currentLevelId) {
    const [row] = await db
      .select()
      .from(levels)
      .where(eq(levels.id, member.currentLevelId))
      .limit(1);
    level = row;
  }

  const activeRituals = await db
    .select()
    .from(rituals)
    .where(eq(rituals.active, true))
    .limit(3);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-28 pt-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl tracking-[0.18em] text-bone">CULT</p>
          <p className="mt-1 text-sm text-mist">Welcome back, {member.displayName}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-xs uppercase tracking-widest text-mist">
            Exit
          </button>
        </form>
      </header>

      <section className="animate-rise mt-10 overflow-hidden rounded-[1.75rem] border border-[var(--cult-line)] bg-gradient-to-br from-soil/80 to-void p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-copper">Passport</p>
        <h1 className="font-display mt-3 text-3xl text-bone">
          {level?.name ?? "Initiate"}
        </h1>
        <p className="mt-1 text-sm text-mist">
          Level mark{" "}
          <span className="text-bone">
            {(level?.visualMeta as { mark?: string } | null)?.mark ?? "I"}
          </span>
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <Stat label="XP" value={String(member.xpBalance)} />
          <Stat label="Credits" value={String(member.creditBalance)} />
        </div>
        <p className="mt-6 text-xs text-mist">
          Code <span className="tracking-widest text-bone">{member.joinCode}</span>
        </p>
      </section>

      <section className="animate-rise-delay mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl text-bone">Today&apos;s rituals</h2>
          <Link href="/app/rituals" className="text-sm text-matcha">
            All
          </Link>
        </div>
        <ul className="mt-4 space-y-3">
          {activeRituals.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[var(--cult-line)] bg-ink/40 px-4 py-4"
            >
              <p className="text-bone">{r.name}</p>
              <p className="mt-1 text-sm text-mist">{r.description}</p>
              <p className="mt-2 text-xs text-copper">
                +{r.xpReward} XP
                {r.creditReward > 0 ? ` · +${r.creditReward} credits` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--cult-line)] bg-void/90 backdrop-blur-md">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-2">
          {NAV.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className="flex flex-col items-center gap-1 px-1 py-2 text-[10px] uppercase tracking-wider text-mist hover:text-bone"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-void/50 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-mist">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-bone">{value}</p>
    </div>
  );
}
