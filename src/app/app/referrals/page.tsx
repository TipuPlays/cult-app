import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { referralClaims } from "@/db/schema";
import { ensureReferralCode } from "@/lib/referrals";
import { ReferralClaimForm } from "./claim-form";

export const metadata = { title: "Invite" };
export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const code = await ensureReferralCode(session.user.memberId);
  const claims = await db
    .select()
    .from(referralClaims)
    .where(eq(referralClaims.referrerMemberId, session.user.memberId))
    .orderBy(desc(referralClaims.createdAt))
    .limit(20);

  return (
    <main className="px-6 pt-7">
      <Link
        href="/app/profile"
        className="text-[0.62rem] uppercase tracking-[0.22em] text-warm-grey hover:text-white"
      >
        ← You
      </Link>
      <p className="cult-eyebrow mt-10">Grow the circle</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Invite
      </h1>
      <p className="mt-4 max-w-sm text-sm font-light text-stone">
        Share your code. Awards land via ledgers — no self-referral.
      </p>

      <section className="cult-panel mt-12 p-8 text-center">
        <p className="cult-eyebrow">Your code</p>
        <p className="font-display mt-5 text-3xl tracking-[0.28em] text-white md:text-4xl">
          {code.code}
        </p>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-3xl font-medium text-white">
          Enter a code
        </h2>
        <ReferralClaimForm />
      </section>

      <section className="mt-16">
        <h2 className="font-display text-3xl font-medium text-white">
          Your invites
        </h2>
        <ul className="mt-6">
          {claims.length === 0 && (
            <li className="text-sm font-light text-warm-grey">No claims yet.</li>
          )}
          {claims.map((c) => (
            <li
              key={c.id}
              className="border-t border-[var(--cult-line)] py-4 text-sm font-light text-warm-grey"
            >
              <span className="uppercase tracking-[0.14em] text-stone">
                {c.status}
              </span>
              {" · "}+{c.referrerXp} XP / +{c.referrerCredits} CR ·{" "}
              {new Date(c.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
