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

export const userRoleEnum = pgEnum("user_role", ["member", "staff", "admin"]);
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

export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Level = typeof levels.$inferSelect;
