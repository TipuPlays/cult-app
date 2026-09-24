import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { levels, members } from "@/db/schema";

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

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Passport</h1>
      <p className="mt-2 text-mist">
        {member?.displayName} · {member?.xpBalance ?? 0} XP
      </p>
      <ol className="mt-10 space-y-2">
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
    </main>
  );
}
