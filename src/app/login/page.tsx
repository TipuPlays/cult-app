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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-10">
      <Link
        href="/"
        className="font-display text-2xl font-semibold tracking-[0.3em] text-white"
      >
        CULT
      </Link>
      <p className="cult-eyebrow mt-20">Threshold</p>
      <h1 className="font-display mt-4 text-5xl font-medium text-white">
        Enter.
      </h1>
      {joined && (
        <p className="mt-4 text-sm font-light text-stone">
          Membership sealed. Sign in to continue.
        </p>
      )}
      <form onSubmit={onSubmit} className="mt-14 flex flex-col gap-7">
        <label className="block">
          <span className="cult-eyebrow mb-2 block">Email</span>
          <input
            name="email"
            type="email"
            required
            defaultValue="member@cult.local"
            className="w-full border-0 border-b border-[var(--cult-line-strong)] bg-transparent px-0 py-3 text-white outline-none focus:border-white"
          />
        </label>
        <label className="block">
          <span className="cult-eyebrow mb-2 block">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            defaultValue="cultmember1"
            className="w-full border-0 border-b border-[var(--cult-line-strong)] bg-transparent px-0 py-3 text-white outline-none focus:border-white"
          />
        </label>
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="cult-btn mt-4 disabled:opacity-50"
        >
          {pending ? "Opening…" : "Enter CULT"}
        </button>
      </form>
      <p className="mt-12 text-sm font-light text-warm-grey">
        New?{" "}
        <Link
          href="/join"
          className="text-white underline-offset-4 hover:underline"
        >
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
