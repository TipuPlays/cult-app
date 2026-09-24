import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { levels } from "@/db/schema";
import { requireStaffPage } from "@/lib/admin-page";
import { Permission } from "@/lib/rbac";

export const metadata = { title: "Levels" };
export const dynamic = "force-dynamic";

export default async function AdminLevelsPage() {
  await requireStaffPage(Permission.LEVELS_READ);

  const rows = await db.select().from(levels).orderBy(asc(levels.rank));

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-10">
      <Link href="/admin" className="text-sm text-mist">
        ← Admin
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Levels</h1>
      <p className="mt-2 text-mist">Configurable backend data (not frontend hardcode).</p>
      <ol className="mt-10 border-t border-[var(--cult-line)]">
        {rows.map((l) => (
          <li
            key={l.id}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--cult-line)] py-4"
          >
            <div>
              <span className="mr-3 font-display text-copper">
                {(l.visualMeta as { mark?: string })?.mark ?? l.rank}
              </span>
              <span className="text-bone">{l.name}</span>
              <span className="ml-2 text-xs text-mist">{l.slug}</span>
            </div>
            <span className="text-sm tabular-nums text-mist">{l.xpThreshold} XP</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
