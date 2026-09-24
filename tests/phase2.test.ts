import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { cultEvents, members, referralClaims, users } from "@/db/schema";
import { rsvpEvent } from "@/lib/events";
import { hasPermission, Permission } from "@/lib/rbac";
import { claimReferral, ensureReferralCode } from "@/lib/referrals";
import { assignRole } from "@/lib/roles";
import { LedgerError } from "@/lib/ledgers";

async function fixtures() {
  const [mUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "member@cult.local"))
    .limit(1);
  const [m2User] = await db
    .select()
    .from(users)
    .where(eq(users.email, "member2@cult.local"))
    .limit(1);
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.email, "admin@cult.local"))
    .limit(1);
  const [analyst] = await db
    .select()
    .from(users)
    .where(eq(users.email, "analyst@cult.local"))
    .limit(1);
  const [m] = await db
    .select()
    .from(members)
    .where(eq(members.userId, mUser!.id))
    .limit(1);
  const [m2] = await db
    .select()
    .from(members)
    .where(eq(members.userId, m2User!.id))
    .limit(1);
  return {
    mUser: mUser!,
    m2User: m2User!,
    admin: admin!,
    analyst: analyst!,
    m: m!,
    m2: m2!,
  };
}

describe("referral abuse", () => {
  it("blocks self-referral", async () => {
    const { m, mUser } = await fixtures();
    const code = await ensureReferralCode(m.id);
    await expect(
      claimReferral({
        refereeMemberId: m.id,
        refereeUserId: mUser.id,
        code: code.code,
        idempotencyKey: `self-${randomBytes(4).toString("hex")}`,
      }),
    ).rejects.toThrow(/Self-referral/);
  });

  it("rewards once with idempotency", async () => {
    const { m, m2, m2User } = await fixtures();
    // Clear prior claim for m2 if any from previous runs — unique on referee
    const existing = await db
      .select()
      .from(referralClaims)
      .where(eq(referralClaims.refereeMemberId, m2.id))
      .limit(1);
    if (existing[0]) {
      // already claimed in prior test run — verify idempotent path only
      const code = await ensureReferralCode(m.id);
      await expect(
        claimReferral({
          refereeMemberId: m2.id,
          refereeUserId: m2User.id,
          code: code.code,
          idempotencyKey: `other-${randomBytes(3).toString("hex")}`,
        }),
      ).rejects.toThrow(/already claimed/);
      return;
    }

    const code = await ensureReferralCode(m.id);
    const key = `claim-${randomBytes(4).toString("hex")}`;
    const a = await claimReferral({
      refereeMemberId: m2.id,
      refereeUserId: m2User.id,
      code: code.code,
      idempotencyKey: key,
    });
    expect(a.replayed).toBe(false);
    const b = await claimReferral({
      refereeMemberId: m2.id,
      refereeUserId: m2User.id,
      code: code.code,
      idempotencyKey: key,
    });
    expect(b.replayed).toBe(true);
  });
});

describe("event RSVP eligibility", () => {
  it("rejects when level too low", async () => {
    const { m, mUser } = await fixtures();
    const [event] = await db
      .select()
      .from(cultEvents)
      .where(eq(cultEvents.slug, "steam-circle"))
      .limit(1);

    // temporarily require high level via update
    await db
      .update(cultEvents)
      .set({ minLevelRank: 12 })
      .where(eq(cultEvents.id, event!.id));

    await expect(
      rsvpEvent({
        eventId: event!.id,
        memberId: m.id,
        userId: mUser.id,
        idempotencyKey: `rsvp-${randomBytes(4).toString("hex")}`,
      }),
    ).rejects.toThrow(/Requires level/);

    await db
      .update(cultEvents)
      .set({ minLevelRank: 1 })
      .where(eq(cultEvents.id, event!.id));
  });

  it("allows eligible RSVP", async () => {
    const { m, mUser } = await fixtures();
    const [event] = await db
      .select()
      .from(cultEvents)
      .where(eq(cultEvents.slug, "steam-circle"))
      .limit(1);
    await db
      .update(cultEvents)
      .set({ minLevelRank: 1 })
      .where(eq(cultEvents.id, event!.id));

    const key = `rsvp-ok-${randomBytes(4).toString("hex")}`;
    const out = await rsvpEvent({
      eventId: event!.id,
      memberId: m.id,
      userId: mUser.id,
      idempotencyKey: key,
    });
    expect(["going", "waitlist"]).toContain(out.rsvp.status);
  });
});

describe("role authz", () => {
  it("analyst cannot assign roles; super_admin can", async () => {
    expect(hasPermission("analyst", Permission.ROLES_WRITE)).toBe(false);
    expect(hasPermission("super_admin", Permission.ROLES_WRITE)).toBe(true);

    const { analyst, admin, m2User } = await fixtures();
    await expect(
      assignRole({
        targetUserId: m2User.id,
        role: "staff",
        actorId: analyst.id,
        actorRole: analyst.role,
      }),
    ).rejects.toThrow(/SUPER_ADMIN/);

    const updated = await assignRole({
      targetUserId: m2User.id,
      role: "member",
      actorId: admin.id,
      actorRole: admin.role,
    });
    expect(updated.role).toBe("member");
  });
});
