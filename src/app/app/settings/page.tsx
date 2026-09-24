import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Settings</h1>
      <p className="mt-3 text-mist">Phase 1 essentials only.</p>
      <ul className="mt-10 space-y-4 text-sm">
        <li className="flex justify-between border-b border-[var(--cult-line)] py-3">
          <span className="text-mist">Email</span>
          <span className="text-bone">{session.user.email}</span>
        </li>
        <li className="flex justify-between border-b border-[var(--cult-line)] py-3">
          <span className="text-mist">Notifications</span>
          <span className="text-mist">Phase 2</span>
        </li>
        <li className="flex justify-between border-b border-[var(--cult-line)] py-3">
          <span className="text-mist">Referrals</span>
          <span className="text-mist">Phase 2</span>
        </li>
      </ul>
      <p className="mt-8">
        <Link href="/app/profile" className="text-matcha">
          Profile →
        </Link>
      </p>
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
