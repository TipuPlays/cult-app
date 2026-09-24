import Link from "next/link";
import { getAdminAnalytics } from "@/lib/analytics";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireStaffPage(Permission.ANALYTICS_READ);
  const a = await getAdminAnalytics();

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Analytics</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat label="Members" value={String(a.members)} />
        <Stat label="Visits" value={String(a.visits)} />
        <Stat label="Referrals" value={String(a.referrals)} />
        <Stat label="XP issued" value={String(a.xpIssued)} />
        <Stat label="Credits issued" value={String(a.creditsIssued)} />
        <Stat label="Credits redeemed" value={String(a.creditsRedeemed)} />
        <Stat
          label="Receipt approval"
          value={
            a.receiptApprovalRate == null
              ? "—"
              : `${Math.round(a.receiptApprovalRate * 100)}%`
          }
        />
        <Stat label="Open fraud" value={String(a.openFraudFlags)} />
        <Stat label="Active events" value={String(a.activeEvents)} />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Level distribution</h2>
        <ul className="mt-4 space-y-2">
          {a.levelDistribution.map((l) => (
            <li
              key={`${l.rank}-${l.name}`}
              className="flex justify-between border-b border-[var(--cult-line)] py-2 text-sm"
            >
              <span className="text-bone">
                {l.rank ?? "—"} · {l.name}
              </span>
              <span className="text-mist">{l.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cult-line)] bg-ink/40 px-4 py-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-mist">{label}</p>
      <p className="mt-2 font-display text-2xl text-bone">{value}</p>
    </div>
  );
}
