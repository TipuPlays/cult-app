import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creditLedger, members, xpLedger } from "@/db/schema";
import { formatXp } from "@/lib/design";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.user.memberId))
    .limit(1);

  const [xp, credits] = await Promise.all([
    db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.memberId, session.user.memberId))
      .orderBy(desc(xpLedger.createdAt))
      .limit(30),
    db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.memberId, session.user.memberId))
      .orderBy(desc(creditLedger.createdAt))
      .limit(30),
  ]);

  const events = [
    ...xp.map((e) => ({
      id: e.id,
      kind: "xp" as const,
      delta: e.delta,
      reason: e.reason,
      at: e.createdAt,
    })),
    ...credits.map((e) => ({
      id: e.id,
      kind: "credits" as const,
      delta: e.delta,
      reason: e.reason,
      at: e.createdAt,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <main className="px-6 pt-7">
      <Link
        href="/app/profile"
        className="text-[0.62rem] uppercase tracking-[0.22em] text-warm-grey hover:text-white"
      >
        ← You
      </Link>
      <p className="cult-eyebrow mt-10">Ledger</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Activity
      </h1>
      <p className="mt-4 text-sm font-light text-stone">
        {formatXp(member?.xpBalance ?? 0)} XP ·{" "}
        {formatXp(member?.creditBalance ?? 0)} credits
      </p>
      <ul className="mt-12">
        {events.length === 0 && (
          <li className="text-sm font-light text-warm-grey">
            No ledger activity yet.
          </li>
        )}
        {events.map((e) => (
          <li
            key={`${e.kind}-${e.id}`}
            className="flex items-start justify-between gap-4 border-t border-[var(--cult-line)] py-5"
          >
            <div>
              <p className="font-display text-lg text-white">{e.reason}</p>
              <p className="mt-1 text-[0.55rem] uppercase tracking-[0.16em] text-warm-grey">
                {e.kind} · {new Date(e.at).toLocaleString()}
              </p>
            </div>
            <p
              className={`font-display text-2xl tabular-nums ${
                e.delta >= 0 ? "text-white" : "text-ember"
              }`}
            >
              {e.delta >= 0 ? "+" : ""}
              {e.delta}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
