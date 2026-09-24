"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SIDE = [
  { href: "/app", label: "Home", exact: true },
  { href: "/app/rituals", label: "Rituals" },
] as const;

const RIGHT = [
  { href: "/app/offerings", label: "Offerings" },
  { href: "/app/profile", label: "You" },
] as const;

export function MemberNav() {
  const pathname = usePathname();

  function active(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="cult-nav fixed inset-x-0 bottom-0 z-40">
      <ul className="mx-auto flex max-w-lg items-end justify-between px-3 pb-2 pt-1">
        {SIDE.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              className={`flex flex-col items-center px-1 py-3 text-[0.55rem] uppercase tracking-[0.18em] transition ${
                active(item.href, "exact" in item && item.exact)
                  ? "text-white"
                  : "text-warm-grey hover:text-stone"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
        <li className="flex flex-1 justify-center">
          <Link
            href="/app/scan"
            className={`cult-nav-scan ${
              active("/app/scan") ? "ring-1 ring-stone ring-offset-2 ring-offset-obsidian" : ""
            }`}
            aria-label="Scan"
          >
            Scan
          </Link>
        </li>
        {RIGHT.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              className={`flex flex-col items-center px-1 py-3 text-[0.55rem] uppercase tracking-[0.18em] transition ${
                active(item.href)
                  ? "text-white"
                  : "text-warm-grey hover:text-stone"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
