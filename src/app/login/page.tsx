"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { loginAction } from "./actions";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const joined = params.get("joined");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = await loginAction({
      email: String(fd.get("email") || ""),
      password: String(fd.get("password") || ""),
    });
    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(params.get("next") || "/app");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
      <Link href="/" className="font-display text-xl tracking-[0.2em] text-bone">
        CULT
      </Link>
      <h1 className="font-display mt-14 text-4xl text-bone">Enter.</h1>
      {joined && (
        <p className="mt-3 text-sm text-matcha">Membership sealed. Sign in to continue.</p>
      )}
      <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-mist">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            defaultValue="member@cult.local"
            className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-4 py-3 text-bone outline-none focus:border-matcha/60"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.2em] text-mist">
            Password
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            defaultValue="cultmember1"
            className="w-full rounded-xl border border-[var(--cult-line)] bg-soil/60 px-4 py-3 text-bone outline-none focus:border-matcha/60"
          />
        </label>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full bg-matcha py-3.5 text-sm font-semibold text-void disabled:opacity-60"
        >
          {pending ? "Opening…" : "Enter CULT"}
        </button>
      </form>
      <p className="mt-6 text-sm text-mist">
        New?{" "}
        <Link href="/join" className="text-bone underline-offset-2 hover:underline">
          Request membership
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
