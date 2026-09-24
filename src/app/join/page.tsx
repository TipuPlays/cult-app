"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { nanoid } from "nanoid";

export default function JoinPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") || ""),
      displayName: String(fd.get("displayName") || ""),
      email: String(fd.get("email") || ""),
      password: String(fd.get("password") || ""),
    };

    const res = await fetch("/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": nanoid(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not join");
      setPending(false);
      return;
    }

    router.push("/login?joined=1");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
      <Link href="/" className="font-display text-xl tracking-[0.2em] text-bone">
        CULT
      </Link>
      <h1 className="font-display mt-14 text-4xl text-bone">Request entry.</h1>
      <p className="mt-3 text-mist">Phase 1: instant membership for the society.</p>
      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
        <Field name="name" label="Legal name" required />
        <Field name="displayName" label="Society name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="password" label="Password" type="password" required minLength={8} />
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-matcha py-3.5 text-sm font-semibold text-void disabled:opacity-60"
        >
          {pending ? "Sealing…" : "Join CULT"}
        </button>
      </form>
      <p className="mt-6 text-sm text-mist">
        Already inside?{" "}
        <Link href="/login" className="text-bone underline-offset-2 hover:underline">
          Enter
        </Link>
      </p>
    </main>
  );
}

function Field(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-mist">
        {props.label}
      </span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        minLength={props.minLength}
        className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-4 py-3 text-bone outline-none focus:border-matcha/60"
      />
    </label>
  );
}
