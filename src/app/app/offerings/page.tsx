import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { offerings } from "@/db/schema";
import { RedeemButton } from "./redeem-button";

export const metadata = { title: "Offerings" };
export const dynamic = "force-dynamic";

export default async function OfferingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const list = await db
    .select()
    .from(offerings)
    .where(eq(offerings.status, "active"));

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Offerings</h1>
      <p className="mt-2 text-mist">
        Spend CULT Credits. Cost & eligibility are server-side.
      </p>
      <ul className="mt-8 space-y-4">
        {list.map((o) => (
          <li
            key={o.id}
            className="rounded-2xl border border-[var(--cult-line)] bg-ink/50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg text-bone">{o.name}</h2>
                <p className="mt-1 text-sm text-mist">{o.description}</p>
                <p className="mt-3 text-xs text-copper">
                  {o.creditCost} credits · lvl {o.minLevelRank}+
                </p>
              </div>
              <RedeemButton offeringId={o.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
