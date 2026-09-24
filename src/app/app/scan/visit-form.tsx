"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function VisitVerifyForm() {
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
    const res = await fetch("/api/visits/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({
        locationCode: String(fd.get("locationCode") || ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Verify failed");
      return;
    }
    setMsg(
      `${data.locationName} · +${data.xpAwarded} XP / +${data.creditsAwarded} cr${data.stampLabel ? ` · stamp “${data.stampLabel}”` : ""}`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-mist">
          Visit code
        </span>
        <input
          name="locationCode"
          required
          placeholder="e.g. CULTHQ"
          className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-4 py-3 uppercase tracking-widest text-bone outline-none focus:border-matcha/60"
        />
      </label>
      <p className="text-xs text-mist">
        Server verifies location → passport stamp + ledger awards.
      </p>
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && <p className="text-sm text-matcha">{msg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-matcha/50 px-5 py-2.5 text-sm text-matcha disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify visit"}
      </button>
    </form>
  );
}
