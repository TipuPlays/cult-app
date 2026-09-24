import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10 md:px-8">
      <Link href="/" className="font-display text-xl tracking-[0.2em] text-bone">
        CULT
      </Link>
      <h1 className="font-display mt-14 text-4xl text-bone md:text-5xl">
        Not points. A practice.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-mist">
        CULT is a membership society for people who treat coffee and matcha as
        ritual — not transactions. XP tracks your depth. Credits unlock offerings.
        Levels are earned, never sold.
      </p>
      <Link href="/membership" className="mt-10 inline-block text-matcha hover:underline">
        See membership →
      </Link>
    </main>
  );
}
