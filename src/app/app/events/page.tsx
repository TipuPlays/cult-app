import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { cultEvents, eventRsvps } from "@/db/schema";
import { RsvpButton } from "./rsvp-button";

export const metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const events = await db
    .select()
    .from(cultEvents)
    .where(eq(cultEvents.active, true))
    .orderBy(asc(cultEvents.startsAt));

  const mine = await db
    .select()
    .from(eventRsvps)
    .where(eq(eventRsvps.memberId, session.user.memberId));
  const map = Object.fromEntries(mine.map((r) => [r.eventId, r.status]));

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Events</h1>
      <p className="mt-2 text-mist">Level-gated. Capacity enforced server-side.</p>
      <ul className="mt-8 space-y-4">
        {events.length === 0 && (
          <li className="text-sm text-mist">No upcoming events.</li>
        )}
        {events.map((e) => (
          <li
            key={e.id}
            className="rounded-2xl border border-[var(--cult-line)] bg-ink/50 p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg text-bone">{e.title}</h2>
                <p className="mt-1 text-sm text-mist">{e.description}</p>
                <p className="mt-2 text-xs text-copper">
                  {new Date(e.startsAt).toLocaleString()}
                  {e.location ? ` · ${e.location}` : ""} · lvl {e.minLevelRank}+
                </p>
              </div>
              <RsvpButton eventId={e.id} current={map[e.id] ?? null} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
