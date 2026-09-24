import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(245,245,242,0.05)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="animate-breathe pointer-events-none absolute left-1/2 top-[20%] h-[38vw] max-h-[380px] w-[38vw] max-w-[380px] -translate-x-1/2 rounded-full border border-[var(--cult-line)]"
      />

      <header className="animate-rise relative z-10 flex items-center justify-between px-6 pt-7 md:px-12">
        <p className="font-display text-3xl font-semibold tracking-[0.3em] text-white md:text-4xl">
          CULT
        </p>
        <nav className="flex items-center gap-6 text-[0.65rem] uppercase tracking-[0.22em] text-warm-grey">
          <Link href="/membership" className="transition hover:text-white">
            Ranks
          </Link>
          <Link href="/login" className="cult-btn cult-btn-ghost !px-4 !py-2">
            Enter
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-16 pt-24 text-center md:px-12">
        <p className="cult-eyebrow animate-rise">Private coffee society</p>
        <h1 className="animate-rise-delay font-display mt-10 text-[clamp(4rem,16vw,9rem)] font-medium leading-[0.85] tracking-[-0.03em] text-white">
          CULT
        </h1>
        <p className="animate-rise-delay mx-auto mt-10 max-w-md text-base font-light leading-relaxed text-stone md:text-lg">
          Twelve ranks. Rituals. A passport you earn — never buy.
        </p>
        <div className="animate-rise-delay-2 mt-14 flex flex-col items-center gap-6 sm:flex-row">
          <Link href="/join" className="cult-btn">
            Request entry
          </Link>
          <Link
            href="/about"
            className="text-[0.65rem] uppercase tracking-[0.22em] text-warm-grey underline-offset-4 hover:text-white hover:underline"
          >
            Doctrine
          </Link>
        </div>
      </section>

      <footer className="animate-rise-delay-2 relative z-10 border-t border-[var(--cult-line)] px-6 py-5 md:px-12">
        <div className="mx-auto flex max-w-3xl items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-warm-grey">
          <span>XP · Credits · Passport</span>
          <span>Never buy the climb</span>
        </div>
      </footer>
    </main>
  );
}
