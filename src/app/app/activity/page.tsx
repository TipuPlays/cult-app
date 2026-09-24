import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { creditLedger, members, xpLedger } from "@/db/schema";

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
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Activity</h1>
      <p className="mt-2 text-mist">
        Ledger truth · {member?.xpBalance ?? 0} XP · {member?.creditBalance ?? 0}{" "}
        credits
      </p>
      <ul className="mt-8 space-y-3">
        {events.length === 0 && (
          <li className="text-sm text-mist">No ledger activity yet.</li>
        )}
        {events.map((e) => (
          <li
            key={`${e.kind}-${e.id}`}
            className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--cult-line)] bg-ink/40 px-4 py-3"
          >
            <div>
              <p className="text-sm text-bone">{e.reason}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-mist">
                {e.kind} · {new Date(e.at).toLocaleString()}
              </p>
            </div>
            <p
              className={`font-display text-lg tabular-nums ${
                e.delta >= 0 ? "text-matcha" : "text-ember"
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
