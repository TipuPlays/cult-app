import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/db";
import { members, passportStamps, users, visits, xpLedger } from "@/db/schema";
import { adminGrant } from "@/lib/grants";
import { hasPermission, Permission, StaffRole } from "@/lib/rbac";
import {
  __resetRateLimitsForTests,
  rateLimit,
} from "@/lib/rate-limit";
import { verifyVisit } from "@/lib/visits";

async function fixtures() {
  const [memberUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "member@cult.local"))
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
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.userId, memberUser!.id))
    .limit(1);
  return { memberUser: memberUser!, admin: admin!, analyst, member: member! };
}

describe("RBAC matrix", () => {
  it("analyst can read but not grant or review", () => {
    expect(hasPermission(StaffRole.ANALYST, Permission.MEMBERS_READ)).toBe(true);
    expect(hasPermission(StaffRole.ANALYST, Permission.GRANTS_WRITE)).toBe(false);
    expect(hasPermission(StaffRole.ANALYST, Permission.RECEIPTS_REVIEW)).toBe(
      false,
    );
  });

  it("manager can grant and review", () => {
    expect(hasPermission(StaffRole.MANAGER, Permission.GRANTS_WRITE)).toBe(true);
    expect(hasPermission(StaffRole.MANAGER, Permission.RECEIPTS_REVIEW)).toBe(
      true,
    );
  });

  it("member has no staff permissions", () => {
    expect(hasPermission("member", Permission.ADMIN_AREA)).toBe(false);
  });
});

describe("rate limiting", () => {
  beforeEach(() => __resetRateLimitsForTests());

  it("blocks after limit", () => {
    const key = `test:${randomBytes(4).toString("hex")}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit({ key, limit: 3, windowMs: 60_000 }).ok).toBe(true);
    }
    const blocked = rateLimit({ key, limit: 3, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe("admin grants", () => {
  it("writes XP via ledger only", async () => {
    const { member, admin } = await fixtures();
    const key = `grant-${randomBytes(4).toString("hex")}`;
    const out = await adminGrant({
      memberId: member.id,
      ledger: "xp",
      delta: 3,
      reason: "test goodwill",
      actorId: admin.id,
      idempotencyKey: key,
    });
    expect(out.replayed).toBe(false);
    const rows = await db
      .select()
      .from(xpLedger)
      .where(eq(xpLedger.idempotencyKey, `admin-xp:${key}`));
    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toMatch(/Admin adjust/);
  });
});

describe("visit verify + passport stamp", () => {
  it("awards ledger + unique stamp", async () => {
    const { member, memberUser } = await fixtures();
    const key = `visit-${randomBytes(4).toString("hex")}`;
    const first = await verifyVisit({
      memberId: member.id,
      userId: memberUser.id,
      locationCode: "CULTHQ",
      idempotencyKey: key,
    });
    expect(first.replayed).toBe(false);
    expect(first.visit.xpAwarded).toBe(60);
    expect(first.stamp?.stampSlug).toBe("flagship");

    const second = await verifyVisit({
      memberId: member.id,
      userId: memberUser.id,
      locationCode: "CULTHQ",
      idempotencyKey: key,
    });
    expect(second.replayed).toBe(true);

    const stamps = await db
      .select()
      .from(passportStamps)
      .where(eq(passportStamps.memberId, member.id));
    const flagship = stamps.filter((s) => s.stampSlug === "flagship");
    expect(flagship).toHaveLength(1);

    const visitRows = await db
      .select()
      .from(visits)
      .where(eq(visits.idempotencyKey, key));
    expect(visitRows).toHaveLength(1);
  });
});
