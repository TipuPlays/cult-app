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
    <div className="text-right">
      <button
        type="button"
        onClick={redeem}
        disabled={pending}
        className="rounded-full border border-matcha/40 px-4 py-2 text-xs uppercase tracking-wider text-matcha disabled:opacity-50"
      >
        {pending ? "…" : "Redeem"}
      </button>
      {voucher && (
        <p className="mt-1 font-mono text-[10px] tracking-wider text-copper">
          {voucher}
        </p>
      )}
      {error && <p className="mt-1 text-[10px] text-ember">{error}</p>}
    </div>
  );
}
