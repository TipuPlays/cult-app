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
      setMsg(data.note ?? "Logged — verify visit on Scan for stamp");
    } else {
      setMsg(data.replayed ? "Already recorded" : "Sealed");
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      {verifyMode === "visit_code" && (
        <input
          value={visitCode}
          onChange={(e) => setVisitCode(e.target.value)}
          placeholder="CODE"
          className="mb-2 w-24 rounded-lg border border-[var(--cult-line)] bg-void/50 px-2 py-1 text-xs uppercase tracking-widest text-bone"
        />
      )}
      <button
        type="button"
        onClick={complete}
        disabled={pending || (verifyMode === "visit_code" && !visitCode)}
        className="rounded-full border border-matcha/40 px-4 py-2 text-xs uppercase tracking-wider text-matcha disabled:opacity-50"
      >
        {pending ? "…" : "Complete"}
      </button>
      {msg && <p className="mt-1 text-[10px] text-mist">{msg}</p>}
    </div>
  );
}
