import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "member",
  "analyst",
  "staff",
  "manager",
  "admin",
  "super_admin",
]);
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "paused",
  "banned",
]);
export const receiptStatusEnum = pgEnum("receipt_status", [
  "pending",
  "processing",
  "manual_review",
  "approved",
  "rejected",
]);
export const offeringStatusEnum = pgEnum("offering_status", [
  "active",
  "archived",
]);
export const voucherStatusEnum = pgEnum("voucher_status", [
  "issued",
  "redeemed",
  "void",
]);
export const ritualVerifyEnum = pgEnum("ritual_verify", [
  "none",
  "visit_code",
  "time_window",
]);
export const fraudStatusEnum = pgEnum("fraud_status", [
  "open",
  "reviewing",
  "dismissed",
  "confirmed",
]);
export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "going",
  "waitlist",
  "cancelled",
]);
export const referralClaimStatusEnum = pgEnum("referral_claim_status", [
  "pending",
  "rewarded",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const levels = pgTable("levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  rank: integer("rank").notNull().unique(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  xpThreshold: integer("xp_threshold").notNull(),
  perksJson: jsonb("perks_json").$type<string[]>().notNull().default([]),
  visualMeta: jsonb("visual_meta")
    .$type<{ accent?: string; mark?: string }>()
    .notNull()
    .default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    joinCode: varchar("join_code", { length: 16 }).notNull().unique(),
    status: memberStatusEnum("status").notNull().default("active"),
    currentLevelId: uuid("current_level_id").references(() => levels.id),
    xpBalance: integer("xp_balance").notNull().default(0),
    creditBalance: integer("credit_balance").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("members_level_idx").on(t.currentLevelId)],
);

export const xpLedger = pgTable(
  "xp_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    refType: varchar("ref_type", { length: 64 }),
    refId: varchar("ref_id", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("xp_ledger_idem_uidx").on(t.memberId, t.idempotencyKey),
    index("xp_ledger_member_idx").on(t.memberId),
  ],
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    refType: varchar("ref_type", { length: 64 }),
    refId: varchar("ref_id", { length: 128 }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_ledger_idem_uidx").on(t.memberId, t.idempotencyKey),
    index("credit_ledger_member_idx").on(t.memberId),
  ],
);

export const rituals = pgTable("rituals", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  xpReward: integer("xp_reward").notNull().default(0),
  creditReward: integer("credit_reward").notNull().default(0),
  cooldownHours: integer("cooldown_hours").notNull().default(24),
  verifyMode: ritualVerifyEnum("verify_mode").notNull().default("none"),
  /** For time_window: local hour end (0-23), morning rituals use beforeHour */
  beforeHour: integer("before_hour"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ritualCompletions = pgTable(
  "ritual_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ritualId: uuid("ritual_id")
      .notNull()
      .references(() => rituals.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    verificationPayload: jsonb("verification_payload").$type<
      Record<string, unknown>
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ritual_completion_idem_uidx").on(t.memberId, t.idempotencyKey),
    index("ritual_completion_member_idx").on(t.memberId, t.ritualId),
  ],
);

export const offerings = pgTable("offerings", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  creditCost: integer("credit_cost").notNull(),
  minLevelRank: integer("min_level_rank").notNull().default(1),
  stock: integer("stock"),
  status: offeringStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const redemptions = pgTable(
  "redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    offeringId: uuid("offering_id")
      .notNull()
      .references(() => offerings.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    creditSpent: integer("credit_spent").notNull(),
    voucherCode: varchar("voucher_code", { length: 32 }).notNull().unique(),
    voucherStatus: voucherStatusEnum("voucher_status").notNull().default("issued"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("redemption_idem_uidx").on(t.memberId, t.idempotencyKey),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    imageUrl: text("image_url"),
    blobKey: varchar("blob_key", { length: 255 }),
    ocrPayload: jsonb("ocr_payload").$type<Record<string, unknown>>(),
    amountCents: integer("amount_cents"),
    merchant: varchar("merchant", { length: 255 }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }),
    status: receiptStatusEnum("status").notNull().default("pending"),
    fraudScore: integer("fraud_score").notNull().default(0),
    contentHash: varchar("content_hash", { length: 128 }),
    fingerprint: jsonb("fingerprint").$type<{
      contentHash: string;
      amountCents: number | null;
      merchantNorm: string | null;
      dayKey: string | null;
    }>(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("receipt_idem_uidx").on(t.memberId, t.idempotencyKey),
    index("receipts_status_idx").on(t.status),
    index("receipts_hash_idx").on(t.contentHash),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    route: varchar("route", { length: 255 }).notNull(),
    key: varchar("key", { length: 128 }).notNull(),
    responseHash: text("response_hash"),
    responseBody: jsonb("response_body").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("idem_user_route_key_uidx").on(t.userId, t.route, t.key)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 128 }),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

/** Verified flagship / partner visits → passport stamps */
export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    locationCode: varchar("location_code", { length: 64 }).notNull(),
    locationName: varchar("location_name", { length: 120 }).notNull(),
    stampSlug: varchar("stamp_slug", { length: 64 }).notNull(),
    xpAwarded: integer("xp_awarded").notNull().default(0),
    creditsAwarded: integer("credits_awarded").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("visit_idem_uidx").on(t.memberId, t.idempotencyKey),
    index("visits_member_idx").on(t.memberId),
  ],
);

export const passportStamps = pgTable(
  "passport_stamps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").references(() => visits.id, {
      onDelete: "set null",
    }),
    stampSlug: varchar("stamp_slug", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("passport_stamp_once_uidx").on(t.memberId, t.stampSlug),
    index("passport_stamps_member_idx").on(t.memberId),
  ],
);

export const referralCodes = pgTable(
  "referral_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" })
      .unique(),
    code: varchar("code", { length: 16 }).notNull().unique(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("referral_codes_code_idx").on(t.code)],
);

export const referralClaims = pgTable(
  "referral_claims",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => referralCodes.id),
    referrerMemberId: uuid("referrer_member_id")
      .notNull()
      .references(() => members.id),
    refereeMemberId: uuid("referee_member_id")
      .notNull()
      .references(() => members.id)
      .unique(),
    status: referralClaimStatusEnum("status").notNull().default("rewarded"),
    referrerXp: integer("referrer_xp").notNull().default(0),
    referrerCredits: integer("referrer_credits").notNull().default(0),
    refereeXp: integer("referee_xp").notNull().default(0),
    refereeCredits: integer("referee_credits").notNull().default(0),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("referral_claim_idem_uidx").on(
      t.refereeMemberId,
      t.idempotencyKey,
    ),
    index("referral_claims_referrer_idx").on(t.referrerMemberId),
  ],
);

export const cultEvents = pgTable(
  "cult_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull(),
    location: varchar("location", { length: 160 }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    minLevelRank: integer("min_level_rank").notNull().default(1),
    capacity: integer("capacity"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("cult_events_starts_idx").on(t.startsAt)],
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => cultEvents.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull().default("going"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("event_rsvp_member_uidx").on(t.eventId, t.memberId),
    uniqueIndex("event_rsvp_idem_uidx").on(t.memberId, t.idempotencyKey),
  ],
);

export const badgeDefs = pgTable("badge_defs", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull(),
  criteria: jsonb("criteria")
    .$type<{
      type: "stamp_count" | "level_rank" | "ritual_count" | "visit_count" | "manual";
      threshold?: number;
    }>()
    .notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberBadges = pgTable(
  "member_badges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badgeDefs.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 64 }).notNull(),
    awardedAt: timestamp("awarded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("member_badge_uidx").on(t.memberId, t.badgeId),
    index("member_badges_member_idx").on(t.memberId),
  ],
);

export const fraudFlags = pgTable(
  "fraud_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 64 }).notNull(),
    severity: integer("severity").notNull().default(50),
    status: fraudStatusEnum("status").notNull().default("open"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fraud_flags_status_idx").on(t.status),
    index("fraud_flags_member_idx").on(t.memberId),
  ],
);

export const notificationPrefs = pgTable("notification_prefs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  pushEnabled: boolean("push_enabled").notNull().default(true),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  ritualReminders: boolean("ritual_reminders").notNull().default(true),
  eventReminders: boolean("event_reminders").notNull().default(true),
  rewardAlerts: boolean("reward_alerts").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    template: varchar("template", { length: 120 }).notNull(),
    channel: varchar("channel", { length: 32 }).notNull().default("push_mock"),
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notification_log_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Level = typeof levels.$inferSelect;
