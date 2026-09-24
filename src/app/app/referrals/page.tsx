import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { referralClaims } from "@/db/schema";
import { ensureReferralCode } from "@/lib/referrals";
import { ReferralClaimForm } from "./claim-form";

export const metadata = { title: "Referrals" };
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
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Referrals</h1>
      <p className="mt-2 text-mist">
        Share your code. Awards land via ledgers — no self-referral.
      </p>

      <section className="mt-10 rounded-2xl border border-[var(--cult-line)] bg-ink/40 p-5">
        <p className="text-xs uppercase tracking-[0.25em] text-copper">
          Your code
        </p>
        <p className="mt-3 font-display text-3xl tracking-widest text-bone">
          {code.code}
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl text-bone">Enter a code</h2>
        <ReferralClaimForm />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Your invites</h2>
        <ul className="mt-4 space-y-2">
          {claims.length === 0 && (
            <li className="text-sm text-mist">No claims yet.</li>
          )}
          {claims.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-[var(--cult-line)] px-4 py-3 text-sm text-mist"
            >
              {c.status} · +{c.referrerXp} XP / +{c.referrerCredits} cr ·{" "}
              {new Date(c.createdAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
