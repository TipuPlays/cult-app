import Link from "next/link";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { auditEvents, members, receipts } from "@/db/schema";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin" && session.user.role !== "staff") {
    redirect("/app");
  }

  const memberCount = await db.select().from(members);
  const pendingReceipts = await db.select().from(receipts).limit(20);
  const audits = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(15);

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
      <p className="mt-2 text-mist">Server RBAC · {session.user.role}</p>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <AdminStat label="Members" value={String(memberCount.length)} />
        <AdminStat
          label="Receipts"
          value={String(pendingReceipts.length)}
        />
        <AdminStat label="Audit rows" value={String(audits.length)} />
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Sections</h2>
        <ul className="mt-4 space-y-2 text-sm text-mist">
          <li>Members — list + status (next)</li>
          <li>Levels — read from `/api/levels`</li>
          <li>Receipt queue — approve/reject (next)</li>
          <li>Rituals / offerings — manage (next)</li>
          <li>Audit feed — below</li>
        </ul>
      </section>

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
