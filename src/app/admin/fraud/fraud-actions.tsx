"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function FraudActions({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function resolve(status: "dismissed" | "confirmed" | "reviewing") {
    setPending(true);
    await fetch("/api/admin/fraud", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ flagId, status }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("confirmed")}
        className="rounded-full border border-ember/40 px-3 py-1.5 text-xs text-ember"
      >
        Confirm
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => resolve("dismissed")}
        className="rounded-full border border-matcha/40 px-3 py-1.5 text-xs text-matcha"
      >
        Dismiss
      </button>
    </div>
  );
}
