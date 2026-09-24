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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <Link
        href="/"
        className="font-display text-2xl font-semibold tracking-[0.3em] text-white"
      >
        CULT
      </Link>
      <p className="cult-eyebrow mt-20">Initiation</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Request entry.
      </h1>
      <p className="mt-4 font-light text-stone">
        Seal your name. Climb starts at The Initiate.
      </p>
      <form onSubmit={onSubmit} className="mt-14 flex flex-col gap-6">
        <Field name="name" label="Legal name" required />
        <Field name="displayName" label="Society name" required />
        <Field name="email" label="Email" type="email" required />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          minLength={8}
        />
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="cult-btn mt-4 disabled:opacity-50"
        >
          {pending ? "Sealing…" : "Join CULT"}
        </button>
      </form>
      <p className="mt-12 text-sm font-light text-warm-grey">
        Already inside?{" "}
        <Link
          href="/login"
          className="text-white underline-offset-4 hover:underline"
        >
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
      <span className="cult-eyebrow mb-2 block">{props.label}</span>
      <input
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        minLength={props.minLength}
        className="w-full border-0 border-b border-[var(--cult-line-strong)] bg-transparent px-0 py-3 text-white outline-none focus:border-white"
      />
    </label>
  );
}
