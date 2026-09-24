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
    setMsg(`Received · ${data.status}`);
    router.refresh();
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <label className="block">
        <span className="cult-eyebrow mb-3 block">Image</span>
        <input
          name="file"
          type="file"
          accept="image/*,.pdf"
          required
          className="w-full text-sm text-warm-grey file:mr-4 file:border file:border-white file:bg-transparent file:px-4 file:py-2 file:text-[0.62rem] file:uppercase file:tracking-[0.18em] file:text-white"
        />
      </label>
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && <p className="text-sm font-light text-stone">{msg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="cult-btn cult-btn-line disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit receipt"}
      </button>
    </form>
  );
}
