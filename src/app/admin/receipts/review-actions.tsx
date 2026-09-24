"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function review(decision: "approved" | "rejected") {
    setPending(true);
    setMsg(null);
    const res = await fetch(`/api/admin/receipts/${receiptId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg(
      decision === "approved"
        ? `Approved +${data.awards?.xp ?? 0} XP / +${data.awards?.credits ?? 0} cr`
        : "Rejected",
    );
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => review("approved")}
        className="rounded-full bg-matcha px-4 py-2 text-xs font-semibold text-void disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => review("rejected")}
        className="rounded-full border border-ember/40 px-4 py-2 text-xs text-ember disabled:opacity-50"
      >
        Reject
      </button>
      {msg && <span className="text-xs text-mist">{msg}</span>}
    </div>
  );
}
