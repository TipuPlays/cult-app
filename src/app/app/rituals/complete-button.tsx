"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteRitualButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function complete() {
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/rituals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ ritualSlug: slug }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg(data.replayed ? "Already recorded" : "Sealed");
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={complete}
        disabled={pending}
        className="rounded-full border border-matcha/40 px-4 py-2 text-xs uppercase tracking-wider text-matcha disabled:opacity-50"
      >
        {pending ? "…" : "Complete"}
      </button>
      {msg && <p className="mt-1 text-[10px] text-mist">{msg}</p>}
    </div>
  );
}
