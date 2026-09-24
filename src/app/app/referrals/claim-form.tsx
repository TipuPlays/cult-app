"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ReferralClaimForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/referrals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ code: String(fd.get("code") || "") }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Claim failed");
      return;
    }
    setMsg(
      `Welcome · +${data.refereeXp} XP / +${data.refereeCredits} credits`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <input
        name="code"
        required
        placeholder="CULT-XXXXXXXX"
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-4 py-3 uppercase tracking-widest text-bone outline-none focus:border-matcha/60"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && <p className="text-sm text-matcha">{msg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-matcha px-5 py-2.5 text-sm font-semibold text-void disabled:opacity-60"
      >
        {pending ? "Claiming…" : "Claim code"}
      </button>
    </form>
  );
}
