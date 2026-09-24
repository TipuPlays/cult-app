import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { rituals } from "@/db/schema";
import { CompleteRitualButton } from "./complete-button";

export const metadata = { title: "Rituals" };
export const dynamic = "force-dynamic";

export default async function RitualsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const list = await db.select().from(rituals).where(eq(rituals.active, true));

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Rituals</h1>
      <p className="mt-2 text-mist">Server-validated. Cooldowns enforced.</p>
      <ul className="mt-8 space-y-4">
        {list.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-[var(--cult-line)] bg-ink/50 p-5"
          >
            <h2 className="text-lg text-bone">{r.name}</h2>
            <p className="mt-1 text-sm text-mist">{r.description}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-copper">
                +{r.xpReward} XP
                {r.creditReward ? ` · +${r.creditReward} cr` : ""}
              </p>
              <CompleteRitualButton slug={r.slug} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
