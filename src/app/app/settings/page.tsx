import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ensureNotificationPrefs } from "@/lib/notifications";
import { NotifyPrefsForm } from "./notify-form";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const prefs = await ensureNotificationPrefs(session.user.id);

  return (
    <main className="px-6 pt-7">
      <Link
        href="/app/profile"
        className="text-[0.62rem] uppercase tracking-[0.22em] text-warm-grey hover:text-white"
      >
        ← You
      </Link>
      <p className="cult-eyebrow mt-10">Preferences</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Settings
      </h1>

      <ul className="mt-12">
        <li className="flex justify-between border-t border-[var(--cult-line)] py-4">
          <span className="cult-eyebrow">Email</span>
          <span className="font-light text-white">{session.user.email}</span>
        </li>
      </ul>

      <h2 className="font-display mt-14 text-3xl font-medium text-white">
        Notifications
      </h2>
      <p className="mt-2 text-sm font-light text-warm-grey">
        Mock push via NotifyAdapter — no FCM yet.
      </p>
      <NotifyPrefsForm
        initial={{
          pushEnabled: prefs.pushEnabled,
          emailEnabled: prefs.emailEnabled,
          ritualReminders: prefs.ritualReminders,
          eventReminders: prefs.eventReminders,
          rewardAlerts: prefs.rewardAlerts,
        }}
      />

      <form
        className="mt-14 border-t border-[var(--cult-line)] pt-8"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="text-[0.62rem] uppercase tracking-[0.22em] text-ember hover:text-white"
        >
          Exit CULT
        </button>
      </form>
    </main>
  );
}
