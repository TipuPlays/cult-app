import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { levels, members, passportStamps } from "@/db/schema";
import { formatXp, rankIndex, rankTitle } from "@/lib/design";

export const metadata = { title: "Passport" };
export const dynamic = "force-dynamic";

/** Museum catalogue — categories with earned + locked slots */
const CATALOGUE = [
  {
    title: "Espresso",
    slots: [
      { slug: "flagship", label: "Flagship" },
      { slug: "null-espresso-2", label: "Single Origin", locked: true },
      { slug: "null-espresso-3", label: "Ristretto", locked: true },
    ],
  },
  {
    title: "Matcha",
    slots: [
      { slug: "ceremonial-bar", label: "Ceremonial" },
      { slug: "null-matcha-2", label: "Usucha", locked: true },
      { slug: "null-matcha-3", label: "Koicha", locked: true },
    ],
  },
  {
    title: "Signatures",
    slots: [
      { slug: "origin-lab", label: "Origin Lab" },
      { slug: "null-sig-2", label: "House Blend", locked: true },
      { slug: "null-sig-3", label: "Seasonal", locked: true },
    ],
  },
  {
    title: "Pairings",
    slots: [
      { slug: "null-pair-1", label: "Pastry", locked: true },
      { slug: "null-pair-2", label: "Chocolate", locked: true },
      { slug: "null-pair-3", label: "Cheese", locked: true },
    ],
  },
] as const;

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
  const current = allLevels.find((l) => l.id === member?.currentLevelId);

  return (
    <main className="px-6 pt-7">
      <p className="cult-eyebrow">Archive</p>
      <h1 className="font-display mt-4 text-5xl font-medium leading-none text-white">
        Your
        <br />
        Passport
      </h1>
      <p className="mt-5 text-sm font-light text-stone">
        {member?.displayName} · {formatXp(member?.xpBalance ?? 0)} XP
      </p>

      <section className="mt-16 space-y-12">
        {CATALOGUE.map((cat) => {
          const dots = cat.slots.map((s) =>
            !("locked" in s && s.locked) && stampSet.has(s.slug),
          );
          return (
            <div key={cat.title}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-2xl text-white">{cat.title}</h2>
                <p className="flex gap-2 text-sm tracking-[0.2em] text-warm-grey">
                  {dots.map((on, i) => (
                    <span key={i} className={on ? "text-white" : "text-warm-grey/40"}>
                      {on ? "●" : "○"}
                    </span>
                  ))}
                </p>
              </div>
              <ul className="mt-5 grid grid-cols-3 gap-px bg-[var(--cult-line)]">
                {cat.slots.map((slot) => {
                  const locked = "locked" in slot && slot.locked;
                  const earned = !locked && stampSet.has(slot.slug);
                  return (
                    <li
                      key={slot.slug}
                      className={`cult-stamp bg-near-black px-3 py-7 text-center ${
                        earned
                          ? "is-earned text-white"
                          : locked
                            ? "is-locked text-warm-grey"
                            : "text-warm-grey/50"
                      }`}
                    >
                      <span className="font-display text-xl leading-none">
                        {earned ? "◎" : "○"}
                      </span>
                      <span className="mt-3 block text-[0.55rem] uppercase tracking-[0.16em]">
                        {slot.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <p className="mt-10">
        <Link
          href="/app/scan"
          className="cult-meta text-stone hover:text-white"
        >
          Verify a visit →
        </Link>
      </p>

      <section className="mt-20">
        <h2 className="font-display text-3xl font-medium text-white">Ranks</h2>
        <ol className="mt-8">
          {allLevels.map((l) => {
            const unlocked = (member?.xpBalance ?? 0) >= l.xpThreshold;
            const isCurrent = member?.currentLevelId === l.id;
            return (
              <li
                key={l.id}
                className={`flex items-baseline justify-between border-t border-[var(--cult-line)] py-5 ${
                  unlocked ? "text-white" : "text-warm-grey/35"
                }`}
              >
                <div>
                  <p className="cult-meta mb-1">
                    {rankIndex(l.rank)}
                    {isCurrent ? " · Current" : ""}
                  </p>
                  <p className="font-display text-xl">
                    {rankTitle(l.name)}
                  </p>
                </div>
                <span className="cult-meta tabular-nums">
                  {formatXp(l.xpThreshold)} XP
                </span>
              </li>
            );
          })}
        </ol>
        {current && (
          <p className="cult-meta mt-8 text-stone">
            You hold {rankTitle(current.name)}
          </p>
        )}
      </section>
    </main>
  );
}
