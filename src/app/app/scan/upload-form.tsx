"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function ReceiptUploadForm() {
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
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a receipt image");
      setPending(false);
      return;
    }

    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Idempotency-Key": nanoid() },
      body,
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setMsg(`Status: ${data.status} · fraud ${data.fraudScore ?? 0}`);
    router.refresh();
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-mist">
          Receipt image
        </span>
        <input
          name="file"
          type="file"
          accept="image/*,.pdf"
          required
          className="w-full text-sm text-mist file:mr-4 file:rounded-full file:border-0 file:bg-matcha file:px-4 file:py-2 file:text-sm file:font-semibold file:text-void"
        />
      </label>
      <p className="text-xs text-mist">
        Rewards are computed server-side after admin approval. Client XP/credits
        are ignored.
      </p>
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && <p className="text-sm text-matcha">{msg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-matcha px-6 py-3 text-sm font-semibold text-void disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Submit receipt"}
      </button>
    </form>
  );
}
