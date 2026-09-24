import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  notificationLog,
  notificationPrefs,
} from "@/db/schema";
import { notifyAdapter } from "@/lib/adapters";

export async function ensureNotificationPrefs(userId: string) {
  const [existing] = await db
    .select()
    .from(notificationPrefs)
    .where(eq(notificationPrefs.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(notificationPrefs)
    .values({ userId })
    .returning();
  return created;
}

export async function updateNotificationPrefs(
  userId: string,
  patch: Partial<{
    pushEnabled: boolean;
    emailEnabled: boolean;
    ritualReminders: boolean;
    eventReminders: boolean;
    rewardAlerts: boolean;
  }>,
) {
  await ensureNotificationPrefs(userId);
  const [updated] = await db
    .update(notificationPrefs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(notificationPrefs.userId, userId))
    .returning();
  await db.insert(auditEvents).values({
    actorId: userId,
    action: "notify.prefs_updated",
    entityType: "notification_prefs",
    entityId: userId,
    payload: patch,
  });
  return updated;
}

/** Respect prefs; mock channel via NotifyAdapter + log. */
export async function notifyUser(
  userId: string,
  template: string,
  data: Record<string, unknown> = {},
) {
  const prefs = await ensureNotificationPrefs(userId);

  const isReward =
    template.includes("reward") ||
    template.includes("referral") ||
    template.includes("badge");
  const isEvent = template.includes("event");
  const isRitual = template.includes("ritual");

  if (!prefs.pushEnabled) return { sent: false as const, reason: "push_off" };
  if (isReward && !prefs.rewardAlerts) {
    return { sent: false as const, reason: "reward_off" };
  }
  if (isEvent && !prefs.eventReminders) {
    return { sent: false as const, reason: "event_off" };
  }
  if (isRitual && !prefs.ritualReminders) {
    return { sent: false as const, reason: "ritual_off" };
  }

  await notifyAdapter.send(userId, template, data);
  await db.insert(notificationLog).values({
    userId,
    template,
    channel: "push_mock",
    payload: data,
  });
  return { sent: true as const };
}
