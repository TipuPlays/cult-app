import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  badgeDefs,
  levels,
  memberBadges,
  members,
  passportStamps,
  ritualCompletions,
  visits,
} from "@/db/schema";

export async function evaluateBadges(memberId: string, source: string) {
  const defs = await db
    .select()
    .from(badgeDefs)
    .where(eq(badgeDefs.active, true));

  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!member) return [];

  let levelRank = 1;
  if (member.currentLevelId) {
    const [lvl] = await db
      .select()
      .from(levels)
      .where(eq(levels.id, member.currentLevelId))
      .limit(1);
    levelRank = lvl?.rank ?? 1;
  }

  const [stampC] = await db
    .select({ c: count() })
    .from(passportStamps)
    .where(eq(passportStamps.memberId, memberId));
  const [visitC] = await db
    .select({ c: count() })
    .from(visits)
    .where(eq(visits.memberId, memberId));
  const [ritualC] = await db
    .select({ c: count() })
    .from(ritualCompletions)
    .where(eq(ritualCompletions.memberId, memberId));

  const metrics = {
    stamp_count: Number(stampC?.c ?? 0),
    visit_count: Number(visitC?.c ?? 0),
    ritual_count: Number(ritualC?.c ?? 0),
    level_rank: levelRank,
  };

  const awarded: (typeof memberBadges.$inferSelect)[] = [];

  for (const def of defs) {
    const existing = await db
      .select()
      .from(memberBadges)
      .where(
        and(
          eq(memberBadges.memberId, memberId),
          eq(memberBadges.badgeId, def.id),
        ),
      )
      .limit(1);
    if (existing[0]) continue;

    const crit = def.criteria;
    const threshold = crit.threshold ?? 1;
    let ok = false;
    if (crit.type === "stamp_count") ok = metrics.stamp_count >= threshold;
    if (crit.type === "visit_count") ok = metrics.visit_count >= threshold;
    if (crit.type === "ritual_count") ok = metrics.ritual_count >= threshold;
    if (crit.type === "level_rank") ok = metrics.level_rank >= threshold;
    if (crit.type === "manual") ok = false;

    if (!ok) continue;

    const [row] = await db
      .insert(memberBadges)
      .values({
        memberId,
        badgeId: def.id,
        source,
      })
      .returning();
    awarded.push(row);
    await db.insert(auditEvents).values({
      action: "badge.awarded",
      entityType: "member_badge",
      entityId: row.id,
      payload: { memberId, badge: def.slug, source },
    });
  }

  return awarded;
}

export async function listMemberBadges(memberId: string) {
  return db
    .select({
      id: memberBadges.id,
      awardedAt: memberBadges.awardedAt,
      source: memberBadges.source,
      slug: badgeDefs.slug,
      name: badgeDefs.name,
      description: badgeDefs.description,
    })
    .from(memberBadges)
    .innerJoin(badgeDefs, eq(memberBadges.badgeId, badgeDefs.id))
    .where(eq(memberBadges.memberId, memberId));
}
