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
      <div className="shrink-0 text-right">
        <p className="mb-2 text-[0.55rem] uppercase tracking-[0.18em] text-stone">
          {current}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("cancelled")}
          className="text-[0.62rem] uppercase tracking-[0.16em] text-ember hover:text-white"
        >
          Cancel
        </button>
        {msg && <p className="mt-1 text-[0.55rem] text-warm-grey">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => act("going")}
        className="text-[0.62rem] uppercase tracking-[0.22em] text-stone transition hover:text-white disabled:opacity-40"
      >
        {pending ? "…" : "RSVP →"}
      </button>
      {msg && <p className="mt-2 text-[0.55rem] text-warm-grey">{msg}</p>}
    </div>
  );
}
