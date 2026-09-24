import { redirect } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { levels, members, receipts } from "@/db/schema";
import { formatXp, rankIndex, rankTitle } from "@/lib/design";
import { ReceiptUploadForm } from "./upload-form";
import { VisitVerifyForm } from "./visit-form";

export const metadata = { title: "Scan" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, session.user.memberId))
    .limit(1);

  let level = null;
  if (member?.currentLevelId) {
    const [row] = await db
      .select()
      .from(levels)
      .where(eq(levels.id, member.currentLevelId))
      .limit(1);
    level = row;
  }

  const allLevels = await db.select().from(levels).orderBy(asc(levels.rank));
  const nextLevel = allLevels.find(
    (l) => l.xpThreshold > (member?.xpBalance ?? 0),
  );
  const prevThreshold = level?.xpThreshold ?? 0;
  const nextThreshold = nextLevel?.xpThreshold ?? (member?.xpBalance || 1);
  const span = Math.max(1, nextThreshold - prevThreshold);
  const progress = nextLevel
    ? Math.min(
        1,
        Math.max(0, ((member?.xpBalance ?? 0) - prevThreshold) / span),
      )
    : 1;

  const recent = await db
    .select()
    .from(receipts)
    .where(eq(receipts.memberId, session.user.memberId))
    .orderBy(desc(receipts.createdAt))
    .limit(8);

  return (
    <main className="px-6 pt-7">
      <p className="cult-eyebrow">Presence</p>
      <h1 className="font-display mt-5 text-[clamp(2.6rem,11vw,3.75rem)] font-medium leading-[0.95] text-white">
        Enter CULT
        <br />
        Scan your visit
      </h1>
      <p className="mt-5 max-w-sm text-sm font-light text-stone">
        The bridge between the café and your membership. Verify with a visit
        code — rewards settle in the ledger.
      </p>

      <section className="cult-panel mt-14 p-7">
        <p className="cult-eyebrow">Visit code</p>
        <VisitVerifyForm />
      </section>

      {/* Membership status strip — restrained confirmation language */}
      <section className="mt-12 border-t border-[var(--cult-line)] pt-8">
        <p className="font-display text-2xl text-white">
          {rankTitle(level?.name)}
        </p>
        <p className="cult-meta mt-2">
          Level {rankIndex(level?.rank ?? 1)} · {formatXp(member?.xpBalance ?? 0)}{" "}
          XP
        </p>
        <div className="cult-xp-track mt-6 max-w-xs">
          <div
            className="cult-xp-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-white">Receipt</h2>
        <p className="mt-2 text-sm font-light text-warm-grey">
          Optional. Awards after staff approval.
        </p>
        <ReceiptUploadForm />
      </section>

      <section className="mt-16">
        <h2 className="font-display text-2xl text-white">Recent</h2>
        <ul className="mt-6">
          {recent.length === 0 && (
            <li className="text-sm font-light text-warm-grey">
              No receipts yet.
            </li>
          )}
          {recent.map((r) => (
            <li
              key={r.id}
              className="flex items-baseline justify-between gap-4 border-t border-[var(--cult-line)] py-4"
            >
              <div>
                <p className="font-display text-lg text-white">
                  {r.merchant ?? "Receipt"}
                </p>
                <p className="mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-warm-grey">
                  {r.status.replace("_", " ")}
                  {r.status === "approved"
                    ? ` · +${r.xpAwarded} XP`
                    : ""}
                </p>
              </div>
              <span className="text-sm tabular-nums text-stone">
                {r.amountCents != null
                  ? `$${(r.amountCents / 100).toFixed(2)}`
                  : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
