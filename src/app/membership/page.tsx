import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { levels } from "@/db/schema";
import { formatXp, rankIndex, rankTitle } from "@/lib/design";

export const metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  let rows: (typeof levels.$inferSelect)[] = [];
  try {
    rows = await db.select().from(levels).orderBy(asc(levels.rank));
  } catch {
    rows = [];
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-6 py-10 md:px-10">
      <Link
        href="/"
        className="font-display text-2xl font-semibold tracking-[0.3em] text-white"
      >
        CULT
      </Link>
      <p className="cult-eyebrow mt-20">Thresholds</p>
      <h1 className="font-display mt-5 text-5xl font-medium text-white md:text-6xl">
        Twelve ranks.
      </h1>
      <p className="mt-5 max-w-md font-light text-stone">
        Progress is XP. Spend is Credits. They never mix.
      </p>
      <ol className="mt-16">
        {rows.map((l, i) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-4 border-t border-[var(--cult-line)] py-6 animate-rise"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div>
              <p className="cult-meta mb-1">{rankIndex(l.rank)}</p>
              <p className="font-display text-2xl text-white md:text-3xl">
                {rankTitle(l.name)}
              </p>
            </div>
            <span className="cult-meta tabular-nums">
              {formatXp(l.xpThreshold)} XP
            </span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="border-t border-[var(--cult-line)] py-8 text-warm-grey">
            Ranks load when the database is seeded.
          </li>
        )}
      </ol>
      <Link href="/join" className="cult-btn mt-14 inline-flex">
        Request entry
      </Link>
    </main>
  );
}
