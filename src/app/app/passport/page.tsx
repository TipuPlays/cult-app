import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { levels, members, passportStamps } from "@/db/schema";
import { VISIT_LOCATIONS } from "@/lib/visits";

export const metadata = { title: "Passport" };
export const dynamic = "force-dynamic";

export default async function PassportPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.user.memberId))
    .limit(1);
  const allLevels = await db.select().from(levels).orderBy(asc(levels.rank));
  const stamps = await db
    .select()
    .from(passportStamps)
    .where(eq(passportStamps.memberId, session.user.memberId));

  const stampSet = new Set(stamps.map((s) => s.stampSlug));
  const catalog = Object.values(VISIT_LOCATIONS);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Passport</h1>
      <p className="mt-2 text-mist">
        {member?.displayName} · {member?.xpBalance ?? 0} XP
      </p>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-bone">Stamps</h2>
        <p className="mt-1 text-sm text-mist">
          Earned from verified visits — not purchased.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {catalog.map((loc) => {
            const earned = stampSet.has(loc.stampSlug);
            return (
              <li
                key={loc.stampSlug}
                className={`flex aspect-square flex-col items-center justify-center rounded-2xl border px-2 text-center ${
                  earned
                    ? "border-matcha/50 bg-matcha/10 text-bone"
                    : "border-[var(--cult-line)] text-mist/40"
                }`}
              >
                <span className="font-display text-lg">
                  {earned ? "◎" : "○"}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-wider">
                  {loc.stampLabel}
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/app/scan" className="mt-4 inline-block text-sm text-matcha">
          Verify a visit →
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Levels</h2>
        <ol className="mt-4 space-y-2">
          {allLevels.map((l) => {
            const unlocked = (member?.xpBalance ?? 0) >= l.xpThreshold;
            const current = member?.currentLevelId === l.id;
            return (
              <li
                key={l.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  current
                    ? "border-matcha/50 bg-matcha/10"
                    : "border-[var(--cult-line)]"
                } ${unlocked ? "text-bone" : "text-mist/50"}`}
              >
                <span>
                  <span className="mr-2 font-display text-copper">
                    {(l.visualMeta as { mark?: string })?.mark}
                  </span>
                  {l.name}
                </span>
                <span className="text-xs tabular-nums">{l.xpThreshold}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
