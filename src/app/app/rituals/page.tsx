import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { rituals } from "@/db/schema";
import { ritualIndex } from "@/lib/design";
import { CompleteRitualButton } from "./complete-button";

export const metadata = { title: "Rituals" };
export const dynamic = "force-dynamic";

export default async function RitualsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const list = await db.select().from(rituals).where(eq(rituals.active, true));

  return (
    <main className="px-6 pt-7">
      <p className="cult-eyebrow">Ceremonies</p>
      <h1 className="font-display mt-4 text-5xl font-medium leading-none text-white">
        Rituals
      </h1>
      <p className="mt-4 max-w-sm text-sm font-light leading-relaxed text-stone">
        Invitations to practice. Complete when ready — windows and visit codes
        are enforced server-side.
      </p>

      <ul className="mt-14 space-y-6">
        {list.map((r, i) => (
          <li key={r.id} className="cult-invite animate-rise">
            <p className="cult-eyebrow">
              Ritual {ritualIndex(r.sortOrder, i)}
            </p>
            <h2 className="font-display mt-5 text-3xl font-medium leading-tight text-white">
              {r.name}
            </h2>
            <p className="mt-4 text-sm font-light leading-relaxed text-warm-grey">
              {r.description}
            </p>
            <p className="cult-meta mt-8 text-stone">
              {r.verifyMode === "visit_code"
                ? "Requires visit verification"
                : `+${r.xpReward} XP${r.creditReward ? ` · +${r.creditReward} credits` : ""}`}
            </p>
            <div className="mt-8 flex justify-end">
              <CompleteRitualButton slug={r.slug} verifyMode={r.verifyMode} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
