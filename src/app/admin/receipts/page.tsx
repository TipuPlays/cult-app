import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { members, receipts, users } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";
import { ReviewActions } from "./review-actions";

export const metadata = { title: "Receipt queue" };
export const dynamic = "force-dynamic";

export default async function AdminReceiptsPage() {
  await requireStaffPage(Permission.RECEIPTS_REVIEW);

  const rows = await db
    .select({
      receipt: receipts,
      displayName: members.displayName,
      email: users.email,
    })
    .from(receipts)
    .innerJoin(members, eq(receipts.memberId, members.id))
    .innerJoin(users, eq(members.userId, users.id))
    .where(
      inArray(receipts.status, ["manual_review", "pending", "processing"]),
    )
    .orderBy(desc(receipts.createdAt))
    .limit(100);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Receipt queue</h1>
      <p className="mt-2 text-mist">
        Approve awards XP/credits via ledgers only.
      </p>
      <ul className="mt-10 space-y-4">
        {rows.length === 0 && (
          <li className="text-sm text-mist">Queue empty.</li>
        )}
        {rows.map(({ receipt: r, displayName, email }) => (
          <li
            key={r.id}
            className="rounded-2xl border border-[var(--cult-line)] bg-ink/50 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-bone">
                {displayName}{" "}
                <span className="text-sm text-mist">({email})</span>
              </p>
              <span className="text-[10px] uppercase tracking-wider text-copper">
                {r.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-mist">
              {r.merchant ?? "—"} ·{" "}
              {r.amountCents != null
                ? `$${(r.amountCents / 100).toFixed(2)}`
                : "no amount"}{" "}
              · fraud {r.fraudScore}
            </p>
            <ReviewActions receiptId={r.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
