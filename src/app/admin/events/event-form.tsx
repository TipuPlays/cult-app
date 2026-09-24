"use client";

import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function EventCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const slug = String(fd.get("slug") || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-");
    const startsLocal = String(fd.get("startsAt") || "");
    const startsAt = new Date(startsLocal).toISOString();
    const res = await fetch("/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify({
        slug,
        title: String(fd.get("title") || ""),
        description: String(fd.get("description") || ""),
        location: String(fd.get("location") || "") || undefined,
        startsAt,
        minLevelRank: Number(fd.get("minLevelRank") || 1),
        capacity: fd.get("capacity")
          ? Number(fd.get("capacity"))
          : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-md space-y-3">
      <input
        name="title"
        required
        placeholder="Title"
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
      />
      <input
        name="slug"
        required
        placeholder="slug"
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
      />
      <textarea
        name="description"
        required
        placeholder="Description"
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
      />
      <input
        name="location"
        placeholder="Location"
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
      />
      <input
        name="startsAt"
        type="datetime-local"
        required
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
      />
      <div className="flex gap-3">
        <input
          name="minLevelRank"
          type="number"
          min={1}
          max={12}
          defaultValue={1}
          className="w-1/2 rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
        />
        <input
          name="capacity"
          type="number"
          min={1}
          placeholder="Capacity"
          className="w-1/2 rounded-xl border border-[var(--cult-line)] bg-soil/60 px-3 py-2 text-bone"
        />
      </div>
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-matcha px-5 py-2 text-sm font-semibold text-void"
      >
        {pending ? "Saving…" : "Create event"}
      </button>
    </form>
  );
}
