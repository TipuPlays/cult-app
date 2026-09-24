import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-6 py-10 md:px-10">
      <Link
        href="/"
        className="font-display text-2xl font-semibold tracking-[0.3em] text-white"
      >
        CULT
      </Link>
      <p className="cult-eyebrow mt-20">Doctrine</p>
      <h1 className="font-display mt-5 text-5xl font-medium leading-[1.05] text-white md:text-6xl">
        Not points.
        <br />
        A practice.
      </h1>
      <hr className="cult-rule mt-12" />
      <p className="mt-12 text-lg font-light leading-relaxed text-stone">
        CULT is a private coffee society. Membership ranks mark depth. Rituals
        invite craft. Credits unlock offerings. Nothing is sold as status.
      </p>
      <p className="mt-6 text-lg font-light leading-relaxed text-stone">
        Twelve thresholds. A living passport. Belonging you stamp.
      </p>
      <Link href="/membership" className="cult-btn mt-14 inline-flex">
        See the twelve
      </Link>
    </main>
  );
}
