"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RedeemButton({ offeringId }: { offeringId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [voucher, setVoucher] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/offerings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ offeringId }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Redeem failed");
      return;
    }
    setVoucher(data.voucherCode);
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={redeem}
        disabled={pending}
        className="text-[0.62rem] uppercase tracking-[0.22em] text-stone transition hover:text-white disabled:opacity-40"
      >
        {pending ? "…" : "Discover →"}
      </button>
      {voucher && (
        <p className="mt-2 font-mono text-[0.55rem] tracking-[0.14em] text-stone">
          {voucher}
        </p>
      )}
      {error && (
        <p className="mt-2 text-[0.55rem] uppercase tracking-[0.12em] text-ember">
          {error}
        </p>
      )}
    </div>
  );
}
