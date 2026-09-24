"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = {
  id: string;
  email: string;
  name: string;
  role: string;
  displayName: string | null;
};

const ROLES = [
  "member",
  "analyst",
  "staff",
  "manager",
  "admin",
  "super_admin",
] as const;

export function RoleAssignForm({ users }: { users: Row[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function assign(userId: string, role: string) {
    setPending(userId);
    setMsg(null);
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({ userId, role }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg(`${data.role} assigned`);
    router.refresh();
  }

  return (
    <div className="mt-8 space-y-3">
      {msg && <p className="text-sm text-matcha">{msg}</p>}
      {users.map((u) => (
        <div
          key={u.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--cult-line)] px-4 py-3"
        >
          <div>
            <p className="text-bone">{u.displayName ?? u.name}</p>
            <p className="text-xs text-mist">
              {u.email} · {u.role}
            </p>
          </div>
          <select
            defaultValue={u.role}
            disabled={pending === u.id}
            onChange={(e) => assign(u.id, e.target.value)}
            className="rounded-lg border border-[var(--cult-line)] bg-soil/60 px-2 py-1 text-sm text-bone"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
