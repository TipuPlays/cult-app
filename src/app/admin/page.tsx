import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, levels, members, receipts } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { hasPermission, Permission } from "@/lib/rbac";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireStaffPage();
  const role = session.user.role;

  const [memberRows, queue, levelRows, audits] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(members),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(receipts)
      .where(eq(receipts.status, "manual_review")),
    db.select({ c: sql<number>`count(*)::int` }).from(levels),
    hasPermission(role, Permission.AUDIT_READ)
      ? db
          .select()
          .from(auditEvents)
          .orderBy(desc(auditEvents.createdAt))
          .limit(15)
      : Promise.resolve([]),
  ]);

  const links = [
    { href: "/admin/members", label: "Members", show: hasPermission(role, Permission.MEMBERS_READ) },
    { href: "/admin/receipts", label: "Receipt queue", show: hasPermission(role, Permission.RECEIPTS_REVIEW) },
    { href: "/admin/fraud", label: "Fraud queue", show: hasPermission(role, Permission.FRAUD_REVIEW) },
    { href: "/admin/grants", label: "Grant / adjust", show: hasPermission(role, Permission.GRANTS_WRITE) },
    { href: "/admin/events", label: "Events", show: hasPermission(role, Permission.EVENTS_WRITE) },
    { href: "/admin/referrals", label: "Referrals", show: hasPermission(role, Permission.REFERRALS_READ) },
    { href: "/admin/analytics", label: "Analytics", show: hasPermission(role, Permission.ANALYTICS_READ) },
    { href: "/admin/levels", label: "Levels", show: hasPermission(role, Permission.LEVELS_READ) },
    { href: "/admin/roles", label: "Roles", show: hasPermission(role, Permission.ROLES_WRITE) },
  ].filter((l) => l.show);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-[0.2em] text-bone">
          CULT
        </Link>
        <Link href="/app" className="text-sm text-mist">
          Member app
        </Link>
      </div>
      <h1 className="font-display mt-10 text-4xl text-bone">Admin</h1>
      <p className="mt-2 text-mist">RBAC · {role}</p>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <AdminStat label="Members" value={String(memberRows[0]?.c ?? 0)} />
        <AdminStat label="Review queue" value={String(queue[0]?.c ?? 0)} />
        <AdminStat label="Levels" value={String(levelRows[0]?.c ?? 0)} />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Sections</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-matcha hover:underline">
                {l.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {hasPermission(role, Permission.AUDIT_READ) && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-bone">Recent audit</h2>
          <ul className="mt-4 space-y-2">
            {audits.length === 0 && (
              <li className="text-sm text-mist">No events yet.</li>
            )}
            {audits.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-[var(--cult-line)] px-4 py-3 text-sm"
              >
                <span className="text-bone">{a.action}</span>
                <span className="mx-2 text-mist">·</span>
                <span className="text-mist">
                  {a.entityType}
                  {a.entityId ? `/${a.entityId.slice(0, 8)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cult-line)] bg-ink/40 px-4 py-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-mist">{label}</p>
      <p className="mt-2 font-display text-3xl text-bone">{value}</p>
    </div>
  );
}
