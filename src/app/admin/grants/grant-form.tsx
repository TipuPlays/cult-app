"use client";

import { nanoid } from "nanoid";
import { FormEvent, useState } from "react";

type MemberOption = { id: string; displayName: string; email: string };

export function GrantForm({ members }: { members: MemberOption[] }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      memberId: String(fd.get("memberId")),
      ledger: String(fd.get("ledger")),
      delta: Number(fd.get("delta")),
      reason: String(fd.get("reason")),
    };
    const res = await fetch("/api/admin/grants", {
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
      setError(data.error ?? "Grant failed");
      return;
    }
    setMsg(
      `${data.ledger} ${data.delta > 0 ? "+" : ""}${data.delta} → balance ${data.balance}${data.replayed ? " (replay)" : ""}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-md space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wider text-mist">
          Member
        </span>
        <select
          name="memberId"
          required
          className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-3 text-bone"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName} ({m.email})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wider text-mist">
          Ledger
        </span>
        <select
          name="ledger"
          className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-3 text-bone"
        >
          <option value="xp">XP</option>
          <option value="credits">Credits</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wider text-mist">
          Delta (signed integer)
        </span>
        <input
          name="delta"
          type="number"
          required
          className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-3 text-bone"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs uppercase tracking-wider text-mist">
          Reason
        </span>
        <input
          name="reason"
          required
          minLength={3}
          className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-3 text-bone"
          placeholder="Support adjustment / goodwill"
        />
      </label>
      <p className="text-xs text-mist">
        Writes go through ledgers + audit only — never silent balance edits.
      </p>
      {error && <p className="text-sm text-ember">{error}</p>}
      {msg && <p className="text-sm text-matcha">{msg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-matcha px-6 py-3 text-sm font-semibold text-void disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post ledger entry"}
      </button>
    </form>
  );
}
