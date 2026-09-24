"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CompleteRitualButton({
  slug,
  verifyMode,
}: {
  slug: string;
  verifyMode: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [visitCode, setVisitCode] = useState("");

  async function complete() {
    setPending(true);
    setMsg(null);
    const body: Record<string, string> = { ritualSlug: slug };
    if (verifyMode === "visit_code") body.visitCode = visitCode;

    const res = await fetch("/api/rituals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    if (verifyMode === "visit_code") {
      setMsg(data.note ?? "Logged — verify visit on Scan");
    } else {
      setMsg(data.replayed ? "Already recorded" : "Complete");
    }
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      {verifyMode === "visit_code" && (
        <input
          value={visitCode}
          onChange={(e) => setVisitCode(e.target.value)}
          placeholder="CODE"
          className="mb-3 w-28 border-0 border-b border-[var(--cult-line-strong)] bg-transparent px-0 py-1 text-center text-xs uppercase tracking-[0.22em] text-white outline-none focus:border-white"
        />
      )}
      <button
        type="button"
        onClick={complete}
        disabled={pending || (verifyMode === "visit_code" && !visitCode)}
        className="text-[0.62rem] uppercase tracking-[0.22em] text-stone transition hover:text-white disabled:opacity-40"
      >
        {pending ? "…" : "Begin ritual →"}
      </button>
      {msg && (
        <p className="mt-2 max-w-[10rem] text-[0.55rem] uppercase tracking-[0.14em] text-warm-grey">
          {msg}
        </p>
      )}
    </div>
  );
}
