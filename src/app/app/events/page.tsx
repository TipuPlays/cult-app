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
    <main className="px-6 pt-7">
      <Link
        href="/app/profile"
        className="text-[0.62rem] uppercase tracking-[0.22em] text-warm-grey hover:text-white"
      >
        ← You
      </Link>
      <p className="cult-eyebrow mt-10">Gatherings</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Events
      </h1>
      <p className="mt-4 max-w-sm text-sm font-light text-stone">
        Level-gated. Capacity enforced server-side.
      </p>
      <ul className="mt-12">
        {events.length === 0 && (
          <li className="text-sm font-light text-warm-grey">
            No upcoming events.
          </li>
        )}
        {events.map((e) => (
          <li
            key={e.id}
            className="border-t border-[var(--cult-line)] py-8 first:border-t-0 first:pt-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl text-white">{e.title}</h2>
                <p className="mt-2 text-sm font-light text-warm-grey">
                  {e.description}
                </p>
                <p className="cult-meta mt-4 text-stone">
                  {new Date(e.startsAt).toLocaleString()}
                  {e.location ? ` · ${e.location}` : ""} · rank {e.minLevelRank}+
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
