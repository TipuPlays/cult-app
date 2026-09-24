import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { ReceiptUploadForm } from "./upload-form";

export const metadata = { title: "Scan" };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await auth();
  if (!session?.user?.memberId) redirect("/login");

  const recent = await db
    .select()
    .from(receipts)
    .where(eq(receipts.memberId, session.user.memberId))
    .orderBy(desc(receipts.createdAt))
    .limit(10);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-16 pt-6">
      <Link href="/app" className="text-sm text-mist">
        ← Home
      </Link>
      <h1 className="font-display mt-8 text-4xl text-bone">Scan</h1>
      <p className="mt-3 text-mist">
        Upload → processing → review. Awards land only when approved.
      </p>
      <ReceiptUploadForm />
      <section className="mt-12">
        <h2 className="font-display text-2xl text-bone">Your receipts</h2>
        <ul className="mt-4 space-y-3">
          {recent.length === 0 && (
            <li className="text-sm text-mist">No receipts yet.</li>
          )}
          {recent.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-[var(--cult-line)] bg-ink/40 px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-bone">{r.merchant ?? "Receipt"}</span>
                <StatusPill status={r.status} />
              </div>
              <p className="mt-1 text-mist">
                {r.amountCents != null
                  ? `$${(r.amountCents / 100).toFixed(2)}`
                  : "—"}{" "}
                · fraud {r.fraudScore}
                {r.status === "approved"
                  ? ` · +${r.xpAwarded} XP / +${r.creditsAwarded} cr`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "approved"
      ? "text-matcha"
      : status === "rejected"
        ? "text-ember"
        : status === "manual_review"
          ? "text-copper"
          : "text-mist";
  return (
    <span className={`text-[10px] uppercase tracking-wider ${color}`}>
      {status.replace("_", " ")}
    </span>
  );
}
