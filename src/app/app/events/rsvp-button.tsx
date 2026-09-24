"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RsvpButton({
  eventId,
  current,
}: {
  eventId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(status: "going" | "cancelled") {
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ action: "rsvp", eventId, status }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg(data.status);
    router.refresh();
  }

  if (current === "going" || current === "waitlist") {
    return (
      <div className="text-right">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-matcha">
          {current}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("cancelled")}
          className="text-xs text-ember"
        >
          Cancel
        </button>
        {msg && <p className="text-[10px] text-mist">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => act("going")}
        className="rounded-full border border-matcha/40 px-4 py-2 text-xs uppercase tracking-wider text-matcha disabled:opacity-50"
      >
        {pending ? "…" : "RSVP"}
      </button>
      {msg && <p className="mt-1 text-[10px] text-mist">{msg}</p>}
    </div>
  );
}
