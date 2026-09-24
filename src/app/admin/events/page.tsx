import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { cultEvents } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";
import { EventCreateForm } from "./event-form";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireStaffPage(Permission.EVENTS_WRITE);

  const rows = await db
    .select()
    .from(cultEvents)
    .orderBy(desc(cultEvents.startsAt))
    .limit(50);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Events</h1>
      <EventCreateForm />
      <ul className="mt-12 space-y-3">
        {rows.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border border-[var(--cult-line)] px-4 py-3"
          >
            <p className="text-bone">{e.title}</p>
            <p className="text-xs text-mist">
              {e.slug} · lvl {e.minLevelRank}+ ·{" "}
              {e.active ? "active" : "inactive"} ·{" "}
              {new Date(e.startsAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
