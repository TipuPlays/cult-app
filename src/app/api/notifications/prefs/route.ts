import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/authz";
import {
  ensureNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notifications";

export async function GET() {
  const { session, error } = await requireMember();
  if (error) return error;
  const prefs = await ensureNotificationPrefs(session!.user.id);
  return NextResponse.json({ prefs });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireMember();
  if (error) return error;

  const schema = z.object({
    pushEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    ritualReminders: z.boolean().optional(),
    eventReminders: z.boolean().optional(),
    rewardAlerts: z.boolean().optional(),
  });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid prefs" }, { status: 400 });
  }

  const prefs = await updateNotificationPrefs(session!.user.id, parsed.data);
  return NextResponse.json({ prefs });
}
