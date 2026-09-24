import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { fraudFlags } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";
import { FraudActions } from "./fraud-actions";

export const metadata = { title: "Fraud" };
export const dynamic = "force-dynamic";

export default async function AdminFraudPage() {
  await requireStaffPage(Permission.FRAUD_REVIEW);

  const rows = await db
    .select()
    .from(fraudFlags)
    .orderBy(desc(fraudFlags.createdAt))
    .limit(100);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Fraud queue</h1>
      <p className="mt-2 text-mist">
        Dup receipts, referral velocity/self, high fraud scores.
      </p>
      <ul className="mt-10 space-y-4">
        {rows.length === 0 && (
          <li className="text-sm text-mist">No flags.</li>
        )}
        {rows.map((f) => (
          <li
            key={f.id}
            className="rounded-2xl border border-[var(--cult-line)] bg-ink/50 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-bone">{f.kind}</p>
              <span className="text-[10px] uppercase tracking-wider text-copper">
                {f.status} · sev {f.severity}
              </span>
            </div>
            <p className="mt-2 text-xs text-mist">
              {new Date(f.createdAt).toLocaleString()}
              {f.memberId ? ` · member ${f.memberId.slice(0, 8)}` : ""}
            </p>
            {f.status === "open" || f.status === "reviewing" ? (
              <FraudActions flagId={f.id} />
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
