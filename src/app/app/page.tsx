import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { creditLedger, levels, members, passportStamps, rituals } from "@/db/schema";
import { formatXp, rankIndex, rankTitle } from "@/lib/design";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

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

  const allLevels = await db.select().from(levels).orderBy(asc(levels.rank));
  const nextLevel = allLevels.find((l) => l.xpThreshold > member.xpBalance);
  const prevThreshold = level?.xpThreshold ?? 0;
  const nextThreshold = nextLevel?.xpThreshold ?? (member.xpBalance || 1);
  const span = Math.max(1, nextThreshold - prevThreshold);
  const progress = nextLevel
    ? Math.min(1, Math.max(0, (member.xpBalance - prevThreshold) / span))
    : 1;
  const xpToNext = nextLevel
    ? Math.max(0, nextThreshold - member.xpBalance)
    : 0;

  const [stampCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(passportStamps)
    .where(eq(passportStamps.memberId, member.id));

  const earnedCredits = await db
    .select({ s: sql<number>`coalesce(sum(case when ${creditLedger.delta} > 0 then ${creditLedger.delta} else 0 end), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.memberId, member.id));

  const spentCredits = await db
    .select({ s: sql<number>`coalesce(sum(case when ${creditLedger.delta} < 0 then -${creditLedger.delta} else 0 end), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.memberId, member.id));

  const activeRituals = await db
    .select()
    .from(rituals)
    .where(eq(rituals.active, true))
    .limit(2);

  return (
    <div className="px-6 pt-7">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-semibold tracking-[0.3em] text-white">
            CULT
          </p>
          <p className="mt-2 text-sm font-light text-warm-grey">
            {member.displayName}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-[0.62rem] uppercase tracking-[0.22em] text-warm-grey hover:text-white"
          >
            Exit
          </button>
        </form>
      </header>

      {/* Membership rank — prestigious, not game HUD */}
      <section className="animate-rise mt-14">
        <p className="cult-eyebrow">Membership</p>
        <h1 className="font-display mt-5 text-[clamp(2.8rem,12vw,4.25rem)] font-medium leading-[0.92] tracking-[-0.02em] text-white">
          {rankTitle(level?.name).split(" ").map((w, i) => (
            <span key={i} className="block">
              {w}
            </span>
          ))}
        </h1>
        <p className="cult-meta mt-6">
          Level {rankIndex(level?.rank ?? 1)}
        </p>
        <p className="mt-8 font-display text-3xl tabular-nums text-white">
          {formatXp(member.xpBalance)}{" "}
          <span className="text-base tracking-[0.2em] text-warm-grey">XP</span>
        </p>
        <hr className="cult-rule mt-8 max-w-[12rem]" />
        {nextLevel ? (
          <p className="cult-meta mt-5">
            {formatXp(xpToNext)} XP to {rankTitle(nextLevel.name)}
          </p>
        ) : (
          <p className="cult-meta mt-5">Threshold complete</p>
        )}
        <div className="cult-xp-track mt-6 max-w-xs">
          <div
            className="cult-xp-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-8 flex gap-8">
          <Link
            href="/app/passport"
            className="cult-meta text-stone hover:text-white"
          >
            Passport · {stampCount?.c ?? 0} stamps →
          </Link>
        </div>
      </section>

      {/* CULT Credits — separate from XP */}
      <section className="animate-rise-delay cult-panel mt-14 p-6">
        <p className="cult-eyebrow">Cult credits</p>
        <p className="font-display mt-4 text-4xl tabular-nums text-white">
          {formatXp(member.creditBalance)}
        </p>
        <p className="cult-meta mt-2">Available</p>
        <hr className="cult-rule my-6" />
        <div className="flex justify-between text-[0.65rem] uppercase tracking-[0.16em] text-warm-grey">
          <span>Earned</span>
          <span className="tabular-nums text-stone">
            +{formatXp(earnedCredits[0]?.s ?? 0)}
          </span>
        </div>
        <div className="mt-3 flex justify-between text-[0.65rem] uppercase tracking-[0.16em] text-warm-grey">
          <span>Spent</span>
          <span className="tabular-nums text-stone">
            −{formatXp(spentCredits[0]?.s ?? 0)}
          </span>
        </div>
        <Link
          href="/app/offerings"
          className="cult-meta mt-8 inline-block text-stone hover:text-white"
        >
          View offerings →
        </Link>
      </section>

      <section className="animate-rise-delay-2 mt-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl font-medium text-white">
            Rituals
          </h2>
          <Link
            href="/app/rituals"
            className="cult-meta text-warm-grey hover:text-white"
          >
            All →
          </Link>
        </div>
        <ul className="mt-8">
          {activeRituals.map((r, i) => (
            <li
              key={r.id}
              className="border-t border-[var(--cult-line)] py-6"
            >
              <p className="cult-eyebrow">
                Ritual {String(r.sortOrder ?? i + 1).padStart(2, "0")}
              </p>
              <p className="font-display mt-2 text-2xl text-white">{r.name}</p>
              <p className="mt-2 text-sm font-light text-warm-grey">
                {r.description}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
