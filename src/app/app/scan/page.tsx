import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata = { title: "Scan" };

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Scan</h1>
      <p className="mt-3 text-mist">
        Receipt upload lands in a pending queue. OCR + POS are mock adapters —
        awards only after admin approval.
      </p>
      <div className="mt-10 rounded-2xl border border-dashed border-[var(--cult-line)] px-6 py-16 text-center text-sm text-mist">
        Upload UI next increment
      </div>
    </main>
  );
}
