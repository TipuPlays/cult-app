import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { levels } from "@/db/schema";

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
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10 md:px-8">
      <Link href="/" className="font-display text-xl tracking-[0.2em] text-bone">
        CULT
      </Link>
      <h1 className="font-display mt-14 text-4xl text-bone md:text-5xl">
        Twelve thresholds.
      </h1>
      <p className="mt-4 max-w-md text-mist">
        Progress is XP. Spend is CULT Credits. They never mix.
      </p>
      <ol className="mt-12 space-y-0 border-t border-[var(--cult-line)]">
        {rows.map((l) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--cult-line)] py-4"
          >
            <div>
              <span className="mr-3 font-display text-copper">
                {(l.visualMeta as { mark?: string })?.mark ?? l.rank}
              </span>
              <span className="text-bone">{l.name}</span>
            </div>
            <span className="text-sm tabular-nums text-mist">{l.xpThreshold} XP</span>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-8 text-mist">Levels load when the database is seeded.</li>
        )}
      </ol>
      <Link
        href="/join"
        className="mt-12 inline-flex rounded-full bg-matcha px-6 py-3 text-sm font-semibold text-void"
      >
        Request membership
      </Link>
    </main>
  );
}
