import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import {
  levels,
  members,
  offerings,
  rituals,
  users,
  badgeDefs,
  cultEvents,
} from "@/db/schema";
import type { AppRole } from "@/lib/rbac";
import { ensureReferralCode } from "@/lib/referrals";

const LEVEL_DEFS = [
  { rank: 1, slug: "initiate", name: "Initiate", xp: 0, mark: "I" },
  { rank: 2, slug: "ember", name: "Ember", xp: 100, mark: "II" },
  { rank: 3, slug: "steam", name: "Steam", xp: 250, mark: "III" },
  { rank: 4, slug: "bloom", name: "Bloom", xp: 450, mark: "IV" },
  { rank: 5, slug: "ceremonial", name: "Ceremonial", xp: 700, mark: "V" },
  { rank: 6, slug: "roast", name: "Roast", xp: 1000, mark: "VI" },
  { rank: 7, slug: "origin", name: "Origin", xp: 1400, mark: "VII" },
  { rank: 8, slug: "vessel", name: "Vessel", xp: 1900, mark: "VIII" },
  { rank: 9, slug: "inner-circle", name: "Inner Circle", xp: 2500, mark: "IX" },
  { rank: 10, slug: "keeper", name: "Keeper", xp: 3200, mark: "X" },
  { rank: 11, slug: "oracle", name: "Oracle", xp: 4000, mark: "XI" },
  { rank: 12, slug: "cult", name: "CULT", xp: 5000, mark: "XII" },
] as const;

async function seedLevels() {
  for (const l of LEVEL_DEFS) {
    const existing = await db
      .select()
      .from(levels)
      .where(eq(levels.rank, l.rank))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(levels).values({
      rank: l.rank,
      slug: l.slug,
      name: l.name,
      xpThreshold: l.xp,
      perksJson: [`Access: ${l.name}`],
      visualMeta: { mark: l.mark, accent: l.rank >= 9 ? "#C4A484" : "#7C9A6A" },
    });
  }
}

async function upsertUser(opts: {
  email: string;
  name: string;
  password: string;
  role: AppRole;
  displayName: string;
}) {
  const email = opts.email.toLowerCase();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    if (existing[0].role !== opts.role) {
      await db
        .update(users)
        .set({ role: opts.role })
        .where(eq(users.id, existing[0].id));
    }
    return existing[0];
  }

  const passwordHash = await hash(opts.password, 12);
  const [user] = await db
    .insert(users)
    .values({
      email,
      name: opts.name,
      passwordHash,
      role: opts.role,
    })
    .returning();

  const [level1] = await db
    .select()
    .from(levels)
    .where(eq(levels.rank, 1))
    .limit(1);

  await db.insert(members).values({
    userId: user.id,
    displayName: opts.displayName,
    joinCode: nanoid(8).toUpperCase(),
    currentLevelId: level1?.id,
    xpBalance: 0,
    creditBalance: opts.role === "member" ? 50 : 0,
  });

  return user;
}

async function seedRituals() {
  const defs = [
    {
      slug: "morning-steam",
      name: "Morning Steam",
      description: "Log your first cup before noon (server time-window check).",
      xpReward: 25,
      creditReward: 0,
      cooldownHours: 20,
      sortOrder: 1,
      verifyMode: "time_window" as const,
      beforeHour: 12,
    },
    {
      slug: "matcha-stillness",
      name: "Matcha Stillness",
      description: "Three quiet minutes with ceremonial grade.",
      xpReward: 40,
      creditReward: 5,
      cooldownHours: 24,
      sortOrder: 2,
      verifyMode: "none" as const,
      beforeHour: null,
    },
    {
      slug: "flagship-visit",
      name: "Flagship Visit",
      description: "Enter a CULT visit code from the space.",
      xpReward: 0,
      creditReward: 0,
      cooldownHours: 12,
      sortOrder: 3,
      verifyMode: "visit_code" as const,
      beforeHour: null,
    },
  ];

  for (const r of defs) {
    const existing = await db
      .select()
      .from(rituals)
      .where(eq(rituals.slug, r.slug))
      .limit(1);
    if (existing[0]) {
      await db
        .update(rituals)
        .set({
          verifyMode: r.verifyMode,
          beforeHour: r.beforeHour,
          xpReward: r.xpReward,
          creditReward: r.creditReward,
          description: r.description,
        })
        .where(eq(rituals.id, existing[0].id));
      continue;
    }
    await db.insert(rituals).values(r);
  }
}

async function seedOfferings() {
  const defs = [
    {
      slug: "guest-pour",
      name: "Guest Pour",
      description: "A complimentary drip for someone you bring.",
      creditCost: 40,
      minLevelRank: 2,
    },
    {
      slug: "ceremonial-upgrade",
      name: "Ceremonial Upgrade",
      description: "Elevate any matcha to ceremonial grade.",
      creditCost: 25,
      minLevelRank: 1,
    },
    {
      slug: "passport-stamp",
      name: "Passport Stamp Set",
      description: "Physical stamp sheet for your CULT passport.",
      creditCost: 80,
      minLevelRank: 4,
    },
  ];

  for (const o of defs) {
    const existing = await db
      .select()
      .from(offerings)
      .where(eq(offerings.slug, o.slug))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(offerings).values(o);
  }
}

async function seedBadges() {
  const defs = [
    {
      slug: "first-stamp",
      name: "First Stamp",
      description: "Collect your first passport stamp.",
      criteria: { type: "stamp_count" as const, threshold: 1 },
    },
    {
      slug: "wanderer",
      name: "Wanderer",
      description: "Three verified visits.",
      criteria: { type: "visit_count" as const, threshold: 3 },
    },
    {
      slug: "ritualist",
      name: "Ritualist",
      description: "Complete three rituals.",
      criteria: { type: "ritual_count" as const, threshold: 3 },
    },
    {
      slug: "ember-risen",
      name: "Ember Risen",
      description: "Reach Ember (level 2).",
      criteria: { type: "level_rank" as const, threshold: 2 },
    },
  ];
  for (const d of defs) {
    const existing = await db
      .select()
      .from(badgeDefs)
      .where(eq(badgeDefs.slug, d.slug))
      .limit(1);
    if (existing[0]) continue;
    await db.insert(badgeDefs).values(d);
  }
}

async function seedEvents() {
  const slug = "steam-circle";
  const existing = await db
    .select()
    .from(cultEvents)
    .where(eq(cultEvents.slug, slug))
    .limit(1);
  if (existing[0]) return;
  const starts = new Date();
  starts.setDate(starts.getDate() + 7);
  starts.setHours(18, 0, 0, 0);
  await db.insert(cultEvents).values({
    slug,
    title: "Steam Circle",
    description: "Quiet cupping for members — Initiate and above.",
    location: "CULT Flagship",
    startsAt: starts,
    minLevelRank: 1,
    capacity: 20,
    active: true,
  });
}

async function main() {
  console.log("Seeding CULT…");
  await seedLevels();
  await upsertUser({
    email: "admin@cult.local",
    name: "CULT Super Admin",
    password: "cultadmin1",
    role: "super_admin",
    displayName: "Keeper",
  });
  await upsertUser({
    email: "manager@cult.local",
    name: "CULT Manager",
    password: "cultmanager1",
    role: "manager",
    displayName: "Manager",
  });
  await upsertUser({
    email: "analyst@cult.local",
    name: "CULT Analyst",
    password: "cultanalyst1",
    role: "analyst",
    displayName: "Analyst",
  });
  const member = await upsertUser({
    email: "member@cult.local",
    name: "Ava Ember",
    password: "cultmember1",
    role: "member",
    displayName: "Ava",
  });
  const member2 = await upsertUser({
    email: "member2@cult.local",
    name: "Kai Steam",
    password: "cultmember2",
    role: "member",
    displayName: "Kai",
  });
  await seedRituals();
  await seedOfferings();
  await seedBadges();
  await seedEvents();

  const [m1] = await db
    .select()
    .from(members)
    .where(eq(members.userId, member.id))
    .limit(1);
  const [m2] = await db
    .select()
    .from(members)
    .where(eq(members.userId, member2.id))
    .limit(1);
  if (m1) await ensureReferralCode(m1.id);
  if (m2) await ensureReferralCode(m2.id);

  console.log("Done.");
  console.log("  admin@cult.local / cultadmin1 (super_admin)");
  console.log("  manager@cult.local / cultmanager1");
  console.log("  analyst@cult.local / cultanalyst1");
  console.log("  member@cult.local / cultmember1");
  console.log("  member2@cult.local / cultmember2");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
