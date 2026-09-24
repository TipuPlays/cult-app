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
    <main className="px-6 pt-7">
      <p className="cult-eyebrow">Discovery</p>
      <h1 className="font-display mt-4 text-5xl font-medium leading-none text-white">
        Offerings
      </h1>
      <p className="mt-4 max-w-sm text-sm font-light text-stone">
        Spend CULT Credits. Eligibility is server-side.
      </p>

      <ul className="mt-14">
        {list.map((o, i) => (
          <li
            key={o.id}
            className="border-t border-[var(--cult-line)] py-10 first:border-t-0 first:pt-0"
          >
            <p className="cult-eyebrow">
              Offering / {String(i + 1).padStart(2, "0")}
            </p>
            <h2 className="font-display mt-4 text-3xl font-medium text-white">
              {o.name}
            </h2>
            <p className="mt-3 text-sm font-light leading-relaxed text-warm-grey">
              {o.description}
            </p>
            <div className="mt-8 flex items-end justify-between gap-4">
              <p className="cult-meta text-stone">
                {o.creditCost} credits · rank {o.minLevelRank}+
              </p>
              <RedeemButton offeringId={o.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
