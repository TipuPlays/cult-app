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
      `Visit verified · +${data.xpAwarded} XP · +${data.creditsAwarded} credits${data.stampLabel ? ` · ${data.stampLabel}` : ""}`,
    );
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <label className="block">
        <input
          name="locationCode"
          required
          placeholder="CULTHQ"
          className="w-full border-0 border-b border-[var(--cult-line-strong)] bg-transparent px-0 py-3 font-display text-2xl uppercase tracking-[0.28em] text-white outline-none placeholder:text-warm-grey/40 focus:border-white"
        />
      </label>
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && (
        <p className="animate-rise text-sm font-light leading-relaxed text-stone">
          {msg}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="cult-btn disabled:opacity-50"
      >
        {pending ? "Verifying…" : "Verify visit"}
      </button>
    </form>
  );
}
