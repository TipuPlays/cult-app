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
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Settings</h1>
      <ul className="mt-10 space-y-4 text-sm">
        <li className="flex justify-between border-b border-[var(--cult-line)] py-3">
          <span className="text-mist">Email</span>
          <span className="text-bone">{session.user.email}</span>
        </li>
      </ul>

      <h2 className="font-display mt-10 text-2xl text-bone">Notifications</h2>
      <p className="mt-1 text-sm text-mist">
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

      <div className="mt-10 flex flex-col gap-3 text-sm">
        <Link href="/app/referrals" className="text-matcha">
          Referrals →
        </Link>
        <Link href="/app/events" className="text-matcha">
          Events →
        </Link>
        <Link href="/app/profile" className="text-matcha">
          Profile →
        </Link>
      </div>
      <form
        className="mt-10"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="text-sm text-ember">
          Sign out
        </button>
      </form>
    </main>
  );
}
