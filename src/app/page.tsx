import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-5 pb-10 pt-6 md:px-10">
      <header className="animate-rise flex items-center justify-between">
        <p className="font-display text-2xl tracking-[0.2em] text-bone md:text-3xl">
          CULT
        </p>
        <nav className="flex items-center gap-5 text-sm text-mist">
          <Link href="/membership" className="hover:text-bone transition-colors">
            Membership
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[var(--cult-line)] px-4 py-2 text-bone hover:border-matcha/50 transition-colors"
          >
            Enter
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end pb-8 pt-24 md:justify-center md:pb-16 md:pt-10">
        <div
          aria-hidden
          className="animate-breathe pointer-events-none absolute -right-8 top-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(143,169,120,0.35)_0%,transparent_70%)] blur-2xl md:right-10 md:top-0 md:h-80 md:w-80"
        />
        <p className="animate-rise mb-4 text-xs uppercase tracking-[0.35em] text-copper">
          Specialty coffee · matcha · belonging
        </p>
        <h1 className="animate-rise font-display text-[clamp(3.2rem,12vw,6.5rem)] leading-[0.92] tracking-tight text-bone">
          Join the
          <br />
          quiet cult
          <br />
          of craft.
        </h1>
        <p className="animate-rise-delay mt-6 max-w-md text-base leading-relaxed text-mist md:text-lg">
          Twelve levels. Living rituals. Credits you earn — never buy your way in.
        </p>
        <div className="animate-rise-delay mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/join"
            className="rounded-full bg-matcha px-7 py-3.5 text-sm font-semibold tracking-wide text-void transition hover:bg-matcha-deep hover:text-bone"
          >
            Request membership
          </Link>
          <Link
            href="/about"
            className="text-sm text-mist underline-offset-4 hover:text-bone hover:underline"
          >
            What is CULT?
          </Link>
        </div>
      </section>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] bg-[linear-gradient(to_top,rgba(11,9,8,0.95),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55vh] opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%238fa978' stop-opacity='.25'/%3E%3Cstop offset='1' stop-color='%23c4a484' stop-opacity='.15'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cellipse cx='400' cy='520' rx='380' ry='160' fill='url(%23g)'/%3E%3Cpath d='M250 420c40-80 90-140 150-140s110 60 150 140' fill='none' stroke='%23f3eee6' stroke-opacity='.12' stroke-width='2'/%3E%3C/svg%3E\")",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
      />
    </main>
  );
}
